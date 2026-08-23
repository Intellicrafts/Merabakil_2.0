#!/usr/bin/env python3
"""Launch native stack + Cloudflare Tunnel (single public HTTPS URL for all services)."""
from __future__ import annotations

import os
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PY = sys.executable
SCRIPTS = ROOT / "backend" / "scripts"
NODE = Path.home() / ".local" / "node" / "bin"
STOP_SCRIPT = ROOT / "scripts" / "stop_native.sh"
PUBLIC_ENV = ROOT / "frontend" / ".env.public.example"
FRONTEND_ENV = ROOT / "frontend" / ".env.local"
LOCAL_ENV_BACKUP = ROOT / "frontend" / ".env.local.bak"
TUNNEL_LOG = ROOT / "data" / ".public-tunnel.log"
PUBLIC_URL_FILE = ROOT / "data" / ".public-url"

procs: list[subprocess.Popen] = []


def _start(args: list[str], *, cwd: Path = ROOT, env: dict | None = None) -> subprocess.Popen:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    if NODE.is_dir():
        merged["PATH"] = f"{NODE}:{merged.get('PATH', '')}"
    return subprocess.Popen(args, cwd=str(cwd), env=merged)


def _shutdown(*_: object) -> None:
    for p in procs:
        p.terminate()
    for p in procs:
        try:
            p.wait(timeout=8)
        except subprocess.TimeoutExpired:
            p.kill()


def _wait_url(url: str, *, timeout_sec: int = 360, label: str = "") -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                if resp.status == 200:
                    print(f"  {label or url} ready", flush=True)
                    return True
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(2)
    print(f"  TIMEOUT waiting for {label or url}", flush=True)
    return False


def _apply_public_frontend_env() -> None:
    if not PUBLIC_ENV.is_file():
        print(f"  Missing {PUBLIC_ENV}", flush=True)
        sys.exit(1)
    if FRONTEND_ENV.is_file() and not LOCAL_ENV_BACKUP.is_file():
        shutil.copy2(FRONTEND_ENV, LOCAL_ENV_BACKUP)
        print("  Backed up frontend/.env.local → frontend/.env.local.bak", flush=True)
    shutil.copy2(PUBLIC_ENV, FRONTEND_ENV)
    print("  Applied public API proxy env (frontend/.env.local)", flush=True)


def _ensure_cloudflared() -> str:
    path = shutil.which("cloudflared")
    if path:
        return path
    local = Path.home() / ".local" / "bin" / "cloudflared"
    if local.is_file():
        return str(local)
    print("  cloudflared not found. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/", flush=True)
    sys.exit(1)


def _start_tunnel(frontend_port: int = 3000) -> str | None:
    TUNNEL_LOG.parent.mkdir(parents=True, exist_ok=True)
    cf = _ensure_cloudflared()
    proc = subprocess.Popen(
        [cf, "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{frontend_port}"],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    procs.append(proc)
    pattern = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
    public_url = None
    log_lines: list[str] = []
    deadline = time.time() + 90
    while time.time() < deadline:
        line = proc.stdout.readline() if proc.stdout else ""
        if line:
            log_lines.append(line)
            match = pattern.search(line)
            if match:
                public_url = match.group(0)
                break
        elif proc.poll() is not None:
            break
        else:
            time.sleep(0.2)
    TUNNEL_LOG.write_text("".join(log_lines))
    if public_url:
        PUBLIC_URL_FILE.write_text(public_url + "\n")
    return public_url


def _verify_proxy(frontend_port: int = 3000) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{frontend_port}/svc/auth/health", timeout=5) as resp:
            return resp.status == 200
    except (urllib.error.URLError, TimeoutError):
        return False


def main() -> None:
    public = os.getenv("LEGALOS_PUBLIC_MODE", "").lower() in {"1", "true", "yes"}
    frontend_port = int(os.getenv("PUBLIC_FRONTEND_PORT", "3000"))

    print("\n  AI Legal OS — native stack (real raw-data + Gemini)\n")
    if public:
        print("  Mode: PUBLIC (Cloudflare Tunnel + /svc API proxy)\n")
        _apply_public_frontend_env()

    if STOP_SCRIPT.is_file():
        stop_env = {**os.environ, "SKIP_PUBLIC_ORCHESTRATOR": "1"}
        subprocess.run(["bash", str(STOP_SCRIPT)], check=False, env=stop_env)
        time.sleep(2)

    procs.append(_start([PY, str(SCRIPTS / "dev_auth_server.py")]))
    _wait_url("http://localhost:8001/health", timeout_sec=30, label="Auth")

    procs.append(_start([PY, str(SCRIPTS / "dev_search_server.py")]))
    print("  Waiting for search index (embedding cache; first run may take a few minutes)...", flush=True)
    if not _wait_url("http://localhost:8003/health", timeout_sec=360, label="Search"):
        print("  Search failed to start — check logs", flush=True)
        _shutdown()
        sys.exit(1)

    procs.append(_start([PY, str(SCRIPTS / "dev_research_server.py")]))
    _wait_url("http://localhost:8004/health", timeout_sec=30, label="Research")

    procs.append(_start([PY, str(SCRIPTS / "dev_marketplace_server.py")]))
    _wait_url("http://localhost:8010/health", timeout_sec=30, label="Marketplace")

    node_tools = Path(ROOT / ".tools" / "node-v22.18.0-linux-x64" / "bin")
    frontend_env = {}
    if node_tools.is_dir():
        frontend_env["PATH"] = f"{node_tools}:{os.environ.get('PATH', '')}"

    if public:
        print("  Building optimized production frontend …", flush=True)
        build = subprocess.run(
            ["npm", "run", "build"],
            cwd=str(ROOT / "frontend"),
            env={**os.environ, **frontend_env},
        )
        if build.returncode != 0:
            print("  Frontend production build failed", flush=True)
            _shutdown()
            sys.exit(1)
        frontend_args = ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", str(frontend_port)]
    else:
        frontend_args = ["npm", "run", "dev"]

    procs.append(_start(frontend_args, cwd=ROOT / "frontend", env=frontend_env))
    _wait_url(f"http://127.0.0.1:{frontend_port}/login", timeout_sec=90, label="Frontend")

    if public:
        if _verify_proxy(frontend_port):
            print("  API proxy verified (/svc/auth → :8001)", flush=True)
        else:
            print("  WARNING: API proxy check failed — restart frontend after env change", flush=True)
        print("  Starting Cloudflare Tunnel …", flush=True)
        public_url = _start_tunnel(frontend_port)
        if public_url:
            print("\n  ════════════════════════════════════════════════════════")
            print(f"  Global URL:  {public_url}")
            print("  Login:       admin@legalos.in / ChangeMe!2026")
            print("  ════════════════════════════════════════════════════════\n")
        else:
            print("  Could not obtain public URL — see data/.public-tunnel.log", flush=True)
    else:
        print("\n  Frontend:  http://localhost:3000")
        print("  Login:     admin@legalos.in / ChangeMe!2026")
        print("  Citizen:   citizen@legalos.in / ChangeMe!2026")
        print("  Advocate:  advocate@legalos.in / ChangeMe!2026")
        print("  Marketplace: http://localhost:3000/lawyer-marketplace")
        print("\n  Global access:  make public\n")

    print("  Press Ctrl+C to stop.\n")

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)
    try:
        while any(p.poll() is None for p in procs):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        _shutdown()


if __name__ == "__main__":
    main()
