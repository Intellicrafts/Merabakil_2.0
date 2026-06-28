# AI Legal OS - Windows PowerShell runner (drop-in replacement for `make`).
#
# Usage:
#   .\run.ps1 up        # build + start the full stack (detached)
#   .\run.ps1 down      # stop the stack
#   .\run.ps1 clean     # stop + remove volumes
#   .\run.ps1 logs      # tail logs
#   .\run.ps1 ps        # service status
#   .\run.ps1 seed      # seed roles/permissions + admin user
#   .\run.ps1 migrate   # run Alembic migrations
#   .\run.ps1 readmes   # regenerate data/*/README.md from corpus_registry.yaml

param(
    [Parameter(Position = 0)]
    [ValidateSet("up", "down", "clean", "logs", "ps", "seed", "migrate", "readmes", "help")]
    [string]$Command = "help"
)

$ErrorActionPreference = "Stop"
$ComposeFile = "infrastructure/docker-compose.yml"

function Ensure-Env {
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Host "Created .env from .env.example" -ForegroundColor Green
    }
}

function Require-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "Docker is not installed or not on PATH." -ForegroundColor Red
        Write-Host "Install Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
        Write-Host "After installing, restart PowerShell and run this script again." -ForegroundColor Yellow
        exit 1
    }
}

switch ($Command) {
    "up" {
        Require-Docker
        Ensure-Env
        docker compose -f $ComposeFile --env-file .env up --build -d
        Write-Host ""
        Write-Host "Stack starting. Open http://localhost:3000 once services are healthy." -ForegroundColor Green
        Write-Host "Run '.\run.ps1 migrate' then '.\run.ps1 seed' on first boot." -ForegroundColor Green
    }
    "down" {
        Require-Docker
        docker compose -f $ComposeFile --env-file .env down
    }
    "clean" {
        Require-Docker
        docker compose -f $ComposeFile --env-file .env down -v
    }
    "logs" {
        Require-Docker
        docker compose -f $ComposeFile --env-file .env logs -f
    }
    "ps" {
        Require-Docker
        docker compose -f $ComposeFile --env-file .env ps
    }
    "seed" {
        Require-Docker
        docker compose -f $ComposeFile --env-file .env exec auth python -m app.seed
    }
    "migrate" {
        Require-Docker
        docker compose -f $ComposeFile --env-file .env exec auth alembic upgrade head
    }
    "readmes" {
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
            Write-Host "Node.js is required for this command." -ForegroundColor Red
            exit 1
        }
        node backend/scripts/sync_data_readmes.cjs
    }
    default {
        Write-Host "AI Legal OS - Windows runner" -ForegroundColor Cyan
        Write-Host "Commands: up | down | clean | logs | ps | seed | migrate | readmes"
        Write-Host "Example:  .\run.ps1 up"
    }
}
