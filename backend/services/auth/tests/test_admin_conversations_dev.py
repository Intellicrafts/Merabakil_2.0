"""Dev-store admin Saarthi conversation ops (native stack, no Postgres)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SCRIPT = ROOT / "backend" / "scripts" / "test_dev_admin_conversations.py"


def test_dev_admin_conversations_smoke() -> None:
    """Run the native dev admin conversations smoke script."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
