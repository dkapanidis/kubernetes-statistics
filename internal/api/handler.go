package api

import (
	"database/sql"
	"net/http"
)

type Server struct {
	db  *sql.DB
	mux *http.ServeMux
}

func NewServer(db *sql.DB) *Server {
	s := &Server{db: db, mux: http.NewServeMux()}
	s.mux.HandleFunc("GET /api/resources", s.listResources)
	s.mux.HandleFunc("GET /api/resources/{id}", s.getResource)
	s.mux.HandleFunc("GET /api/stats", s.getStats)
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// CORS headers for development
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}
	s.mux.ServeHTTP(w, r)
}
