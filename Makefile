.DEFAULT_GOAL := help
COMPOSE := docker compose -f infrastructure/docker-compose.yml --env-file .env

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

.PHONY: dev
dev: env ## Run locally without Docker (Auth + Search + Research)
	. .venv/bin/activate && python backend/scripts/dev_stack.py

.PHONY: dev-frontend
dev-frontend: ## Run Next.js frontend (requires backend dev stack)
	cd frontend && cp -n .env.local.example .env.local 2>/dev/null; \
	PATH="$$HOME/.local/node/bin:$$PATH" npm install && PATH="$$HOME/.local/node/bin:$$PATH" npm run dev

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
