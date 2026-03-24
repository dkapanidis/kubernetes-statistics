package api

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type groupByResult struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type timeseriesPoint struct {
	Date   string         `json:"date"`
	Values map[string]int `json:"values"`
}

// GET /api/keys?kind=PostgresCluster
// Returns distinct keys for a given kind.
func (s *Server) getKeys(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	if kind == "" {
		http.Error(w, "kind parameter required", http.StatusBadRequest)
		return
	}

	rows, err := s.db.Query(`
		SELECT DISTINCT rv.key
		FROM resource_values rv
		JOIN resources r ON r.id = rv.resource_id
		WHERE r.kind = ?
		ORDER BY rv.key
	`, kind)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	keys := []string{}
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		keys = append(keys, k)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(keys)
}

// GET /api/query?kind=PostgresCluster&groupBy=spec.postgresVersion&filterKey=...&filterOp=...&filterValue=...
// Returns counts grouped by the value of groupBy key.
func (s *Server) queryGroupBy(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	groupBy := r.URL.Query().Get("groupBy")
	if kind == "" || groupBy == "" {
		http.Error(w, "kind and groupBy parameters required", http.StatusBadRequest)
		return
	}

	query := `
		SELECT grp.value, COUNT(DISTINCT grp.resource_id) as cnt
		FROM resource_values grp
		JOIN resources r ON r.id = grp.resource_id
		INNER JOIN (
			SELECT resource_id, key, MAX(last_seen) as max_ls
			FROM resource_values GROUP BY resource_id, key
		) latest ON grp.resource_id = latest.resource_id AND grp.key = latest.key AND grp.last_seen = latest.max_ls
		WHERE r.kind = ? AND grp.key = ?
	`
	args := []any{kind, groupBy}

	// Optional filter
	query, args = applyFilter(r, query, args)

	query += ` GROUP BY grp.value ORDER BY cnt DESC`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := []groupByResult{}
	for rows.Next() {
		var g groupByResult
		if err := rows.Scan(&g.Value, &g.Count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results = append(results, g)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// GET /api/query/timeseries?kind=PostgresCluster&groupBy=spec.postgresVersion&start=2026-01-01&end=2026-03-24&interval=day
// Returns time-series of counts grouped by value, using SCD date expansion.
func (s *Server) queryTimeseries(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	groupBy := r.URL.Query().Get("groupBy")
	start := r.URL.Query().Get("start")
	end := r.URL.Query().Get("end")
	if kind == "" || groupBy == "" {
		http.Error(w, "kind and groupBy parameters required", http.StatusBadRequest)
		return
	}

	// Default date range: last 90 days
	if start == "" {
		start = "date('now', '-90 days')"
	} else {
		start = "date('" + sanitizeDateParam(start) + "')"
	}
	if end == "" {
		end = "date('now')"
	} else {
		end = "date('" + sanitizeDateParam(end) + "')"
	}

	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "day"
	}

	var dateStep string
	switch interval {
	case "week":
		dateStep = "+7 days"
	case "month":
		dateStep = "+1 month"
	default:
		dateStep = "+1 day"
	}

	query := `
		WITH RECURSIVE dates(d) AS (
			SELECT ` + start + `
			UNION ALL
			SELECT DATE(d, '` + dateStep + `') FROM dates WHERE d < ` + end + `
		)
		SELECT dates.d, rv.value, COUNT(DISTINCT rv.resource_id)
		FROM dates
		JOIN resource_values rv ON DATE(rv.first_seen) <= dates.d AND DATE(rv.last_seen) >= dates.d AND rv.key = ?
		JOIN resources r ON r.id = rv.resource_id AND r.kind = ?
	`
	args := []any{groupBy, kind}

	// Optional filter
	query, args = applyFilter(r, query, args)

	query += `
		GROUP BY dates.d, rv.value
		ORDER BY dates.d, rv.value
	`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Build structured response
	pointMap := map[string]*timeseriesPoint{}
	var dates []string
	for rows.Next() {
		var date, value string
		var count int
		if err := rows.Scan(&date, &value, &count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		pt, ok := pointMap[date]
		if !ok {
			pt = &timeseriesPoint{Date: date, Values: map[string]int{}}
			pointMap[date] = pt
			dates = append(dates, date)
		}
		pt.Values[value] = count
	}

	results := make([]timeseriesPoint, 0, len(dates))
	for _, d := range dates {
		results = append(results, *pointMap[d])
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func applyFilter(r *http.Request, query string, args []any) (string, []any) {
	filterKey := r.URL.Query().Get("filterKey")
	filterOp := r.URL.Query().Get("filterOp")
	filterValue := r.URL.Query().Get("filterValue")

	if filterKey == "" || filterValue == "" {
		return query, args
	}

	// Subquery: resource must have a current value matching the filter
	op := "="
	switch filterOp {
	case "eq", "":
		op = "="
	case "neq":
		op = "!="
	case "gt":
		op = ">"
	case "gte":
		op = ">="
	case "lt":
		op = "<"
	case "lte":
		op = "<="
	case "like":
		op = "LIKE"
	}

	// Determine column and bind value based on type
	valueCol := "flt.value"
	var bindValue any = filterValue

	if op == "LIKE" {
		// Wrap with wildcards for LIKE
		bindValue = "%" + filterValue + "%"
	} else if f, err := strconv.ParseFloat(filterValue, 64); err == nil {
		valueCol = "COALESCE(flt.value_int, flt.value_float)"
		bindValue = f
	}

	query += ` AND r.id IN (
		SELECT flt.resource_id FROM resource_values flt
		INNER JOIN (
			SELECT resource_id, key, MAX(last_seen) as max_ls
			FROM resource_values WHERE key = ? GROUP BY resource_id, key
		) fl ON flt.resource_id = fl.resource_id AND flt.key = fl.key AND flt.last_seen = fl.max_ls
		WHERE flt.key = ? AND ` + valueCol + ` ` + op + ` ?
	)`
	args = append(args, filterKey, filterKey, bindValue)

	return query, args
}

func sanitizeDateParam(s string) string {
	// Only allow date characters to prevent SQL injection
	clean := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= '0' && c <= '9') || c == '-' {
			clean = append(clean, c)
		}
	}
	return string(clean)
}
