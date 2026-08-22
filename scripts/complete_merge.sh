#!/usr/bin/env bash
# Finish git merge after fixing .git permissions (run once):
#   sudo chown -R "$USER:$USER" .git
# Then:
#   bash scripts/complete_merge.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -w .git/objects ]]; then
  echo "Fix git permissions first:"
  echo "  sudo chown -R \$USER:\$USER .git"
  exit 1
fi

echo "Stashing/committing current integrated tree …"
git add -A
git commit -m "feat: appointment ops module merged with origin/main (voice, brand UI)" || true

echo "Merging origin/main …"
git fetch origin main
git merge origin/main -m "merge: origin/main voice + brand into appointment module" || {
  echo "Resolve conflicts if any, then: git add -A && git commit"
  exit 1
}

echo "Done. Branch is up to date with integrated module + latest main."
