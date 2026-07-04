# Implementation Plan — chess.com-parity features for `chess-game-review`

> For Claude Code **Plan Mode**. Read this whole file, inspect the referenced source,
> then produce a step-by-step plan. Implement task by task, run `vitest` after each,
> keep commits small. Do NOT refactor unrelated code.
IMPORTANT: if you think that a certain feature can be implemented in a better/easier way than descibed in the plan, feel free to act independently from this guide!
## Repo ground truth (already exists — build on it, don't reinvent)

- `src/lib/analysis/classify.ts`
  - `type MoveClass = 'Book'|'Brilliant'|'Great'|'Best'|'Excellent'|'Good'|'Inaccuracy'|'Mistake'|'Blunder'|'Miss'|'Forced'`
  - `winPct(cp: number): number` — Lichess sigmoid (const `0.00368208`)
  - `moveAccuracy(lossInWinPct): number` — Lichess per-move accuracy
  - `playerAccuracy(analyses, player): number|null` — volatility-weighted mean + harmonic mean
    (mean of the two), over non-Book/non-Forced moves (T5 done)
  - `phaseAccuracy(analyses, player): { opening, middlegame, endgame: number|null }` — same
    aggregation core as `playerAccuracy` (shared private `aggregate` helper), split by each
    move's `phase` field; a phase with no qualifying moves returns `null` for that phase (T7
    phase-accuracy done)
  - `isSacrifice(move: Move): boolean` — exchange-sac OR piece hangs on destination
  - `classifyMove(loss, isEngineBestMove, move?, winPctBefore?, bestCp?, secondBestCp?): MoveClass`
  - `buildMoveAnalyses(moves, evalResults, openingPly): MoveAnalysis[]` — also stamps each
    move with `phase?: 'opening'|'middlegame'|'endgame'`. Opening runs to
    `max(openingPly, 20 plies)` (not just the book-match length, since book moves are excluded
    from accuracy); endgame is a sticky trigger once combined non-pawn material (both sides,
    kings excluded) drops to ≤20.
- `src/lib/analysis/arrows.ts`
  - `getBestMoveArrow(fenBefore, bestMoveSan): { from, to } | null`
  - `getAttackArrows(fenAfter, moveTo, moverColor): { attacks, attackedBy }` — pure geometry
