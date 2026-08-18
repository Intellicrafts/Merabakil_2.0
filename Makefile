.DEFAULT_GOAL := help
COMPOSE := bash scripts/docker-compose.sh

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.PHONY: env
env: ## Create .env from template if missing
	@test -f .env || cp .env.example .env

.PHONY: up
up: env ## Build and start the full stack
	$(COMPOSE) up --build -d

.PHONY: down
down: ## Stop the stack
	$(COMPOSE) down

.PHONY: clean
clean: ## Stop the stack and remove volumes
	$(COMPOSE) down -v

.PHONY: logs
logs: ## Tail logs
	$(COMPOSE) logs -f

.PHONY: ps
ps: ## Show running services
	$(COMPOSE) ps

.PHONY: seed
seed: ## Seed roles, permissions and an admin user
	$(COMPOSE) exec auth python -m app.seed

.PHONY: migrate
migrate: ## Run Alembic migrations for the auth service
	$(COMPOSE) exec auth alembic upgrade head

.PHONY: stop-native
stop-native: ## Stop native dev stack processes
	bash scripts/stop_native.sh

.PHONY: native
native: env ## Run native stack with raw-data + Gemini (no Docker)
	bash scripts/stop_native.sh 2>/dev/null || true
	. .venv/bin/activate && python backend/scripts/run_native_stack.py

.PHONY: dev
dev: env ## Run locally without Docker (Auth + Search + Research)
	. .venv/bin/activate && python backend/scripts/dev_stack.py

.PHONY: dev-frontend
dev-frontend: ## Run Next.js frontend (requires backend dev stack)
	cd frontend && cp -n .env.local.example .env.local 2>/dev/null; \
	PATH="$$HOME/.local/node/bin:$$PATH" npm install && PATH="$$HOME/.local/node/bin:$$PATH" npm run dev

.PHONY: bulk-ingest
bulk-ingest: ## Incremental ingest of raw-data/ into Qdrant + OpenSearch
	. .venv/bin/activate && python data-platform/workers/bulk_ingest_raw_data.py

.PHONY: embed-corpus
embed-corpus: ## Warm native embedding cache (SOURCE=path for one file)
	. .venv/bin/activate && python backend/scripts/embed_corpus.py $(if $(SOURCE),--source "$(SOURCE)",)

.PHONY: eval-rag
eval-rag: ## Run RAG benchmark evaluation (requires TOKEN or running stack)
	. .venv/bin/activate && python backend/scripts/eval_rag.py

.PHONY: setup-docker
setup-docker: ## Fix Docker socket permissions (requires sudo once)
	bash scripts/setup_docker.sh

.PHONY: health
health: ## Check health of all core services
	bash scripts/health_check.sh

.PHONY: post-setup
post-setup: ## Seed + bulk ingest + eval (stack must be running)
	bash scripts/post_docker_setup.sh

.PHONY: production
production: ## Full bootstrap: up + seed + ingest + eval
	bash scripts/run_production_stack.sh

.PHONY: sync-readmes
sync-readmes: ## Regenerate data/*/README.md from corpus_registry.yaml
	node backend/scripts/sync_data_readmes.cjs

.PHONY: load-test
load-test: ## Run search/research load smoke (requires TOKEN=...)
	cd backend && python scripts/load_test.py --token "$(TOKEN)" -n 10

.PHONY: test
test: ## Run all Phase 1 backend test suites (isolated per service)
	cd backend && bash scripts/run_tests.sh

.PHONY: lint
lint: ## Lint and type-check backend
	cd backend && uv run ruff check . && uv run mypy libs services

.PHONY: fmt
fmt: ## Format backend code
	cd backend && uv run ruff format .
