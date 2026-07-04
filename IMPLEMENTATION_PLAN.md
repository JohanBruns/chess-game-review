# Implementation Plan — Guided Game Review (chess.com-style Explain/Best)

> For Claude Code **Plan Mode**. Read this whole file, inspect the referenced source, then
> produce a step-by-step plan. Implement task by task, run `vitest` after each, keep commits
> small. Do NOT refactor unrelated code.
> IMPORTANT: if a feature can be implemented in a better/easier way than described here, feel
> free to act independently from this guide!

## Status (2026-07-04)

**Done.** The guided review bar (Explain/Best/Next, chess.com-style) replaced the old
`Evaluate Position` button and the four scattered Coaching toggles (Best-arrow/Threats/
Lines/LLM-Explain). This file is the reference for that feature and for anything built on
top of it next.

## What this feature is (reference: `Board&Game/review/Screenshot_20.png`–`28.png`)

chess.com's Game Review has **two separate modes**:
1. **Game Review** (the guided walkthrough these screenshots show) — per move: a coach
   speech-bubble (`"d6 is a blunder"  +4.21`) and exactly three controls: **Explain / Best /
   Next** (plus a ⚡ Retry at key moments, already implemented separately). No Threats/Lines/
   toggle buttons live here.
2. **Analysis** (a separate board/mode) — MultiPV engine lines, multiple simultaneous
   arrows, depth control. Not part of Game Review.

This project's Game Review now mirrors mode (1). `Analyze Game` still fills `evalResults`
(the prerequisite for the whole review — no review without engine data for every ply).

### Sub-modes

| Sub-mode | Coach header | Buttons | Board |
|---|---|---|---|
| **idle** | `"<san> is a <class>"` / `"is best"` / `"is a book move"` + eval badge (after the played move) | Explain · Best* · Next | played move (existing marker/badge) + automatic best-move arrow when played ≠ engine-best |
| **explain** | `"Explaining <bestSan>"` + eval badge (before the move) | ◀ · ▶ · Got it! | steps through the engine's PV move by move |
| **best** | `"<bestSan> is best"` + eval badge (before the move) | Explain · Resume | best move previewed: arrow + green star + green squares |

\*Best only shown when the played move differs from the engine's best move and the
classification isn't Book/Forced.

## Repo ground truth (already exists — build on it, don't reinvent)

- `src/lib/analysis/classify.ts`
  - `type MoveClass = 'Book'|'Brilliant'|'Great'|'Best'|'Excellent'|'Good'|'Inaccuracy'|'Mistake'|'Blunder'|'Miss'|'Forced'`
  - `winPct(cp)`, `moveAccuracy(lossInWinPct)`, `playerAccuracy`, `phaseAccuracy`,
    `isSacrifice`, `classifyMove`, `buildMoveAnalyses(moves, evalResults, openingPly, whiteRating?, blackRating?)`
- `src/lib/analysis/arrows.ts`
  - `getBestMoveArrow(fenBefore, bestMoveSan): {from,to}|null`
  - `getAttackArrows(fenAfter, moveTo, moverColor): {attacks, attackedBy}`
  - `getThreatArrow` — **kept, currently unused** by the review flow (see "Deliberately kept" below)
- `src/lib/analysis/lines.ts` — `getEngineLines(evalResult)` — **kept, currently unused**
- `src/lib/analysis/review.ts` (new, this feature)
  - `reviewHeadline(san, cls, isEnginesBest): string` — `"e4 is a book move"` / `"O-O is best"` / `"d6 is a blunder"` etc.
  - `formatEvalBadge(evalResult|null): string` — white-perspective compact badge: `"+4.21"` / `"-0.09"` / `"M5"` / `"-M3"` / `""`
  - `buildLineSteps(fenBefore, pv|null): LineStep[]` — resolves a PV SAN string into `{san,fen,from,to}` steps, stops cleanly at the first unparsable SAN
  - `buildBestPreview(fenBefore, bestSan|null): BestPreview|null` — applies the best move, returns `{san,fen,from,to}`
