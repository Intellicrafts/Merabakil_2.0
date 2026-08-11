#!/usr/bin/env python3
"""Research service — native mode with real Gemini LLM + TTS."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "backend" / "scripts"))
from dev_bootstrap import bootstrap_dev_env  # noqa: E402

bootstrap_dev_env(_ROOT)

sys.path[:0] = [
    str(_ROOT / "backend" / "libs" / "legalos_common"),
    str(_ROOT / "backend" / "orchestrator"),
    str(_ROOT / "backend" / "services" / "research"),
]

from app.config import get_settings  # noqa: E402
from app.infrastructure.container import init_container  # noqa: E402
from app.main import app  # noqa: E402

settings = get_settings()
init_container(settings)

if __name__ == "__main__":
    import uvicorn

    stub = settings.llm.llm_use_stub
    print(f"Research (native) http://localhost:8004/docs — LLM stub={stub}")
    if stub:
        print("NOTE: LLM_USE_STUB=true — offline deterministic answers only")
    else:
        print("NOTE: Gemini primary with automatic offline fallback if the API is unavailable")
    uvicorn.run(app, host="0.0.0.0", port=8004, log_level="info")
