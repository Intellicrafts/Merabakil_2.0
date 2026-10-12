import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)
os.chdir(ROOT)  # settings read certs/ and app/core/urls.yaml relative to the service root

# Settings load RSA keys at import; generate throwaway ones for tests (certs/ is gitignored).
if not os.path.exists(os.path.join(ROOT, "certs", "private.pem")):
    subprocess.run([sys.executable, "scripts/gen_keys.py"], check=True, capture_output=True)
