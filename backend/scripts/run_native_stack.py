#!/usr/bin/env python3
"""Launch full native stack: Auth + Search (raw-data) + Research + Frontend."""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PY = sys.executable
SCRIPTS = os.path.join(ROOT, "backend", "scripts")
NODE = os.path.join(os.path.expanduser("~"), ".local", "node", "bin")
STOP_SCRIPT = os.path.join(ROOT, "scripts", "stop_native.sh")

procs: list[subprocess.Popen] = []


def _start(args: list[str], *, cwd: str = ROOT, env: dict | None = None) -> subprocess.Popen:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    if os.path.isdir(NODE):
        merged["PATH"] = f"{NODE}:{merged.get('PATH', '')}"
    return subprocess.Popen(args, cwd=cwd, env=merged)


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


def main() -> None:
    print("\n  AI Legal OS — native stack (real raw-data + Gemini)\n")

    if os.path.isfile(STOP_SCRIPT):
        subprocess.run(["bash", STOP_SCRIPT], check=False)
        time.sleep(2)

    procs.append(_start([PY, os.path.join(SCRIPTS, "dev_auth_server.py")]))
    _wait_url("http://localhost:8001/health", timeout_sec=30, label="Auth")

    procs.append(_start([PY, os.path.join(SCRIPTS, "dev_search_server.py")]))
    print("  Waiting for search index (embedding cache; first run may take a few minutes)...", flush=True)
    if not _wait_url("http://localhost:8003/health", timeout_sec=360, label="Search"):
        print("  Search failed to start — check logs", flush=True)
        _shutdown()
        sys.exit(1)

    procs.append(_start([PY, os.path.join(SCRIPTS, "dev_research_server.py")]))
    _wait_url("http://localhost:8004/health", timeout_sec=30, label="Research")

    procs.append(_start([PY, os.path.join(SCRIPTS, "dev_marketplace_server.py")]))
    _wait_url("http://localhost:8010/health", timeout_sec=30, label="Marketplace")

    procs.append(_start(["npm", "run", "dev"], cwd=os.path.join(ROOT, "frontend")))
    _wait_url("http://localhost:3000/login", timeout_sec=60, label="Frontend")

    print("\n  Frontend:  http://localhost:3000")
    print("  Login:     admin@legalos.in / ChangeMe!2026")
    print("  Mera Vakil: http://localhost:3000/mera-vakil\n")
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
