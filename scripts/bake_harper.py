#!/usr/bin/env python3
"""Bake Miss Harper mp3 for every Coach Ray line. Mirrors audio/ -> audio_harper/ (same filenames)."""
from __future__ import annotations
import concurrent.futures, json, re, sys, threading, time, urllib.error
from pathlib import Path
sys.path.insert(0, "/workspace/conv-youtube/fish-pack")
from make_voice import synthesize  # noqa

ROOT = Path("/workspace/day4-speak")
OUT = ROOT / "audio_harper"
HARPER = "736de7d32d7949469ba4664bce9f3f32"
EMO = ["[warm, clear]", "[warm, kind]", "[cheerful teacher, clear]", "[gentle, encouraging]"]
MIN = 1500

def jobs():
    js = json.loads((ROOT / "scripts/bake_jobs.json").read_text())
    out = []
    for i, j in enumerate(js):
        name = Path(j["out"]).name
        out.append({"id": j["id"], "en": j["en"], "text": f"{EMO[i % 4]} {j['en']}", "out": str(OUT / name)})
    return out

def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    js = jobs()
    lock = threading.Lock(); st = {"ok": 0, "skip": 0, "fail": 0, "done": 0}; fails = []
    t0 = time.time()
    def one(j):
        out = Path(j["out"])
        if out.exists() and out.stat().st_size >= MIN:
            with lock: st["skip"] += 1; st["done"] += 1
            return
        err = None
        for attempt in range(6):
            try:
                synthesize(j["text"], HARPER, out)
                if out.stat().st_size < MIN: raise RuntimeError("tiny")
                with lock:
                    st["ok"] += 1; st["done"] += 1
                    if st["done"] % 25 == 0: print("progress", st, round(time.time()-t0), flush=True)
                return
            except urllib.error.HTTPError as e:
                err = f"HTTP {e.code}"; time.sleep((8 if e.code == 429 else 3) * (attempt + 1))
            except Exception as e:
                err = str(e); time.sleep(3 * (attempt + 1))
        with lock: st["fail"] += 1; st["done"] += 1; fails.append({**j, "error": err})
    with concurrent.futures.ThreadPoolExecutor(workers) as ex: list(ex.map(one, js))
    res = {**st, "failures": fails, "seconds": round(time.time()-t0), "voice": "Miss Harper", "voice_id": HARPER}
    (ROOT / "scripts/bake_harper_log.json").write_text(json.dumps(res, indent=2))
    print(json.dumps({k: res[k] for k in ("ok","skip","fail","seconds")}))
if __name__ == "__main__": main()
