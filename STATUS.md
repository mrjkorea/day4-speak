# Day 4 Speak — STATUS

**App:** MRJ Day 4 Speaking (Basic A / B / C)  
**Repo:** `mrjkorea/day4-speak`  
**Built:** 2026-09-18 (KST)  
**Live:** https://mrjkorea.github.io/day4-speak/

## Counts

| | |
|---|---|
| Books | 3 (Basic A, Basic B, Basic C) |
| Units | 24 (8 per book) |
| Items | 236 |
| Audio mp3 | 236 (100% coverage) |

### Audio sources

| Source | Count | Notes |
|---|---|---|
| day6-student (reuse) | 173 | Fish Day6 student target lines |
| day5-stu (reuse) | 9 | Day5 kid student slots |
| day5-listen (reuse) | 8 | Day5 listen clips |
| fish-maya-baked (new) | 46 | Maya kid voice `[cheerful kid…]` |

Reuse total: **190** · Baked new: **46**  
No Web Speech Synthesis required for playback (mp3 for every item). Browser TTS remains a runtime fallback if an mp3 fails to load.

## Scoring (v1)

- **API:** Web Speech API `SpeechRecognition` / `webkitSpeechRecognition` (Chrome recommended)
- **Compare:** normalize case/punct → max(Levenshtein char similarity, word-overlap)
- **Pass:** ≥ **80%**
- Accepts `alts` (e.g. `I am 10` for `I am ten years old`)
- No external pronunciation API wired (none found on box for MRJ); Web Speech is v1

## UX

1. Show Korean cue (English hidden)
2. Tap cue → play English mp3
3. Mic → speak English
4. Score ≥80 → reveal English, auto-next
5. Unit done → score summary; `localStorage` + downloadable JSON  
   `// TODO: Score Dashboard hook` in `js/app.js`

## Content sources

- Print-offs: `BASIC_{A,B,C}-PRINTOFF.md` Day4 CP Sign pages
- English targets inferred from Day6 QA + unit vocab packs
- Intermediate books: **out of scope** (later)

## Deploy notes

- GitHub Pages from `main` / root
- Zero CloudAgent; local `gh` only
