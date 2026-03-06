#!/usr/bin/env python3

import json
import sys
import base64
from pathlib import Path


def set_path(tree, parts, value):
    cur = tree
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


def walk(root):
    json_tree = {}
    text_tree = {}
    binary_tree = {}

    for f in sorted(root.rglob("*")):
        if not f.is_file():
            continue

        parts = f.relative_to(root).parts

        # Try JSON first
        if f.suffix == ".json":
            try:
                set_path(json_tree, parts, json.loads(f.read_text()))
                continue
            except Exception:
                pass

        # Try text
        try:
            set_path(text_tree, parts, f.read_text())
            continue
        except UnicodeDecodeError:
            pass

        # Binary fallback
        set_path(
            binary_tree,
            parts,
            base64.b64encode(f.read_bytes()).decode("ascii"),
        )

    return {"json": json_tree, "text": text_tree, "binary": binary_tree}


if len(sys.argv) != 2:
    print("usage: dir2json.py <dir>", file=sys.stderr)
    sys.exit(1)

root = Path(sys.argv[1]).resolve()
print(json.dumps(walk(root), indent=2, ensure_ascii=False))
