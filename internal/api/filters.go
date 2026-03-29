package api

import (
	"encoding/json"
	"net/http"
)

type filterOptionsResponse struct {
	Clusters   []string `json:"clusters"`
	Namespaces []string `json:"namespaces"`
	Kinds      []string `json:"kinds"`
	Names      []string `json:"names"`
	Sources    []string `json:"sources"`
}

func (s *Server) getFilterOptions(w http.ResponseWriter, r *http.Request) {
	resp := filterOptionsResponse{
		Clusters:   []string{},
		Namespaces: []string{},
		Kinds:      []string{},
		Names:      []string{},
		Sources:    []string{},
	}

	allowedColumns := map[string]bool{"cluster": true, "namespace": true, "kind": true, "name": true, "source": true}

	type Column string
	const (
		Cluster   Column = "cluster"
		Namespace Column = "namespace"
		Kind      Column = "kind"
		Name      Column = "name"
		Source    Column = "source"
	)

	queryDistinct := func(column Column) ([]string, error) {
		if !allowedColumns[string(column)] {
			return nil, nil
		}
		rows, err := s.db.Query("SELECT DISTINCT " + string(column) + " FROM resources WHERE deleted = 0 ORDER BY " + string(column))
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var vals []string
		for rows.Next() {
			var v string
			if err := rows.Scan(&v); err != nil {
				return nil, err
			}
			vals = append(vals, v)
		}
		if vals == nil {
			vals = []string{}
		}
		return vals, nil
	}

	var err error
	if resp.Clusters, err = queryDistinct(Cluster); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if resp.Namespaces, err = queryDistinct(Namespace); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if resp.Kinds, err = queryDistinct(Kind); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if resp.Names, err = queryDistinct(Name); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if resp.Sources, err = queryDistinct(Source); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
