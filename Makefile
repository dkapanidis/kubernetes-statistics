.PHONY: build web go run clean help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

build: web go ## Build web frontend and Go binary

web: ## Build web frontend and copy to embed directory
	cd web && npm ci && npx vite build
	rm -rf internal/api/dist
	cp -r web/dist internal/api/dist

go: ## Build Go binary
	go build -o kubernetes-statistics ./cmd/kubernetes-statistics

run: ## Run the server
	./kubernetes-statistics serve

clean: ## Remove all build artifacts
	rm -rf kubernetes-statistics internal/api/dist web/dist web/node_modules