- `src/lib/engine/useEngine.ts`
  - `EvalResult { cp, mate, bestMoveSan, pv, secondBestCp, secondBestMoveSan, thirdBestCp, thirdBestMoveSan }`, MultiPV=3, `go depth 15`, 10s timeout
  - `pv` is now sliced to **10** plies (was 5) so Explain has enough moves to step through
  - `evaluate()` (single-position eval) still exists on the hook but is **no longer called
    anywhere** — Game Review always uses `analyzeGame`'s per-ply `evalResults`. Kept because
    it's cheap to keep and the engine layer shouldn't assume its only caller is this UI.
- `src/components/BoardPanel.tsx` — unchanged by this feature. Renders arrows via
  react-chessboard's `arrows` prop; `classification` drives both the square tint
  (`CLASS_COLOR`) and the corner badge (`MARK_FILE`, skipped for `'Book'`). The review flow
  reuses this by feeding it a synthetic `classification: 'Best'` (best-preview: green tint +
  star badge) or `'Book'` (explain-step: neutral tint, no badge) instead of the real
  classification of the loaded position.
- `src/components/ReviewPanel.tsx` (new, this feature) — presentational only, all state
  lives in `App.tsx`. Renders the coach bubble + eval badge + the sub-mode-specific button
  row + (in `explain`) a SAN strip of the PV with the current step highlighted.

## `App.tsx` wiring (the core of this feature)

- `reviewSub: 'idle'|'explain'|'best'` + `explainStep: number` — the only new state. Reset to
  `idle`/`0` on every ply change (same effect that already resets retry-adjacent state).
- Derivations (all computed from `moveAnalyses`/`evalResults`/`fens`/`moves` — no new engine
  calls): `analysis`, `bestSan`, `playedSan`, `isEnginesBest`, `bestPreview` (via
  `buildBestPreview`), `lineSteps` (via `buildLineSteps`), `reviewActive`, `canBest`,
  `canExplain`, `reviewHeadlineText`, `reviewEvalBadge`.
- Board view: a small `viewFen`/`viewClass`/`viewFrom`/`viewTo`/`viewArrow`/`viewAttack` set
  of local `let`s computed right before the render, defaulting to the existing idle
  behavior and overridden when `reviewSub` is `'best'` or `'explain'` (retry mode still takes
  priority over both — unrelated feature, unchanged).
- `EvalPanel` lost `isEvaluating`/`onEvaluate` (the `Evaluate Position` button is gone —
  `Analyze Game` is now the only entry point into having eval data at all).

### Deliberately kept, currently unused

`useCoaching.ts`, `src/lib/analysis/coaching.ts` (the Claude-API text-explanation path),
`src/components/EngineLines.tsx`, `src/lib/analysis/lines.ts`, and `getThreatArrow` in
`arrows.ts` are **not deleted**. They implement real, working features (an LLM move
explanation, and a chess.com-"Analysis"-style multi-line panel) that just don't belong in the
Game Review flow per chess.com's own UI split. Reactivate them behind a separate "Analysis"
mode/toggle if that's ever wanted — no rewrite needed, just re-wire the existing exports.

## Tests

`src/lib/analysis/review.test.ts` — `reviewHeadline` (Book/Best/every classification
phrase + article correctness for "an inaccuracy"), `formatEvalBadge` (positive/negative cp,
positive/negative mate, null, no-data), `buildLineSteps` (multi-move PV, illegal-SAN
truncation, null/empty pv), `buildBestPreview` (legal move, null bestSan, illegal SAN).

## Verification checklist (last run 2026-07-04)

- `npx vitest run` — 153/153 green (134 pre-existing + 19 new).
- `npx tsc -b` — clean (NOT `--noEmit`, see Anweisungen.md).
- Browser: loaded a game, `Analyze Game`, then per sub-mode:
  - idle on a Blunder → bubble text + eval badge correct, best-move arrow auto-shown, Explain/Best/Next all enabled.
  - Best → best move previewed (arrow + green star + green squares), header `"<best> is best"`, Resume returns to idle.
  - Explain → board steps through the PV via ◀/▶, header `"Explaining <san>"`, SAN strip highlights the current step, Got it! returns to idle.
  - Next → advances the ply, sub-mode resets to idle.
  - Book move → no Best button (Explain-only, if a PV exists).
  - Retry ⚡ at a key moment still works unmodified.
