#!/usr/bin/env python3
"""Central skill eval runner — validate JSON and finish benchmarks (skill-creator)."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def skills_root() -> Path:
    return Path(__file__).resolve().parent.parent


def discover_skills(root: Path, names: list[str] | None = None) -> list[Path]:
    found = sorted(d for d in root.iterdir() if d.is_dir() and (d / "SKILL.md").is_file())
    if names:
        wanted = set(names)
        found = [d for d in found if d.name in wanted]
    return found


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_trigger(path: Path) -> tuple[str, str]:
    if not path.is_file():
        return "skipped", f"missing `{path.name}`"
    data = load_json(path)
    if not isinstance(data, list) or not data:
        return "fail", "must be a non-empty JSON array"
    for idx, item in enumerate(data):
        if not isinstance(item, dict):
            return "fail", f"entry {idx} is not an object"
        if not isinstance(item.get("query"), str) or not item["query"].strip():
            return "fail", f"entry {idx} missing non-empty `query`"
        if not isinstance(item.get("should_trigger"), bool):
            return "fail", f"entry {idx} missing boolean `should_trigger`"
    should = sum(1 for item in data if item["should_trigger"])
    return "pass", f"{len(data)} queries ({should} should-trigger, {len(data) - should} should-not-trigger)"


def validate_evals(path: Path) -> tuple[str, str]:
    if not path.is_file():
        return "skipped", f"missing `{path.name}`"
    data = load_json(path)
    if not isinstance(data, dict):
        return "fail", "root must be a JSON object"
    evals = data.get("evals")
    if not isinstance(evals, list) or not evals:
        return "fail", "missing non-empty `evals` array"
    for idx, ev in enumerate(evals):
        if not isinstance(ev, dict):
            return "fail", f"eval {idx} is not an object"
        for key, typ in (("id", int), ("name", str), ("prompt", str)):
            if not isinstance(ev.get(key), typ) or (typ is str and not str(ev[key]).strip()):
                return "fail", f"eval {idx} missing or invalid `{key}`"
        if not isinstance(ev.get("expectations"), list):
            return "fail", f"eval {idx} missing `expectations` list"
    return "pass", f"{len(evals)} eval cases"


def cmd_validate(root: Path, names: list[str] | None) -> int:
    payload: dict[str, Any] = {"timestamp_utc": datetime.now(timezone.utc).isoformat(), "skills": []}
    for skill_dir in discover_skills(root, names):
        evals_dir = skill_dir / "evals"
        checks = [
            ("trigger-json", *validate_trigger(evals_dir / "trigger-eval.json")),
            ("evals-json", *validate_evals(evals_dir / "evals.json")),
        ]
        statuses = {s for _, s, _ in checks if s != "skipped"}
        status = "skipped" if not statuses else ("fail" if "fail" in statuses else "pass")
        payload["skills"].append(
            {
                "skill": skill_dir.name,
                "status": status,
                "checks": [{"name": n, "status": s, "details": d} for n, s, d in checks],
            }
        )
    out_dir = Path(__file__).resolve().parent / "results" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "results.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    lines = ["# Skills Eval Report", "", f"- Timestamp (UTC): `{payload['timestamp_utc']}`", ""]
    for skill in payload["skills"]:
        lines.append(f"## {skill['skill']}")
        lines.append(f"- Status: `{skill['status']}`")
        for check in skill["checks"]:
            lines.append(f"- {check['name']}: `{check['status']}` — {check['details']}")
        lines.append("")
    (out_dir / "report.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"Wrote {out_dir / 'results.json'}")
    return 0 if all(s["status"] != "fail" for s in payload["skills"]) else 1


def finish_skill(root: Path, skill: str, iteration: int) -> None:
    sc = root / "skill-creator"
    ws = root / f"{skill}-workspace" / f"iteration-{iteration}"
    if not ws.is_dir():
        raise FileNotFoundError(f"no workspace: {ws}")
    graded = len(list(ws.rglob("run-1/grading.json")))
    if graded == 0:
        print(f"WARN: {skill}: no grading.json — grade with agents/grader.md first.", file=sys.stderr)
    print(f"==> finish {skill} (iteration-{iteration}, {graded} graded runs)")
    subprocess.run(
        [sys.executable, str(sc / "scripts" / "aggregate_benchmark.py"), str(ws),
         "--skill-name", skill, "--output", str(ws / "benchmark.json")],
        check=True,
    )
    review_cmd = [
        sys.executable,
        str(sc / "eval-viewer" / "generate_review.py"),
        str(ws),
        "--skill-name",
        skill,
        "--benchmark",
        str(ws / "benchmark.json"),
        "--static",
        str(ws / "review.html"),
    ]
    if iteration > 1:
        prev_ws = root / f"{skill}-workspace" / f"iteration-{iteration - 1}"
        if prev_ws.is_dir():
            review_cmd.extend(["--previous-workspace", str(prev_ws)])
    subprocess.run(review_cmd, check=True)
    print(f"Done: {ws / 'benchmark.json'}")
    print(f"Done: {ws / 'review.html'}")


def cmd_finish(root: Path, iteration: int, names: list[str] | None) -> int:
    fail = skip = pass_ = 0
    skipped: list[str] = []
    failed: list[str] = []
    for skill_dir in discover_skills(root, names):
        if not (skill_dir / "evals" / "evals.json").is_file():
            continue
        name = skill_dir.name
        ws = root / f"{name}-workspace" / f"iteration-{iteration}"
        if not ws.is_dir():
            print(f"==> SKIP {name} (no iteration-{iteration} workspace)")
            skipped.append(name)
            skip += 1
            continue
        try:
            finish_skill(root, name, iteration)
            pass_ += 1
        except subprocess.CalledProcessError:
            failed.append(name)
            fail += 1
        except FileNotFoundError as exc:
            print(f"==> SKIP {name}: {exc}")
            skipped.append(name)
            skip += 1
    print(f"\nSummary: pass={pass_} skip={skip} fail={fail}")
    if skipped:
        print(f"Skipped: {' '.join(skipped)}")
    if failed:
        print(f"Failed:  {' '.join(failed)}")
    return 1 if fail else 0


def cmd_plan(root: Path, iteration: int) -> None:
    """Print short checklist; full steps in .cursor/commands/skill.md."""
    print("Full agent playbook: .cursor/commands/skill.md (/skill)")
    print(f"Iteration: {iteration}\n")
    for skill_dir in discover_skills(root):
        evals_path = skill_dir / "evals" / "evals.json"
        if not evals_path.is_file():
            continue
        evals = load_json(evals_path)["evals"]
        ws = root / f"{skill_dir.name}-workspace" / f"iteration-{iteration}"
        print(f"## {skill_dir.name} ({len(evals)} evals)")
        print(f"   Skill:  {skill_dir / 'SKILL.md'}")
        print(f"   Grader: {skill_dir / 'agents' / 'grader.md'}")
        print(f"   Workspace: {ws}/eval-<id>/{{with_skill,without_skill}}/run-1/")
        for ev in evals:
            print(f"   - eval-{ev['id']}: spawn with_skill + without_skill (same turn)")
        print()


def main() -> int:
    parser = argparse.ArgumentParser(description="Central skill eval runner")
    parser.add_argument("--skills", nargs="+", help="Skill directory names (default: all)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("validate", help="Validate evals.json + trigger-eval.json for all skills")

    p_finish = sub.add_parser("finish", help="Aggregate benchmark + review.html for skills with a workspace")
    p_finish.add_argument("--iteration", type=int, default=1)

    p_all = sub.add_parser("all", help="validate then finish")
    p_all.add_argument("--iteration", type=int, default=1)

    p_plan = sub.add_parser("plan", help="Print agent run checklist for an iteration")
    p_plan.add_argument("--iteration", type=int, default=1)

    args = parser.parse_args()
    root = skills_root()
    names: list[str] | None = args.skills
    iteration = getattr(args, "iteration", 1)

    if args.cmd == "validate":
        return cmd_validate(root, names)
    if args.cmd == "plan":
        cmd_plan(root, iteration)
        return 0
    if args.cmd == "finish":
        return cmd_finish(root, iteration, names)
    if args.cmd == "all":
        rc = cmd_validate(root, names)
        return rc or cmd_finish(root, iteration, names)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
