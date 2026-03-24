package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/dkapanidis/kubernetes-statistics/internal/api"
	"github.com/dkapanidis/kubernetes-statistics/internal/db"
)

func main() {
	dbPath := flag.String("db", "kubernetes-statistics.db", "Path to SQLite database")
	port := flag.String("port", "8080", "Port to listen on")
	flag.Parse()

	database, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer database.Close()

	server := api.NewServer(database)

	log.Printf("Server listening on :%s", *port)
	if err := http.ListenAndServe(":"+*port, server); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
