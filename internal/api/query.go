package api

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// resourceLevelFields maps groupBy values that refer to columns on the resources table.
// These values are never user-supplied — they come from a hardcoded allowlist.
var resourceLevelFields = map[string]string{
	"kind":      "r.kind",
	"cluster":   "r.cluster",
	"namespace": "r.namespace",
	"name":      "r.name",
}

type groupByResult struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type timeseriesPoint struct {
	Date   string         `json:"date"`
	Values map[string]int `json:"values"`
}

// GET /api/keys?kind=PostgresCluster&search=spec.&limit=100
// Returns distinct keys for a given kind, optionally filtered by prefix search.
func (s *Server) getKeys(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	search := r.URL.Query().Get("search")

	limit := 100
	if v := r.URL.Query().Get("limit"); v != "" {
		if l, err := strconv.Atoi(v); err == nil && l > 0 && l <= 10000 {
			limit = l
		}
	}

	query := ""
	var args []any

	if kind != "" {
		query = `SELECT DISTINCT rv.key FROM resource_values rv
			JOIN resources r ON r.id = rv.resource_id
			WHERE r.kind = ?`
		args = append(args, kind)
	} else {
		query = `SELECT DISTINCT key AS key FROM resource_values WHERE 1=1`
	}

	if search != "" {
		query += ` AND LOWER(key) LIKE LOWER(?)`
		args = append(args, "%"+search+"%")
	}

	query += ` ORDER BY key LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
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
// kind is optional (omit or use "*" for all resources).
// groupBy can be a resource field (kind, cluster, namespace, name) or a key-value key.
func (s *Server) queryGroupBy(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	groupBy := r.URL.Query().Get("groupBy")
	if groupBy == "" {
		http.Error(w, "groupBy parameter required", http.StatusBadRequest)
		return
	}

	var query string
	var args []any

	if col, ok := resourceLevelFields[groupBy]; ok {
		// Group by a resource-level field
		query = `SELECT ` + col + ` as value, COUNT(*) as cnt FROM resources r WHERE r.deleted = 0`
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += ` GROUP BY ` + col + ` ORDER BY cnt DESC`
	} else {
		// Group by a key-value key
		query = `
			SELECT grp.value, COUNT(DISTINCT grp.resource_id) as cnt
			FROM resource_values grp
			JOIN resources r ON r.id = grp.resource_id
			INNER JOIN (
				SELECT resource_id, key, MAX(last_seen) as max_ls
				FROM resource_values GROUP BY resource_id, key
			) latest ON grp.resource_id = latest.resource_id AND grp.key = latest.key AND grp.last_seen = latest.max_ls
			WHERE r.deleted = 0 AND grp.key = ?
		`
		args = append(args, groupBy)
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += ` GROUP BY grp.value ORDER BY cnt DESC`
	}

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

type stackedResult struct {
	Value  string         `json:"value"`
	Stacks map[string]int `json:"stacks"`
}

// GET /api/query/stacked?kind=Pod&groupBy=cluster&stackBy=namespace
// Returns counts grouped by groupBy, with sub-counts broken down by stackBy.
func (s *Server) queryStackedGroupBy(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	groupBy := r.URL.Query().Get("groupBy")
	stackBy := r.URL.Query().Get("stackBy")
	if groupBy == "" || stackBy == "" {
		http.Error(w, "groupBy and stackBy parameters required", http.StatusBadRequest)
		return
	}

	// Resolve groupBy and stackBy columns/joins
	groupByCol, groupByIsResource := resourceLevelFields[groupBy]
	stackByCol, stackByIsResource := resourceLevelFields[stackBy]

	var query string
	var args []any

	switch {
	case groupByIsResource && stackByIsResource:
		// Both are resource-level fields
		query = `SELECT ` + groupByCol + ` as grp, ` + stackByCol + ` as stk, COUNT(*) as cnt
			FROM resources r WHERE r.deleted = 0`
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += ` GROUP BY grp, stk ORDER BY cnt DESC`

	case groupByIsResource && !stackByIsResource:
		// groupBy is resource-level, stackBy is a key-value key
		query = `SELECT ` + groupByCol + ` as grp, stk_rv.value as stk, COUNT(DISTINCT r.id) as cnt
			FROM resources r
			JOIN resource_values stk_rv ON r.id = stk_rv.resource_id
			INNER JOIN (
				SELECT resource_id, key, MAX(last_seen) as max_ls
				FROM resource_values WHERE key = ? GROUP BY resource_id, key
			) stk_latest ON stk_rv.resource_id = stk_latest.resource_id AND stk_rv.key = stk_latest.key AND stk_rv.last_seen = stk_latest.max_ls
			WHERE r.deleted = 0 AND stk_rv.key = ?`
		args = append(args, stackBy, stackBy)
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += ` GROUP BY grp, stk ORDER BY cnt DESC`

	case !groupByIsResource && stackByIsResource:
		// groupBy is key-value, stackBy is resource-level
		query = `SELECT grp_rv.value as grp, ` + stackByCol + ` as stk, COUNT(DISTINCT r.id) as cnt
			FROM resources r
			JOIN resource_values grp_rv ON r.id = grp_rv.resource_id
			INNER JOIN (
				SELECT resource_id, key, MAX(last_seen) as max_ls
				FROM resource_values WHERE key = ? GROUP BY resource_id, key
			) grp_latest ON grp_rv.resource_id = grp_latest.resource_id AND grp_rv.key = grp_latest.key AND grp_rv.last_seen = grp_latest.max_ls
			WHERE r.deleted = 0 AND grp_rv.key = ?`
		args = append(args, groupBy, groupBy)
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += ` GROUP BY grp, stk ORDER BY cnt DESC`

	default:
		// Both are key-value keys
		query = `SELECT grp_rv.value as grp, stk_rv.value as stk, COUNT(DISTINCT r.id) as cnt
			FROM resources r
			JOIN resource_values grp_rv ON r.id = grp_rv.resource_id
			INNER JOIN (
				SELECT resource_id, key, MAX(last_seen) as max_ls
				FROM resource_values WHERE key = ? GROUP BY resource_id, key
			) grp_latest ON grp_rv.resource_id = grp_latest.resource_id AND grp_rv.key = grp_latest.key AND grp_rv.last_seen = grp_latest.max_ls
			JOIN resource_values stk_rv ON r.id = stk_rv.resource_id
			INNER JOIN (
				SELECT resource_id, key, MAX(last_seen) as max_ls
				FROM resource_values WHERE key = ? GROUP BY resource_id, key
			) stk_latest ON stk_rv.resource_id = stk_latest.resource_id AND stk_rv.key = stk_latest.key AND stk_rv.last_seen = stk_latest.max_ls
			WHERE r.deleted = 0 AND grp_rv.key = ? AND stk_rv.key = ?`
		args = append(args, groupBy, stackBy, groupBy, stackBy)
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += ` GROUP BY grp, stk ORDER BY cnt DESC`
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Collect into map preserving order
	resultMap := map[string]*stackedResult{}
	var order []string
	for rows.Next() {
		var grp, stk string
		var cnt int
		if err := rows.Scan(&grp, &stk, &cnt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		sr, ok := resultMap[grp]
		if !ok {
			sr = &stackedResult{Value: grp, Stacks: map[string]int{}}
			resultMap[grp] = sr
			order = append(order, grp)
		}
		sr.Stacks[stk] = cnt
	}

	results := make([]stackedResult, 0, len(order))
	for _, k := range order {
		results = append(results, *resultMap[k])
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// GET /api/query/timeseries?kind=PostgresCluster&groupBy=spec.postgresVersion&start=2026-01-01&end=2026-03-24&interval=day
// Returns time-series of counts grouped by value, using SCD date expansion.
// kind is optional (omit or "*" for all). groupBy can be a resource field or key-value key.
func (s *Server) queryTimeseries(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	groupBy := r.URL.Query().Get("groupBy")
	start := r.URL.Query().Get("start")
	end := r.URL.Query().Get("end")
	if groupBy == "" {
		http.Error(w, "groupBy parameter required", http.StatusBadRequest)
		return
	}

	// Default date range: last 7 days
	var startParam, endParam string
	var startIsDefault, endIsDefault bool
	if start == "" {
		startIsDefault = true
	} else {
		startParam = sanitizeDateParam(start)
	}
	if end == "" {
		endIsDefault = true
	} else {
		endParam = sanitizeDateParam(end)
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

	// Build the date CTE with parameterized start/end
	var dateArgs []any
	var startExpr, endExpr string
	if startIsDefault {
		startExpr = "date('now', '-7 days')"
	} else {
		startExpr = "date(?)"
		dateArgs = append(dateArgs, startParam)
	}
	if endIsDefault {
		endExpr = "date('now')"
	} else {
		endExpr = "date(?)"
		dateArgs = append(dateArgs, endParam)
	}

	// dateStep comes from a fixed switch, safe to interpolate
	dateCTE := `WITH RECURSIVE dates(d) AS (
		SELECT ` + startExpr + `
		UNION ALL
		SELECT DATE(d, '` + dateStep + `') FROM dates WHERE d < ` + endExpr + `
	) `

	var query string
	var args []any
	args = append(args, dateArgs...)

	if col, ok := resourceLevelFields[groupBy]; ok {
		// Resource-level field: expand dates against resources table directly
		query = dateCTE + `
			SELECT dates.d, ` + col + `, COUNT(*)
			FROM dates
			JOIN resources r ON DATE(r.first_seen) <= dates.d AND DATE(r.last_seen) >= dates.d
			WHERE 1=1
		`
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += `
			GROUP BY dates.d, ` + col + `
			ORDER BY dates.d, ` + col + `
		`
	} else {
		// Key-value key: existing behavior
		query = dateCTE + `
			SELECT dates.d, rv.value, COUNT(DISTINCT rv.resource_id)
			FROM dates
			JOIN resource_values rv ON DATE(rv.first_seen) <= dates.d AND DATE(rv.last_seen) >= dates.d AND rv.key = ?
			JOIN resources r ON r.id = rv.resource_id
			WHERE 1=1
		`
		args = append(args, groupBy)
		if kind != "" && kind != "*" {
			query += ` AND r.kind = ?`
			args = append(args, kind)
		}
		query, args = applyFilter(r, query, args)
		query += `
			GROUP BY dates.d, rv.value
			ORDER BY dates.d, rv.value
		`
	}

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
	// Only allow known operators to prevent injection
	allowedOps := map[string]string{
		"eq": "=", "": "=",
		"neq": "!=", "gt": ">", "gte": ">=",
		"lt": "<", "lte": "<=", "like": "LIKE",
	}
	op, ok := allowedOps[filterOp]
	if !ok {
		return query, args
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

// applyResourceFilter is like applyFilter but for queries where resources table has no alias.
func applyResourceFilter(r *http.Request, query string, args []any) (string, []any) {
	filterKey := r.URL.Query().Get("filterKey")
	filterOp := r.URL.Query().Get("filterOp")
	filterValue := r.URL.Query().Get("filterValue")

	if filterKey == "" || filterValue == "" {
		return query, args
	}

	allowedOps := map[string]string{
		"eq": "=", "": "=",
		"neq": "!=", "gt": ">", "gte": ">=",
		"lt": "<", "lte": "<=", "like": "LIKE",
	}
	op, ok := allowedOps[filterOp]
	if !ok {
		return query, args
	}

	valueCol := "flt.value"
	var bindValue any = filterValue

	if op == "LIKE" {
		bindValue = "%" + filterValue + "%"
	} else if f, err := strconv.ParseFloat(filterValue, 64); err == nil {
		valueCol = "COALESCE(flt.value_int, flt.value_float)"
		bindValue = f
	}

	query += ` AND id IN (
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
