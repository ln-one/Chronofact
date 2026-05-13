"""Start the Chronofact AI explanation HTTP API."""

import os

from chronofact_ai.server import run


if __name__ == "__main__":
    host = os.environ.get("CHRONOFACT_AI_HOST", "127.0.0.1")
    port = int(os.environ.get("CHRONOFACT_AI_PORT", "8000"))
    run(host=host, port=port)
