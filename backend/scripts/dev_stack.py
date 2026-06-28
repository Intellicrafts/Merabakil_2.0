#!/usr/bin/env python3
"""Launch Auth + Search + Research dev servers (no Docker required)."""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PY = sys.executable
SCRIPTS = os.path.join(ROOT, "backend", "scripts")

procs: list[subprocess.Popen] = []


def _start(script: str) -> subprocess.Popen:
    return subprocess.Popen([PY, os.path.join(SCRIPTS, script)], cwd=ROOT)


def _shutdown(*_: object) -> None:
    for p in procs:
        p.terminate()
    for p in procs:
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill()


def main() -> None:
    print("\n  AI Legal OS — starting local dev stack (no Docker)\n")
    for script in ("dev_auth_server.py", "dev_search_server.py", "dev_research_server.py"):
        procs.append(_start(script))
        time.sleep(1.5)

    print("\n  Auth:     http://localhost:8001/docs")
    print("  Search:   http://localhost:8003/docs")
    print("  Research: http://localhost:8004/docs")
    print("  Frontend: run `make dev-frontend` in another terminal")
    print("  Login:    admin@legalos.in / ChangeMe!2026")
    print("\n  Press Ctrl+C to stop.\n")

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
