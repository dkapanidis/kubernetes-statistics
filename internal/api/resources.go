package api

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type resourceResponse struct {
	ID        int64  `json:"id"`
	Cluster   string `json:"cluster"`
	Namespace string `json:"namespace"`
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	FirstSeen string `json:"firstSeen"`
	LastSeen  string `json:"lastSeen"`
}

type resourceDetailResponse struct {
	resourceResponse
	Values []valueResponse `json:"values"`
}

type valueResponse struct {
	Key       string   `json:"key"`
	Value     string   `json:"value"`
	ValueInt  *int64   `json:"valueInt,omitempty"`
	ValueFloat *float64 `json:"valueFloat,omitempty"`
	FirstSeen string   `json:"firstSeen"`
	LastSeen  string   `json:"lastSeen"`
}

func (s *Server) listResources(w http.ResponseWriter, r *http.Request) {
	query := `SELECT id, cluster, namespace, kind, name, first_seen, last_seen FROM resources WHERE 1=1`
	var args []any

	if v := r.URL.Query().Get("cluster"); v != "" {
		query += ` AND cluster = ?`
		args = append(args, v)
	}
	if v := r.URL.Query().Get("namespace"); v != "" {
		query += ` AND namespace = ?`
		args = append(args, v)
	}
	if v := r.URL.Query().Get("kind"); v != "" {
		query += ` AND kind = ?`
		args = append(args, v)
	}

	query += ` ORDER BY cluster, namespace, kind, name`

	limit := 100
	if v := r.URL.Query().Get("limit"); v != "" {
		if l, err := strconv.Atoi(v); err == nil && l > 0 && l <= 1000 {
			limit = l
		}
	}
	offset := 0
	if v := r.URL.Query().Get("offset"); v != "" {
		if o, err := strconv.Atoi(v); err == nil && o >= 0 {
			offset = o
		}
	}
	query += ` LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var resources []resourceResponse
	for rows.Next() {
		var r resourceResponse
		if err := rows.Scan(&r.ID, &r.Cluster, &r.Namespace, &r.Kind, &r.Name, &r.FirstSeen, &r.LastSeen); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		resources = append(resources, r)
	}

	if resources == nil {
		resources = []resourceResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resources)
}

func (s *Server) getResource(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var res resourceDetailResponse
	err := s.db.QueryRow(
		`SELECT id, cluster, namespace, kind, name, first_seen, last_seen FROM resources WHERE id = ?`, id,
	).Scan(&res.ID, &res.Cluster, &res.Namespace, &res.Kind, &res.Name, &res.FirstSeen, &res.LastSeen)
	if err != nil {
		http.Error(w, "resource not found", http.StatusNotFound)
		return
	}

	rows, err := s.db.Query(`
		SELECT rv.key, rv.value, rv.value_int, rv.value_float, rv.first_seen, rv.last_seen
		FROM resource_values rv
		INNER JOIN (
			SELECT key, MAX(last_seen) as max_ls
			FROM resource_values
			WHERE resource_id = ?
			GROUP BY key
		) latest ON rv.key = latest.key AND rv.last_seen = latest.max_ls
		WHERE rv.resource_id = ?
		ORDER BY rv.key
	`, id, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var v valueResponse
		if err := rows.Scan(&v.Key, &v.Value, &v.ValueInt, &v.ValueFloat, &v.FirstSeen, &v.LastSeen); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		res.Values = append(res.Values, v)
	}
	if res.Values == nil {
		res.Values = []valueResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}
