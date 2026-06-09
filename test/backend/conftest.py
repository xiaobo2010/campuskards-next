"""Re-export shared test fixtures from backend/tests/conftest.py."""
import sys
from pathlib import Path

# Ensure backend package is importable
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from tests.conftest import event_loop, setup_db, db, client
