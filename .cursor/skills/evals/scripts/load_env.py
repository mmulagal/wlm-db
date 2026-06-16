#!/usr/bin/env python3
"""Load skill eval env vars from local.env.json (shell env wins when already set)."""

from __future__ import annotations

import argparse
import json
import os
import shlex
import sys
from pathlib import Path


def env_file() -> Path:
    return Path(__file__).resolve().parent.parent / "local.env.json"


def load_skill_block(path: Path, skill: str) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data.get("skills"), dict) and skill in data["skills"]:
        block = data["skills"][skill]
    elif isinstance(data.get(skill), dict):
        block = data[skill]
    elif isinstance(data.get("default"), dict):
        block = data["default"]
    else:
        block = data
    if not isinstance(block, dict):
        raise ValueError(f"No object config found for skill '{skill}'")
    return {k: str(v) for k, v in block.items() if not str(k).startswith("_") and v is not None}


def main() -> int:
    parser = argparse.ArgumentParser(description="Load eval env from local.env.json")
    parser.add_argument("skill", help="Skill directory name (e.g. wlm-db-tco)")
    parser.add_argument("--file", type=Path, help="Override env file path")
    parser.add_argument("--export", action="store_true", help="Print bash export lines")
    parser.add_argument("--check", action="store_true", help="Exit 0 when file and skill exist")
    args = parser.parse_args()

    path = args.file or env_file()
    if not path.is_file():
        print(f"Missing {path}", file=sys.stderr)
        return 1

    try:
        block = load_skill_block(path, args.skill)
    except (json.JSONDecodeError, ValueError) as exc:
        print(f"Invalid env file: {exc}", file=sys.stderr)
        return 1

    if args.check:
        return 0

    if args.export:
        for key, value in block.items():
            if os.environ.get(key) or value == "":
                continue
            print(f"export {key}={shlex.quote(value)}")
        return 0

    for key, value in block.items():
        print(f"{key}={'***' if key == 'TOKEN' and value else value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
