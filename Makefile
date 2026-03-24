.PHONY: build-ingest build-server build test run-server run-ingest

build: build-ingest build-server

build-ingest:
	go build -o bin/ingest ./cmd/ingest

build-server:
	go build -o bin/server ./cmd/server

test:
	go test ./...

run-server:
	go run ./cmd/server --db kubernetes-statistics.db --port 8080

run-ingest:
	go run ./cmd/ingest --data-dir $(DATA_DIR) --db kubernetes-statistics.db
