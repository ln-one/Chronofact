#!/usr/bin/env python3

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BASE_COMPOSE = ROOT / "compose.yaml"
LOCAL_OVERRIDE = ROOT / "compose.local-sources.yaml"
CHRONESTIA_DIR = ROOT / "services" / "chronestia"


def has_local_chronestia() -> bool:
    if not CHRONESTIA_DIR.exists():
        return False

    git_dir = CHRONESTIA_DIR / ".git"
    dockerfile = CHRONESTIA_DIR / "Dockerfile"
    return git_dir.exists() and dockerfile.exists()


def compose_files() -> list[str]:
    files = ["-f", str(BASE_COMPOSE)]
    if has_local_chronestia():
        files.extend(["-f", str(LOCAL_OVERRIDE)])
    return files


def run_compose(args: list[str]) -> int:
    command = ["docker", "compose", *compose_files(), *args]
    return subprocess.run(command, cwd=ROOT).returncode


def cmd_status(_: argparse.Namespace) -> int:
    mode = "local source build" if has_local_chronestia() else "published image"
    print(f"Chronestia mode: {mode}")
    if has_local_chronestia():
        print(f"Source path: {CHRONESTIA_DIR}")
        print(f"Override file: {LOCAL_OVERRIDE}")
    else:
        print("Image source: compose.yaml -> CHRONESTIA_IMAGE")
    return 0


def cmd_up(args: argparse.Namespace) -> int:
    compose_args: list[str] = ["up"]
    if args.detach:
        compose_args.append("-d")
    if has_local_chronestia():
        compose_args.append("--build")
    compose_args.extend(args.services or [])
    return run_compose(compose_args)


def cmd_down(_: argparse.Namespace) -> int:
    return run_compose(["down", "--remove-orphans"])


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Compose entrypoint that prefers a private Chronestia source tree when available."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    status_parser = subparsers.add_parser("status", help="Show Chronestia runtime mode")
    status_parser.set_defaults(func=cmd_status)

    up_parser = subparsers.add_parser("up", help="Start services")
    up_parser.add_argument("-d", "--detach", action="store_true", help="Run services in the background")
    up_parser.add_argument("services", nargs="*", help="Optional compose service names")
    up_parser.set_defaults(func=cmd_up)

    down_parser = subparsers.add_parser("down", help="Stop compose services")
    down_parser.set_defaults(func=cmd_down)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
