package ingestion

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/dkapanidis/kubernetes-statistics/internal/models"
)

type SyncStats struct {
	ResourcesProcessed int
	ResourcesNew       int
	ResourcesUpdated   int
	ResourcesDeleted   int
	ValuesNew          int
	ValuesChanged      int
	ValuesClosed       int
}

func Sync(db *sql.DB, discovered []models.DiscoveredResource, runTime time.Time) (*SyncStats, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	stats := &SyncStats{}

	for _, res := range discovered {
		stats.ResourcesProcessed++

		resourceID, isNew, err := upsertResource(tx, res, runTime)
		if err != nil {
			return nil, fmt.Errorf("upsert resource %s/%s/%s/%s: %w", res.Cluster, res.Namespace, res.Kind, res.Name, err)
		}
		if isNew {
			stats.ResourcesNew++
		} else {
			stats.ResourcesUpdated++
		}

		if err := syncValues(tx, resourceID, res.Values, runTime, stats); err != nil {
			return nil, fmt.Errorf("sync values for resource %d: %w", resourceID, err)
		}
	}

	// Close resources not seen in this run
	deleted, err := closeDeletedResources(tx, runTime)
	if err != nil {
		return nil, fmt.Errorf("close deleted resources: %w", err)
	}
	stats.ResourcesDeleted = deleted

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return stats, nil
}

func upsertResource(tx *sql.Tx, res models.DiscoveredResource, runTime time.Time) (int64, bool, error) {
	// Try to find existing
	var id int64
	err := tx.QueryRow(
		`SELECT id FROM resources WHERE cluster = ? AND namespace = ? AND kind = ? AND name = ?`,
		res.Cluster, res.Namespace, res.Kind, res.Name,
	).Scan(&id)

	if err == sql.ErrNoRows {
		result, err := tx.Exec(
			`INSERT INTO resources (cluster, namespace, kind, name, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?)`,
			res.Cluster, res.Namespace, res.Kind, res.Name, runTime, runTime,
		)
		if err != nil {
			return 0, false, err
		}
		id, _ = result.LastInsertId()
		return id, true, nil
	}
	if err != nil {
		return 0, false, err
	}

	_, err = tx.Exec(`UPDATE resources SET last_seen = ? WHERE id = ?`, runTime, id)
	return id, false, err
}

type liveValue struct {
	id    int64
	value string
}

func syncValues(tx *sql.Tx, resourceID int64, current map[string]models.FlatValue, runTime time.Time, stats *SyncStats) error {
	// Fetch latest values for this resource (one per key, most recent last_seen)
	rows, err := tx.Query(`
		SELECT rv.id, rv.key, rv.value
		FROM resource_values rv
		INNER JOIN (
			SELECT key, MAX(last_seen) as max_ls
			FROM resource_values
			WHERE resource_id = ?
			GROUP BY key
		) latest ON rv.key = latest.key AND rv.last_seen = latest.max_ls
		WHERE rv.resource_id = ?
	`, resourceID, resourceID)
	if err != nil {
		return err
	}

	live := make(map[string]liveValue)
	for rows.Next() {
		var id int64
		var key, value string
		if err := rows.Scan(&id, &key, &value); err != nil {
			rows.Close()
			return err
		}
		live[key] = liveValue{id: id, value: value}
	}
	rows.Close()

	// Process current values
	for key, fv := range current {
		if existing, ok := live[key]; ok {
			if existing.value == fv.Value {
				// Unchanged — update last_seen
				if _, err := tx.Exec(`UPDATE resource_values SET last_seen = ? WHERE id = ?`, runTime, existing.id); err != nil {
					return err
				}
			} else {
				// Changed — close old, insert new
				stats.ValuesChanged++
				if _, err := tx.Exec(`UPDATE resource_values SET last_seen = last_seen WHERE id = ?`, existing.id); err != nil {
					return err
				}
				if err := insertValue(tx, resourceID, key, fv, runTime); err != nil {
					return err
				}
			}
			delete(live, key)
		} else {
			// New key
			stats.ValuesNew++
			if err := insertValue(tx, resourceID, key, fv, runTime); err != nil {
				return err
			}
		}
	}

	// Close keys no longer present (their last_seen stays as-is)
	if len(live) > 0 {
		stats.ValuesClosed += len(live)
		log.Printf("  closed %d removed keys for resource %d", len(live), resourceID)
	}

	return nil
}

func insertValue(tx *sql.Tx, resourceID int64, key string, fv models.FlatValue, runTime time.Time) error {
	_, err := tx.Exec(
		`INSERT INTO resource_values (resource_id, key, value, value_int, value_float, value_time, first_seen, last_seen)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		resourceID, key, fv.Value, fv.ValueInt, fv.ValueFloat, fv.ValueTime, runTime, runTime,
	)
	return err
}

func closeDeletedResources(tx *sql.Tx, runTime time.Time) (int, error) {
	var count int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM resources WHERE last_seen < ?`, runTime).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}
