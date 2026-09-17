#!/usr/bin/env python3
"""Bake missing Day4 target lines with Fish Maya (kid) + [square] emotion tags."""
from __future__ import annotations
import json, re, sys, time
from pathlib import Path

ROOT = Path("/workspace/day4-speak")
sys.path.insert(0, "/workspace/conv-youtube/fish-pack")
from make_voice import synthesize

def slug(s: str) -> str:
    s = re.sub(r"[^\w]+", "_", s.lower()).strip("_")
    return s[:60] or "x"

missing = json.loads((ROOT / "scripts/missing_audio.json").read_text())
ok, fail = 0, []
for i, m in enumerate(missing):
    en = m["english"]
    dest = ROOT / "audio" / f"{m['book']}_{m['unit']}_{m['n']:02d}_{slug(en)}.mp3"
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"skip exists {dest.name}")
        ok += 1
        continue
    text = f"[cheerful kid, clear and friendly] {en}"
    try:
        synthesize(text, "maya", dest)
        ok += 1
        time.sleep(0.35)
    except Exception as e:
        print(f"FAIL {en}: {e}")
        fail.append({"item": m, "error": str(e)})
        time.sleep(1)

# Also re-bake weak short matches for Rock/Paper/Scissors wins (want full phrase)
weak = [
    ("basic_b", "unit04", 1, "Rock wins"),
    ("basic_b", "unit04", 2, "Paper wins"),
    ("basic_b", "unit04", 3, "Scissors wins"),
]
# duplicate pattern for items 4-10
for n in range(1, 11):
    phrase = ["Rock wins", "Paper wins", "Scissors wins"][(n - 1) % 3]
    dest = ROOT / "audio" / f"basic_b_unit04_{n:02d}_{slug(phrase)}.mp3"
    # always bake full phrase for clarity
    try:
        synthesize(f"[cheerful kid, clear and friendly] {phrase}", "maya", dest)
        time.sleep(0.35)
        ok += 1
    except Exception as e:
        fail.append({"item": phrase, "error": str(e)})

# Update content JSON audio_source for baked files
for book_id in ["basic_a", "basic_b", "basic_c"]:
    book_path = ROOT / "content" / f"{book_id}.json"
    book = json.loads(book_path.read_text())
    for unit in book["units"]:
        changed = False
        for it in unit["items"]:
            ap = ROOT / it["audio"]
            if ap.exists() and ap.stat().st_size > 1000:
                if it.get("audio_source") == "missing":
                    it["audio_source"] = "fish-maya-baked"
                    changed = True
                # mark BB4 rock wins as baked
                if book_id == "basic_b" and unit["id"] == "unit04":
                    it["audio_source"] = "fish-maya-baked"
                    changed = True
        if changed:
            (ROOT / "content" / book_id / f"{unit['id']}.json").write_text(
                json.dumps(unit, ensure_ascii=False, indent=2), encoding="utf-8"
            )
    book_path.write_text(json.dumps(book, ensure_ascii=False, indent=2), encoding="utf-8")

print(json.dumps({"baked_ok": ok, "fail": len(fail), "failures": fail}, indent=2))
(ROOT / "scripts/bake_log.json").write_text(json.dumps({"ok": ok, "fail": fail}, indent=2))
