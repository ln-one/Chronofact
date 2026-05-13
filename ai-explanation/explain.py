"""CLI helper for explaining a mock evidence JSON file."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from chronofact_ai.explainer import explain_evidence


def main() -> None:
    parser = argparse.ArgumentParser(description="Chronofact AI explanation MVP")
    parser.add_argument("input", type=Path, help="Path to structured evidence JSON")
    args = parser.parse_args()

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    result = explain_evidence(payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

