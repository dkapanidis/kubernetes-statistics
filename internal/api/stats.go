package api

import (
	"encoding/json"
	"net/http"
)

type statEntry struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

type statsResponse struct {
	TotalResources int          `json:"totalResources"`
	ByKind         []statEntry  `json:"byKind"`
	ByCluster      []statEntry  `json:"byCluster"`
}

func (s *Server) getStats(w http.ResponseWriter, r *http.Request) {
	var resp statsResponse

	if err := s.db.QueryRow(`SELECT COUNT(*) FROM resources`).Scan(&resp.TotalResources); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// By kind
	rows, err := s.db.Query(`SELECT kind, COUNT(*) as cnt FROM resources GROUP BY kind ORDER BY cnt DESC`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var e statEntry
		if err := rows.Scan(&e.Label, &e.Count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		resp.ByKind = append(resp.ByKind, e)
	}
	rows.Close()

	// By cluster
	rows2, err := s.db.Query(`SELECT cluster, COUNT(*) as cnt FROM resources GROUP BY cluster ORDER BY cnt DESC`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows2.Close()
	for rows2.Next() {
		var e statEntry
		if err := rows2.Scan(&e.Label, &e.Count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		resp.ByCluster = append(resp.ByCluster, e)
	}

	if resp.ByKind == nil {
		resp.ByKind = []statEntry{}
	}
	if resp.ByCluster == nil {
		resp.ByCluster = []statEntry{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
