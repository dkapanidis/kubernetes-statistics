package db

import "database/sql"

func migrate(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS resources (
			id        INTEGER PRIMARY KEY AUTOINCREMENT,
			cluster   TEXT NOT NULL,
			namespace TEXT NOT NULL,
			kind      TEXT NOT NULL,
			name      TEXT NOT NULL,
			first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			last_seen  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(cluster, namespace, kind, name)
		);

		CREATE INDEX IF NOT EXISTS idx_resources_kind ON resources(kind);
		CREATE INDEX IF NOT EXISTS idx_resources_cluster ON resources(cluster);
		CREATE INDEX IF NOT EXISTS idx_resources_last_seen ON resources(last_seen);

		CREATE TABLE IF NOT EXISTS resource_values (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			resource_id INTEGER NOT NULL REFERENCES resources(id),
			key         TEXT NOT NULL,
			value       TEXT NOT NULL,
			value_int   INTEGER,
			value_float REAL,
			value_time  DATETIME,
			first_seen  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			last_seen   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_rv_resource_id ON resource_values(resource_id);
		CREATE INDEX IF NOT EXISTS idx_rv_key_value ON resource_values(key, value);
		CREATE INDEX IF NOT EXISTS idx_rv_key_value_int ON resource_values(key, value_int);
		CREATE INDEX IF NOT EXISTS idx_rv_key_value_time ON resource_values(key, value_time);
		CREATE INDEX IF NOT EXISTS idx_rv_lookup ON resource_values(resource_id, key, last_seen);
	`)
	return err
}