- `src/lib/analysis/retry.ts` (T7 retry-at-key-moments)
  - `attemptMove(fen, from, to): { san, fenAfter } | null` — chess.js wrapper, auto-queens
    promotions, `null` on illegal moves
  - `isBestMove(attemptedSan, bestMoveSan): boolean | null` — exact-SAN match (same rule as
    classify.ts's `Best`); `null` (not `false`) when `bestMoveSan` is unknown
- `src/lib/engine/useEngine.ts`
  - `EvalResult { cp, mate, bestMoveSan, pv, secondBestCp }`, MultiPV=2, `go depth 15`, 10s timeout
- `src/components/BoardPanel.tsx`
  - Renders arrows via **react-chessboard's built-in `arrows: Arrow[]` prop** (NOT a custom SVG overlay)
  - Props already present: `bestMoveArrow`, `attackArrows`, `threatArrow`, `orientation` (`'white'|'black'`,
    default `'white'`; drives react-chessboard's `boardOrientation` AND the manual classification-badge
    overlay geometry, which is mirrored by hand since it isn't drawn through react-chessboard),
    `interactive`/`onPieceDrop` (T7 retry — `allowDragging`/`canDragPiece`/`onPieceDrop` on the
    underlying `<Chessboard>`; the library never commits a dropped move itself, the consumer
    must update the `fen`/`position` prop on an accepted drop)
  - Colors: `BEST_MOVE_ARROW_COLOR='#81b64c'`, `ATTACKS_ARROW_COLOR='#e2903f'`, `ATTACKED_BY_ARROW_COLOR='#e5533d'`,
    `THREAT_ARROW_COLOR='#e02c2c'`
- `src/components/RetryPanel.tsx` (T7 retry) — pass/fail UI, `Try Again` / `Exit Retry`
- Tests: `classify.test.ts`, `arrows.test.ts`, `coaching.test.ts`, `openings.test.ts`, `retry.test.ts` (Vitest)
- Mark assets: `public/marks/*.png` — has best/excellent/good/inaccuracy/mistake/blunder/brilliant/great_find/book/forced.
  `Board&Game/marks/` (staging folder, not yet copied to `public/marks/`) has further assets
  including `missed_win_128x.png` — copy/rename into `public/marks/` when wiring up `Miss`'s icon
  (currently falls back to `incorrect_128x.png` as a placeholder in `BoardPanel.tsx`'s `MARK_FILE`).

## Global constraints

- TypeScript strict, no `any`. Keep functions pure/testable where the current code is.
- Every new/changed classification or arrow function gets Vitest cases.
- Threat & new classes must degrade gracefully when `evalResults[i+1]` or `secondBestCp` is `null`.
- Do NOT build a separate `<BoardArrows/>` SVG overlay — extend the existing `arrows` array.
- Do NOT raise MultiPV or engine depth in these tasks (none of them require it).

---

## T1 — Real engine-derived THREAT arrow (replaces the "attack = threat" confusion)

**Why:** `getAttackArrows` is board geometry, not chess.com's "Show Threats". chess.com's
threat = the opponent's best reply in the current position (engine-derived). That data is
already computed as `evalResults[i+1].bestMoveSan`.

**Do:**
1. Add `src/lib/analysis/arrows.ts` → `getThreatArrow(fenAfterPlayedMove, opponentBestSan): { from, to } | null`
   — thin wrapper reusing the same SAN→squares parse pattern as `getBestMoveArrow`
   (opponentBestSan = `evalResults[currentPly + 1]?.bestMoveSan`).
2. In the board container (wherever `bestMoveArrow`/`attackArrows` props are assembled),
   compute the threat arrow for the current ply and pass it down as a new
   `threatArrow?: { from: string; to: string }` prop.
3. In `BoardPanel.tsx`: add `const THREAT_ARROW_COLOR = '#e02c2c'` and push the threat arrow
   into the existing `arrows` array (after best-move so red renders on top).
4. Keep `attackArrows` but treat them as an optional separate "learning overlay", never
   labeled "threat".

**Acceptance:**
- With `showThreats` on, a red arrow shows the opponent's best reply to the current position.
- Suppressed when `threatArrow` is null (e.g. game over, or no next eval yet).
- `arrows.test.ts`: given a FEN + opponent best SAN → correct `{from,to}`; null SAN → null.

**Optional (only if you want exact chess.com "threat-before-they-move" semantics):**
- Add `getNullMoveThreat(fen, engine)`: build a null-move FEN (flip `side-to-move`, clear
  en-passant), guard against illegal positions (side-to-move-not-in-check check), run one
  engine search, return its bestmove squares. Gate behind a flag; default off.

## T2 — `Miss` classification (Missed Win)

**Definition (chess.com):** you had a winning opportunity created by the opponent's mistake
and instead ended up equal or worse.

**Do:**
1. Extend `MoveClass` union with `'Miss'`.
2. In `classifyMove`, BEFORE the `Mistake`/`Blunder` fallthrough, add:
   - `winPct(bestCp) >= MISS_WIN_AVAILABLE` (default `80`) — a win was on the board, AND
   - `winPctAfter <= MISS_RESULT_CEILING` (default `55`) — you ended equal/worse, AND
   - not already trivially winning without the move (`winPctBefore < 80` guard so it's a
     *newly available* win, mirroring "capitalize on opponent's mistake").
   - → return `'Miss'` (takes priority over Mistake/Blunder for this case).
3. Expose the two thresholds as named consts at top of file.
4. Add a `miss` mark asset reference; if no PNG exists, use a placeholder + TODO note in the
   PR (don't block on art).

**Acceptance:**
- A position where best move wins (winPct≈85) but the played move drops to ≈50 → `Miss`,
  not `Mistake`. Covered by a new `classify.test.ts` case.
- Does not fire when the player was already winning big beforehand.

## T3 — `Forced` / Only-move classification

**Do:**
1. Extend `MoveClass` union with `'Forced'`.
2. In `buildMoveAnalyses`, before eval-based classification, if the position before the move
   has exactly one legal move (`new Chess(fenBefore).moves().length === 1`) → classify `Forced`,
   `accuracy: 100`, and EXCLUDE from `playerAccuracy` (same treatment as `Book`).
3. Update `playerAccuracy` filter to also drop `'Forced'` (and later `'Book'` stays dropped).

**Acceptance:**
- Only-legal-move positions classify as `Forced` and don't distort accuracy.
- Test with a simple forced-recapture / only-king-move FEN.

## T4 — Brilliant / Great refinements (closer to chess.com V2)

**Brilliant — tighten `isSacrifice` + `classifyMove`:**
1. Add a "sac actually loses for the opponent" guard: after the hypothetical opponent capture
   on `move.to`, a shallow static check (or reuse eval) should NOT leave the mover worse than
   `winPctAfter` by more than a small margin. Goal: exclude plain hangs that the engine merely
   tolerates.
2. Exclude when a **more valuable** friendly piece is simultaneously hanging for free
   (that's a blunder, not a brilliancy).
3. Keep existing gates (`loss<=2`, `winPctBefore<90`, `winPctAfter>=50`).

**Great — broaden beyond only-move:**
1. Replace strict `isEngineBestMove` with near-best tolerance: `loss <= 1.5`.
2. Keep the existing "only good move" branch (gap ≥30 win%, 2nd-best <50).
3. ADD swing branches (best/near-best required):
   - lost→equal: `winPctBefore < 50 && winPctAfter >= 50`
   - equal→winning: `winPctBefore <= 55 && winPctAfter >= 75`
4. Precedence: `Brilliant` > `Great` > `Best` (keep current order).

**Optional rating-awareness:**
- Add optional `playerRating?: number` to `classifyMove`; when provided, loosen Brilliant/Great
  thresholds slightly below ~1600 and tighten above ~2000. Default behavior unchanged when omitted.

**Acceptance:**
- New `classify.test.ts` cases: a real queen-sac best move → `Brilliant`; a free hang the engine
  dislikes → NOT Brilliant; a lost→equal only-move → `Great`; a "slightly-less-good while still
  winning" move → NOT Great.

## T5 — Accuracy aggregation (Lichess/chess.com-style, not plain mean)

**Why:** per-move formulas are already Lichess; the *game* number should use the same aggregation.

**Do:** rewrite `playerAccuracy` to return the mean of two sub-scores over the player's
non-Book/non-Forced moves:
1. **Volatility-weighted mean**: weight each move's accuracy by the local win% volatility
   (std-dev of the win% sequence in a sliding window, e.g. ±2 plies, min weight 0.5).
   → needs the per-move win% trajectory; derive from `evalResults` (already available to the caller)
   and pass it in, or compute win% inside `buildMoveAnalyses` and store it on `MoveAnalysis`.
   **Reuse note (from T4):** `buildMoveAnalyses` already computes a local, unclamped
   `winPctAfterRaw = winPct(cpAfter)` per move (added for the Great swing branches) — store
   that on `MoveAnalysis` instead of re-deriving the win% trajectory from scratch.
2. **Harmonic mean** of the same per-move accuracies.
3. Return `(weightedMean + harmonicMean) / 2`, clamped to [0,100].

**Acceptance:**
- A game with one big blunder among strong moves scores meaningfully lower than the old plain
  mean (harmonic mean punishes the low outlier). Add a `classify.test.ts` case asserting the
  new value < old arithmetic mean for a crafted sequence.

## T6 — Arrow rendering polish (from the attached arrow spec, reconciled to react-chessboard)

**Do:**
1. Best-move arrow: SUPPRESS when best == played (same from & to) — add the guard where the
   `bestMoveArrow` prop is assembled.
2. Toggles: `showBestMove` (default true), `showThreats` (default false) wired to a small
   settings state/context; feed both into the arrows assembly.
3. Played-move indicator: highlight from/to squares in the classification color via
   react-chessboard `customSquareStyles` (NOT a separate overlay). Optional
   `playedMoveAsArrow` flag (default false).
4. Board flip / knight / castling / promotion: already handled by react-chessboard's arrow
   layer — no custom geometry needed; just verify visually after flip.

**Color constants (single source of truth, `BoardPanel.tsx` or a `colors.ts`):**
```
best-move  #81b64c   threat  #e02c2c
brilliant #1baca6  great #5c8bb0  best #81b64c  excellent #81b64c  good #95b776
book #a88865  inaccuracy #f0c15c  mistake #e58f2a  miss #ee6b55  blunder #ca3431  forced #808080
```
> These match chess.com closely but are community-referenced, not official. Verify against a
> live chess.com Game Review in DevTools and note any changed hex in the PR description.

## T7 — (Stretch, optional) chess.com-flavor extras

Three independent sub-features; user chose to do only the first one for now.

- [x] **Phase accuracy** — done. `phaseAccuracy` in `classify.ts`, wired into `EvalPanel`'s
  Open/Mid/End grid. Note the opening boundary is NOT plain `openingPly` — see the ground
  truth section above for why (book moves are excluded from accuracy, so the opening phase
  has to extend past the book match or it'd always be `null`).
- [x] **Retry-at-key-moments** — done. Clicking the ⚡ key-moment marker in `MoveList` now
  jumps to the position before that move and makes the board interactive
  (`BoardPanel`'s new `interactive`/`onPieceDrop` props; `canDragPiece` restricts dragging to
  the side to move). `src/lib/analysis/retry.ts` (`attemptMove`, `isBestMove`) validates the
  drop via chess.js and compares the resulting SAN to `evalResults[moveIndex].bestMoveSan`
  (same exact-match rule as classify.ts's `Best`) — no near-best tolerance, no promotion-choice
  UI (auto-queens). New `RetryPanel` component shows pass/fail; the reveal-the-answer arrow
  reuses `getBestMoveArrow`. Retry state lives entirely in `App.tsx` (`retryMoveIndex`/
  `trialFen`/`attemptResult`); `useGame`/`fens`/`moves` are untouched.
- [ ] Candidate arrows: only if you later raise MultiPV to 3 — best green, alternatives dimmed.
  `EvalResult` currently has no `secondBestMoveSan` (only `secondBestCp`); the `useEngine.ts`
  info-line parser would need extending to capture the 2nd/3rd PV's first move.

---

## Final verification checklist (run before opening the PR)

- [x] `npx vitest run` green; new cases for T2/T3/T4/T5 present.
- [x] `npx tsc -b` clean (**not** `tsc --noEmit` — silent no-op in this repo, root
      `tsconfig.json` has `"files": []` + project references); `MoveClass` union updated
      everywhere it's switched on (mark rendering, legend `ClassLegend.tsx`, coaching).
- [x] Threat arrow shows opponent's best reply (red) with toggle; suppressed when null.
- [x] Best-move arrow suppressed when it equals the played move.
- [x] Miss / Forced classify correctly and are excluded from accuracy.
- [x] Game accuracy uses weighted+harmonic aggregation.
- [x] No separate SVG overlay introduced; all arrows go through react-chessboard.
- [ ] PR description lists any hex values changed after DevTools verification against a live
      chess.com Game Review (not yet done — current `CLASS_COLOR`/arrow hexes are
      community-referenced, unverified) and flags that `forced` now has a real mark asset but
      `miss` still falls back to the `incorrect_128x.png` placeholder.

---

Nach Abschluss jedes `Tx`-Blocks sollen dieses Dokument und `Anweisungen.md` durchgesehen und
aktualisiert bzw. verbessert werden (z. B. veraltete Ground-Truth-Angaben korrigieren, neu
gewonnene Spec-vs-Code-Erkenntnisse festhalten) — nicht erst am Ende der gesamten Milestone.