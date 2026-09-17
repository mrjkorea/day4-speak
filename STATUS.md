# Day 4 Speak — STATUS

**App:** MRJ Day 4 Speaking (all 9 Conversation books)  
**Repo:** `mrjkorea/day4-speak`  
**Built:** 2026-09-18 (KST)  
**Live:** https://mrjkorea.github.io/day4-speak/

## Counts

| | |
|---|---|
| Books | **9** (Basic A/B/C · Int 2A/2B/2C · Int 3A/3B/3C) |
| Units | **72** (8 per book) |
| Items | **716** |
| Coach Ray mp3 | **716** (100% coverage · full replace) |

### Per book

| Book | Units | Items |
|---|---|---|
| Basic A | 8 | 76 |
| Basic B | 8 | 80 |
| Basic C | 8 | 80 |
| Int 2A | 8 | 80 |
| Int 2B | 8 | 80 |
| Int 2C | 8 | 80 |
| Int 3A | 8 | 80 |
| Int 3B | 8 | 80 |
| Int 3C | 8 | 80 |

### Voice lock

- **Coach Ray** Fish id `76bb6ae7b26c41fbbd484514fdb014c2`
- Every English playback line baked with `[emotion]` tags via `fish-pack/make_voice.py` (`--voice ray`)
- **Zero Jay cards** — no Jay teacher voice on Day 4 model audio
- Prior Maya / day5-stu / day6-student clips **removed and replaced** (716 new Coach Ray bakes, 0 fail, ~19 min)

### Scoring (v1)

- Web Speech API · ≥ **80%** · Levenshtein + word overlap · `alts` accepted
- Unit record → `localStorage` + downloadable JSON

### UX

1. Korean cue (English hidden) → tap → Coach Ray English mp3  
2. Mic → speak English → ≥80 → reveal + next  
3. Unit done → score summary

### Content sources

- Print-offs: `BASIC_{A,B,C}` + `INT{2A,2B,2C,3A,3B,3C}-PRINTOFF.md` Day4 CP Sign pages
- Vocab cross-check: `conv-youtube/int-packs/*_UNIT_VOCAB.md`

### Deploy

- GitHub Pages from `main` / root · local `gh` only · no CloudAgent
