import sys
from pathlib import Path

SERVICE_DIRECTORY = str(Path(__file__).resolve().parent.parent)

if SERVICE_DIRECTORY not in sys.path:
    sys.path.insert(0, SERVICE_DIRECTORY)
