
import os
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8765

# Check whether the backend is already running.
with socket.socket() as sock:
    sock.settimeout(1)
    if sock.connect_ex(("127.0.0.1", PORT)) == 0:
        print("Radio detector is already running.")
        sys.exit(0)

# Use pythonw.exe from the same Python installation.
pythonw = Path(sys.executable).with_name("pythonw.exe")

if not pythonw.is_file():
    print(f"ERROR: pythonw.exe not found: {pythonw}")
    sys.exit(1)

env = os.environ.copy()
env["PYTHONUNBUFFERED"] = "1"
# Preserve the existing automatic GitHub history publishing behavior.
env["PUBLISH_HISTORY_TO_GITHUB"] = "1"

# Write background output and errors to files.
with (
    open(ROOT / "backend-output.txt", "a", encoding="utf-8") as output,
    open(ROOT / "backend-error.txt", "a", encoding="utf-8") as errors,
):
    process = subprocess.Popen(
        [
            str(pythonw),
            "-m", "uvicorn",
            "backend:app",
            "--host", "127.0.0.1",
            "--port", str(PORT),
        ],
        cwd=str(ROOT),
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=output,
        stderr=errors,
        creationflags=(
            subprocess.DETACHED_PROCESS
            | subprocess.CREATE_NEW_PROCESS_GROUP
            | subprocess.CREATE_NO_WINDOW
        ),
        close_fds=True,
    )

print(f"Background detector launched. PID: {process.pid}")
