"""
run_server.py — Entry point for the Guido Vision Server.

Usage:
    python run_server.py
    VISION_PORT=8000 python run_server.py
"""

import signal
import sys

from server.app import create_app
from server.config import settings


def main() -> None:
    app = create_app()
    pipeline = app.config["PIPELINE"]

    # Graceful shutdown on SIGINT / SIGTERM
    def _shutdown(signum, frame):
        print(f"\n[SHUTDOWN] Signal {signum} received — stopping pipeline...")
        pipeline.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    print(f"[GUIDO VISION] Starting on {settings.host}:{settings.port}")
    app.run(host=settings.host, port=settings.port, threaded=True)


if __name__ == "__main__":
    main()
