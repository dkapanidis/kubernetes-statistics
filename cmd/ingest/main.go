package main

import (
	"flag"
	"log"
	"time"

	"github.com/dkapanidis/kubernetes-statistics/internal/db"
	"github.com/dkapanidis/kubernetes-statistics/internal/ingestion"
)

func main() {
	dataDir := flag.String("data-dir", "", "Path to directory with YAML files (cluster/namespace/kind/name.yaml)")
	dbPath := flag.String("db", "kubernetes-statistics.db", "Path to SQLite database")
	flag.Parse()

	if *dataDir == "" {
		log.Fatal("--data-dir is required")
	}

	database, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer database.Close()

	log.Printf("Walking %s ...", *dataDir)
	resources, err := ingestion.Walk(*dataDir)
	if err != nil {
		log.Fatalf("Failed to walk directory: %v", err)
	}
	log.Printf("Discovered %d resources", len(resources))

	runTime := time.Now().UTC()
	stats, err := ingestion.Sync(database, resources, runTime)
	if err != nil {
		log.Fatalf("Failed to sync: %v", err)
	}

	log.Printf("Sync complete: processed=%d new=%d updated=%d deleted=%d values_new=%d values_changed=%d values_closed=%d",
		stats.ResourcesProcessed, stats.ResourcesNew, stats.ResourcesUpdated, stats.ResourcesDeleted,
		stats.ValuesNew, stats.ValuesChanged, stats.ValuesClosed)
}
