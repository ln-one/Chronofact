"""Minimal HTTP API for the Chronofact AI explanation MVP."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from chronofact_ai.explainer import explain_evidence


class ExplanationHandler(BaseHTTPRequestHandler):
    server_version = "ChronofactAI/0.1"

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health":
            self._send_json({"status": "ok", "service": "chronofact-ai-explanation"})
            return
        self._send_json({"error": "not_found"}, status=404)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/ai/explain":
            self._send_json({"error": "not_found"}, status=404)
            return

        try:
            payload = self._read_json()
        except ValueError as exc:
            self._send_json({"error": "invalid_json", "message": str(exc)}, status=400)
            return

        explanation = explain_evidence(payload)
        self._send_json(explanation)

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            raise ValueError("request body is required")
        raw = self.rfile.read(length)
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("top-level JSON value must be an object")
        return data

    def _send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), ExplanationHandler)
    print(f"Chronofact AI explanation API running at http://{host}:{port}")
    print("POST /api/ai/explain")
    server.serve_forever()


if __name__ == "__main__":
    run()

