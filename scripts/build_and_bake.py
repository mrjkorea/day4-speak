#!/usr/bin/env python3
"""Build Day4 Speak content for all 9 books + bake Coach Ray mp3s."""
from __future__ import annotations

import concurrent.futures
import json
import re
import sys
import threading
import time
from pathlib import Path

ROOT = Path("/workspace/day4-speak")
CONTENT = ROOT / "content"
AUDIO = ROOT / "audio"
SCRIPTS = ROOT / "scripts"
CATALOG_PATH = SCRIPTS / "catalog.json"

sys.path.insert(0, "/workspace/conv-youtube/fish-pack")
from make_voice import synthesize  # noqa: E402

COACH = "ray"
EMOTIONS = [
    "[energetic coach, clear and encouraging]",
    "[friendly coach, clear]",
    "[upbeat coach, warm and clear]",
    "[clear coach, let's go]",
]
WORKERS = 8
MIN_BYTES = 1500


def slug(s: str) -> str:
    s = re.sub(r"[^\w]+", "_", s.lower()).strip("_")
    return (s[:50] or "x")


def item_id(book_id: str, unit_id: str, n: int) -> str:
    return f"{book_id}__{unit_id}__{n:02d}"


def audio_name(book_id: str, unit_id: str, n: int, en: str) -> str:
    return f"{item_id(book_id, unit_id, n)}__{slug(en)}.mp3"


def build_content(catalog: dict) -> dict:
    CONTENT.mkdir(parents=True, exist_ok=True)
    AUDIO.mkdir(parents=True, exist_ok=True)
    books_meta = []
    bake_jobs = []
    stats = {"books": 0, "units": 0, "items": 0}

    for book_id, book in catalog.items():
        units_out = []
        item_count = 0
        for ui, unit in enumerate(book["units"]):
            stats["units"] += 1
            items_out = []
            for n, it in enumerate(unit["items"], 1):
                stats["items"] += 1
                item_count += 1
                en = it["en"]
                aname = audio_name(book_id, unit["id"], n, en)
                apath = AUDIO / aname
                emotion = EMOTIONS[(n - 1) % len(EMOTIONS)]
                bake_jobs.append(
                    {
                        "text": f"{emotion} {en}",
                        "out": str(apath),
                        "english": en,
                        "id": item_id(book_id, unit["id"], n),
                    }
                )
                items_out.append(
                    {
                        "id": item_id(book_id, unit["id"], n),
                        "n": n,
                        "korean": it["ko"],
                        "english": en,
                        "alts": it.get("alts") or [],
                        "audio": f"audio/{aname}",
                        "audio_source": "fish-coach-ray",
                    }
                )
            units_out.append(
                {"id": unit["id"], "title": unit["title"], "items": items_out}
            )
        book_out = {"id": book_id, "label": book["label"], "units": units_out}
        (CONTENT / f"{book_id}.json").write_text(
            json.dumps(book_out, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        books_meta.append(
            {
                "id": book_id,
                "label": book["label"],
                "file": f"content/{book_id}.json",
                "units": len(units_out),
                "items": item_count,
            }
        )
        stats["books"] += 1

    manifest = {
        "title": "Day 4 Speak",
        "voice": "Coach Ray",
        "voice_id": "76bb6ae7b26c41fbbd484514fdb014c2",
        "pass_threshold": 0.8,
        "books": books_meta,
        "totals": {
            "books": stats["books"],
            "units": stats["units"],
            "items": stats["items"],
        },
    }
    (CONTENT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (SCRIPTS / "bake_jobs.json").write_text(
        json.dumps(bake_jobs, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({"built": stats, "jobs": len(bake_jobs)}, indent=2))
    return {"manifest": manifest, "jobs": bake_jobs}


def bake_all(jobs: list[dict], workers: int = WORKERS, force: bool = False) -> dict:
    lock = threading.Lock()
    ok = fail = skip = 0
    failures = []
    done = 0
    t0 = time.time()

    def one(job):
        nonlocal ok, fail, skip, done
        out = Path(job["out"])
        if not force and out.exists() and out.stat().st_size >= MIN_BYTES:
            with lock:
                skip += 1
                done += 1
            return ("skip", job["id"])
        try:
            synthesize(job["text"], COACH, out)
            if not out.exists() or out.stat().st_size < MIN_BYTES:
                raise RuntimeError(f"tiny/missing file {out}")
            with lock:
                ok += 1
                done += 1
                if done % 25 == 0:
                    elapsed = time.time() - t0
                    rate = done / elapsed if elapsed else 0
                    print(
                        f"progress {done}/{len(jobs)} ok={ok} skip={skip} fail={fail} "
                        f"{rate:.2f}/s eta={(len(jobs)-done)/rate/60 if rate else 0:.1f}m",
                        flush=True,
                    )
            return ("ok", job["id"])
        except Exception as e:
            with lock:
                fail += 1
                done += 1
                failures.append({"id": job["id"], "en": job["en"], "error": str(e)})
            return ("fail", job["id"], str(e))

    print(f"Baking {len(jobs)} with Coach Ray, workers={workers}, force={force}")
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(one, jobs))
    result = {
        "ok": ok,
        "skip": skip,
        "fail": fail,
        "failures": failures,
        "seconds": round(time.time() - t0, 1),
        "voice": "Coach Ray",
        "voice_id": "76bb6ae7b26c41fbbd484514fdb014c2",
    }
    (SCRIPTS / "bake_log.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({k: result[k] for k in ("ok", "skip", "fail", "seconds")}, indent=2))
    return result


def main():
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--bake-only", action="store_true")
    ap.add_argument("--build-only", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--workers", type=int, default=WORKERS)
    ap.add_argument("--clear-old-audio", action="store_true")
    args = ap.parse_args()

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    if args.clear_old_audio and AUDIO.exists():
        n = 0
        for p in AUDIO.glob("*.mp3"):
            p.unlink()
            n += 1
        print(f"cleared {n} old mp3s")

    if not args.bake_only:
        built = build_content(catalog)
        jobs = built["jobs"]
    else:
        jobs = json.loads((SCRIPTS / "bake_jobs.json").read_text())

    if not args.build_only:
        bake_all(jobs, workers=args.workers, force=args.force)


if __name__ == "__main__":
    main()
