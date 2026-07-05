# Implementation Plan — Guided Game Review (chess.com-style Explain/Best)

> For Claude Code **Plan Mode**. Read this whole file, inspect the referenced source, then
> produce a step-by-step plan. Implement task by task, run `vitest` after each, keep commits
> small. Do NOT refactor unrelated code.
> IMPORTANT: if a feature can be implemented in a better/easier way than described here, feel
> free to act independently from this guide!

## Status (2026-07-04)

**Guided Review: Done.** The guided review bar (Explain/Best/Next, chess.com-style) replaced
the old `Evaluate Position` button and the four scattered Coaching toggles (Best-arrow/
Threats/Lines/LLM-Explain). This file is the reference for that feature and for anything
built on top of it next.

**Block A + Block B (see bottom of this file): done.** Two independent follow-up fixes found
during the 2026-07-05 stress-test pass — A: removed the red/orange attack-arrow fan, B: fixed
the navigation-freeze via rAF-bundled ply commits in `useGame.ts` (plus memoizing `arrows` in
`BoardPanel.tsx`). Both verified: `npx tsc -b` clean, `npx vitest run` 149/149, and live-browser
checks (no attack-arrow fan on central queen/rook/bishop moves; the 40×Right+50×Left burst
repro no longer freezes or logs a "Maximum update depth exceeded" warning).

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

`src/components/EngineLines.tsx`, `src/lib/analysis/lines.ts`, and `getThreatArrow` in
`arrows.ts` are **not deleted**. They implement a real, working feature (a chess.com-
"Analysis"-style multi-line panel) that just doesn't belong in the Game Review flow per
chess.com's own UI split. Reactivate them behind a separate "Analysis" mode/toggle if that's
ever wanted — no rewrite needed, just re-wire the existing exports.

(`useCoaching.ts` and `src/lib/analysis/coaching.ts` — the Claude-API text-explanation path —
were listed here previously as "deliberately kept" too, but were actually dead code: nowhere
imported since the guided-review refactor replaced LLM-driven Explain with the local
engine-PV walkthrough above. Deleted in commit `b2bfdf0` during the 2026-07-05 stress-test
fix pass.)

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

---

# Block A — Roten/orangen Angriffs-Fächer entfernen

*(Übernommen aus dem ehemaligen `IMPLEMENTATION_PLAN2.md`, jetzt hier konsolidiert — siehe
Status-Abschnitt oben. Nicht Teil des Guided-Review-Features selbst, sondern ein separat
gefundener Fix am selben Board-Rendering-Code.)*

## Problem

Die grünen Pfeile (Best-Move-Vorschlag) sind gut. Die **roten/orangen** Pfeile zeigen oft quer
über das ganze Brett statt auf ein einzelnes relevantes Ziel.

## Ursache

Es gibt **keinen** Pfeil für den gespielten Zug — das Mental-Modell „grün = bester Zug,
rot/orange = gespielter Zug" stimmt nicht. Rot/Orange stammen aus dem **Angriffs-Fächer**:
- `getAttackArrows(fenAfter, moveTo, moverColor)` in `src/lib/analysis/arrows.ts:33` liefert
  **Listen**: `attacks` (jede vom gezogenen Stück angegriffene Gegnerfigur) und `attackedBy`
  (jeder Angreifer des Zielfeldes).
- `src/components/BoardPanel.tsx:128-135` zeichnet **einen Pfeil pro Listeneintrag** (orange
  `#FFAA00` für `attacks`, rot `#e5533d` für `attackedBy`), alle am Zielfeld verankert.
- Eine zentrale Dame/Turm/Läufer → viele lange Pfeile radial über das Brett = „zeigt auf die
  ganze Ansicht".

Der Fächer ist **kein** Teil von chess.coms Game Review (dort höchstens ein einzelner
erklärender Pfeil, nie alle Linien gleichzeitig — siehe Kommentar `BoardPanel.tsx:16-18`).

## Entscheidung

**Angriffs-Fächer ersatzlos entfernen.** Im Idle-Board-View bleibt nur der grüne bzw. (bei
Mistake/Blunder) schwere rot-orange **Best-Move-Vorschlagspfeil** (`getBestMoveArrow`,
severity-coded via `bestMoveArrowColor`). Das entspricht chess.coms Game-Review-Idle-Modus.

## Kernänderungen

**`src/App.tsx`**
- Das `attackArrows`-`useMemo` (Z. 130-134, Aufruf von `getAttackArrows`) entfernen.
- Die lokale `viewAttack`-Variable entfernen: Default-Zuweisung `let viewAttack = attackArrows`
  (Z. 311) sowie die `viewAttack = undefined`-Overrides in den `best`/`explain`-Zweigen
  (Z. 319, 327).
- Prop `attackArrows={viewAttack}` aus dem `<BoardPanel>`-Aufruf entfernen (Z. 359).
- `getAttackArrows` aus dem Import in Z. 12 entfernen (`getBestMoveArrow` bleibt).

**`src/components/BoardPanel.tsx`**
- Prop `attackArrows?: { attacks: string[]; attackedBy: string[] }` aus `BoardPanelProps`
  entfernen (Z. 13) und aus der Destrukturierung (Z. 110).
- Den Angriffs-Fächer-Block entfernen (Z. 128-135, die `for`-Schleifen über
  `attackArrows.attacks` / `.attackedBy`).
- Die Konstanten `ATTACKS_ARROW_COLOR` (`#FFAA00`) und `ATTACKED_BY_ARROW_COLOR` (`#e5533d`)
  entfernen (Z. 42-43) und den zugehörigen Kommentarblock (Z. 30-39) entsprechend kürzen.

**`src/lib/analysis/arrows.ts` — bewusst NICHT anfassen**
- `getAttackArrows` + `AttackArrows` bleiben stehen (dann ungenutzt), analog zur „Deliberately
  kept, currently unused"-Konvention von `getThreatArrow`/`lines.ts` weiter oben in dieser
  Datei. Grund: könnten für einen späteren separaten „Analysis"-Modus nützlich sein; so bleibt
  `src/lib/analysis/arrows.test.ts` grün (keine Test-Löschung nötig).
- **NICHT** entfernen: `threatArrow`/`candidateArrow`-Props, `THREAT_ARROW_COLOR`,
  `CANDIDATE_ARROW_COLOR`, `getThreatArrow` — bereits ungenutzt und wie oben beschrieben
  absichtlich für einen künftigen Analysis-Modus aufgehoben.

## Scope-Grenze

Nur der rot/orange Angriffs-Fächer. Grüner Best-Move-Pfeil, Feld-Tints (`CLASS_COLOR`),
Badges (`MARK_FILE`), Retry-/Explain-/Best-Sub-Modi bleiben unverändert.

## Tests

Keine neuen Logik-Tests nötig (reine UI-/Prop-Verdrahtung wird entfernt). `arrows.test.ts`
bleibt unverändert grün, weil `getAttackArrows` erhalten bleibt.

## Verifikation

- `npx tsc -b` — clean. Prüft, dass keine verwaisten Referenzen auf die entfernte Prop/
  Variable übrig sind.
- `npx vitest run` — weiterhin grün (unveränderte Testanzahl).
- **Browser (Pflicht — UI-/Rendering-Änderung):** Partie laden → `Analyze Game` → durch Züge
  navigieren, besonders zentralisierte Dame/Turm/Läufer-Züge:
  - **Kein** rot/oranger Fächer mehr über dem Brett.
  - Grüner Best-Move-Pfeil weiter da (wenn gespielt ≠ best); bei Mistake/Blunder rot-orange.

---

# Block B — UI friert bei schnellem Navigations-Spam ein

*(Übernommen aus dem ehemaligen `IMPLEMENTATION_PLAN2.md`, das dies wiederum aus
`C:\Users\Johan\.claude\plans\schreibe-einen-plan-wie-parsed-perlis.md` (Block 5.7 aus dem
Stresstest, siehe Memory `project_stresstest.md`) übernommen hatte. Gegen den Code-Stand nach
`b2bfdf0`/`780f6a4` erneut verifiziert: `src/hooks/useGame.ts` Z. 61-78 entspricht exakt der
hier beschriebenen Fünferkette `goToFirst`/`goToPrev`/`goToNext`/`goToLast`/`goToPly`.)*

## Problem

Ein Burst von ~90 Pfeiltasten-Events in unter einer Sekunde (z. B. 40× Rechts + 50× Links ohne
Pause, wie echtes OS-Key-Repeat beim Gedrückthalten) lässt den Tab für mehrere Sekunden
einfrieren (ein Screenshot-Call lief einmal in einen 30s-Timeout) und hat einmal eine React-
Warnung „Maximum update depth exceeded" ausgelöst. Die App erholt sich danach immer vollständig
(kein Crash, kein Datenverlust) — trotzdem ein echtes Robustheits-Loch beim normalen
Durchklicken einer Partie.

## Ursache

Kein Infinite-Loop-Bug im eigenen Code — alle `useEffect`/`useMemo`-Abhängigkeiten in `App.tsx`
und `useGame.ts` sind stabil. Das Problem ist Render-**Kosten**, nicht Render-**Fehler**:

1. **`react-chessboard@5.10.0`** (`node_modules/react-chessboard/dist/index.esm.js:4878-4968`)
   hat einen `useEffect` auf `[position]`, der bei jedem FEN-Wechsel bis zu 3-4 `setState`-
   Aufrufe auslöst und eine Animation startet; wird die Animation durch die nächste FEN
   unterbrochen (bei 90 Wechseln/Sekunde ständig der Fall), kommt es zu zusätzlichen
   synchronen `setState`-Kaskaden inkl. erzwungenem Layout-Reflow pro Figur
   (`getBoundingClientRect()`, Z. 5309-5333). Wahrscheinlichste Quelle der „Maximum update
   depth exceeded"-Warnung (Bibliotheks-intern, nicht unser Code).
2. **`MoveList.tsx:33-35`** (`useEffect(() => selectedRef.current?.scrollIntoView(...),
   [currentPly])`) feuert bei jedem einzelnen Ply-Wechsel einen erzwungenen Scroll-Reflow.
3. Unser eigener Code trägt indirekt bei: Jeder Tastendruck/Klick löst *sofort* ein
   `setCurrentPly` aus (`useGame.ts:61-78`), also bis zu 90 einzelne, teure Re-Render-Zyklen
   in kurzer Folge — einer pro Event, ungebremst.

Die Cascade ist reines Volumen, kein struktureller Bug. Der Fix muss an der **Eingangsrate**
ansetzen: bleiben wir unter ~60 `currentPly`-Änderungen/Sekunde, kann react-chessboard jede
Animation sauber abschließen, bevor die nächste kommt.

## Gewählter Ansatz: Navigations-Intents pro Animationsframe bündeln

Alternative erwogen und verworfen: Board-Animationen abschalten
(`animationDurationInMs: 0` in `BoardPanel.tsx`) würde das Problem auch beseitigen, opfert aber
die chess.com-Parität (sanfte Zug-Animation) — unnötig, wenn sich das Problem an der Quelle
(Eingangsrate) lösen lässt, ohne die normale UX zu verändern. Bei einem einzelnen Tastendruck
(Normalfall) ist die Bündelung nicht wahrnehmbar (~16ms Verzögerung bis zum nächsten Frame).

**Kernidee:** `goToNext`/`goToPrev`/`goToFirst`/`goToLast`/`goToPly` in `src/hooks/useGame.ts`
committen ihre Ziel-Ply nicht mehr direkt per `setCurrentPly`, sondern sammeln das
*beabsichtigte* Ziel in einer Ref und committen es gebündelt einmal pro
`requestAnimationFrame` — egal wie viele Aufrufe in der Zwischenzeit ankommen. Bei einem Burst
von 90 Events in einer Sekunde committet React trotzdem nur ~60 Mal (einmal pro Frame), und der
finale Ply ist exakt so, als wären alle 90 Events sequenziell verarbeitet worden.

Signaturen aller fünf `goTo*`-Funktionen bleiben unverändert — **kein Caller in `App.tsx`,
`NavControls.tsx`, `MoveList.tsx` oder `EvalGraph.tsx` muss angepasst werden.**

## Implementierungsskizze (`src/hooks/useGame.ts`)

```ts
// Hält den zuletzt COMMITTETEN Ply für den Fall, dass queue() aufgerufen wird, bevor
// überhaupt ein Frame geflusht wurde (pendingRef ist dann noch null).
const currentPlyRef = useRef(currentPly)
useEffect(() => { currentPlyRef.current = currentPly }, [currentPly])

const pendingRef = useRef<number | null>(null)   // beabsichtigtes, noch nicht committetes Ziel
const rafRef = useRef<number | null>(null)

useEffect(() => () => {                           // Aufräumen bei Unmount
  if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
}, [])

const flush = useCallback(() => {
  rafRef.current = null
  if (pendingRef.current !== null) {
    setCurrentPly(pendingRef.current)
    pendingRef.current = null
  }
}, [])

// compute() bekommt die Basis (letztes beabsichtigtes ODER letztes committetes Ply) und
// liefert das neue Ziel — z. B. p => Math.min(len - 1, p + 1) für goToNext.
const queue = useCallback((compute: (base: number) => number) => {
  const base = pendingRef.current ?? currentPlyRef.current
  pendingRef.current = compute(base)
  if (rafRef.current === null) rafRef.current = requestAnimationFrame(flush)
}, [flush])

const goToFirst = useCallback(() => queue(() => 0), [queue])
const goToPrev  = useCallback(() => queue((p) => Math.max(0, p - 1)), [queue])
const goToNext  = useCallback(() => queue((p) => Math.min(game.fens.length - 1, p + 1)), [queue, game.fens.length])
const goToLast  = useCallback(() => queue(() => game.fens.length - 1), [queue, game.fens.length])
const goToPly   = useCallback((ply: number) => queue(() => ply), [queue])
```

Wichtig beim Umsetzen: `goToPly` ignoriert `base` bewusst (Sprung zu einer festen Ply gewinnt
immer gegen eine noch nicht geflushte relative Bewegung) — entspricht dem heutigen Verhalten,
bei dem ein Klick in der Zugliste sofort zur Zielposition springt.

## Sekundärer, kleiner Fix: `BoardPanel.tsx` Arrows-Array memoisieren

Unabhängiger, risikoarmer Zusatzfund: `arrows` in `src/components/BoardPanel.tsx` wird bei
jedem Render neu als Literal gebaut (kein `useMemo`), obwohl react-chessboard interne
Kind-Komponenten anhand der Referenz memoisiert. Eine neue Array-Referenz bei jedem Render
verhindert diese Memoisierung — komplementär zum Haupt-Fix (der reduziert die *Anzahl* der
Renders, das hier reduziert die *Kosten pro* Render). Fix: `arrows` in ein `useMemo` verpacken
(dieselbe Logik, nur memoisiert).

**Reihenfolge-Hinweis (Interaktion mit Block A):** Block A wird zuerst umgesetzt und entfernt
dabei die `attackArrows`-Prop aus `BoardPanel.tsx` komplett. Wird Block B danach umgesetzt, hat
der Arrow-Bau-Block dann bereits keinen `attackArrows`-Zweig mehr — die `useMemo`-Deps für
`arrows` sind entsprechend:
```ts
const arrows = useMemo<Arrow[]>(() => {
  const result: Arrow[] = []
  if (bestMoveArrow) result.push({ startSquare: bestMoveArrow.from, endSquare: bestMoveArrow.to, color: bestMoveArrowColor(classification) })
  if (threatArrow) result.push({ startSquare: threatArrow.from, endSquare: threatArrow.to, color: THREAT_ARROW_COLOR })
  if (candidateArrow) result.push({ startSquare: candidateArrow.from, endSquare: candidateArrow.to, color: CANDIDATE_ARROW_COLOR })
  return result
}, [bestMoveArrow, classification, threatArrow, candidateArrow])
```
(Kein `attackArrows`/`lastMoveTo` mehr in der Deps-Liste, weil der Fächer-Zweig durch Block A
bereits entfernt wurde.) Falls Block B ausnahmsweise **vor** Block A umgesetzt wird: dann
`attackArrows` und `lastMoveTo` mit in die Deps-Liste aufnehmen, exakt wie im ursprünglichen
Fund beschrieben.

## Kritische Dateien

- `src/hooks/useGame.ts` — Haupt-Fix: rAF-gebündeltes Commit für alle fünf `goTo*`-Funktionen.
- `src/components/BoardPanel.tsx` — Sekundär-Fix: `arrows`-Array memoisieren (nach Block A:
  ohne `attackArrows` in den Deps, siehe oben).
- Keine Änderungen nötig an: `App.tsx`, `NavControls.tsx`, `MoveList.tsx`, `EvalGraph.tsx`
  (alle rufen die `goTo*`-Funktionen unverändert per Referenz auf).

## Tests

- **Kein neuer Unit-Test für die rAF-Bündelung selbst** — das Projekt testet laut `CLAUDE.md`
  gezielt die reine Logik-Schicht (`classify`, `winPct`, Eröffnungs-Match etc.); für den
  `requestAnimationFrame`/Ref-Mechanismus fehlt die Test-Infrastruktur (kein jsdom, kein
  `@testing-library/react` — `vite.config.ts` läuft mit `environment: 'node'`). Eine neue
  Testumgebung nur für diesen Fix aufzusetzen wäre unverhältnismäßig; stattdessen gezielter
  Live-Browser-Repro-Test (siehe Verifikation).

## Verifikation

- `npx vitest run` + `npx tsc -b` — müssen weiter grün/sauber sein (reine Timing-/Rendering-
  Änderung, keine Logikänderung an bestehenden Klassifizierungs-/Eval-Tests).
- **Live-Repro-Test (Browser, exakter Burst aus dem Stresstest):** `npm run dev`, eine Partie
  laden, dann in einem einzigen Batch 40× `ArrowRight` gefolgt von 50× `ArrowLeft` ohne Pause
  auslösen (genau die Sequenz, die zuvor den 30s-Screenshot-Timeout und die React-Warnung
  produzierte). Erwartung nach dem Fix: Screenshot-Call kehrt sofort zurück (kein Freeze),
  keine „Maximum update depth exceeded"-Warnung in der Konsole, finale Ply-Position stimmt mit
  der Zugliste überein. Zusätzlich: normale Einzelschritt-Navigation fühlt sich weiterhin
  sofort reaktionsschnell an (kein wahrnehmbares 16ms-Lag).
- Commit-Umfang: ein Commit für den Haupt-Fix (`useGame.ts`), optional ein zweiter für die
  `BoardPanel.tsx`-Memoisierung — analog zur bisherigen Praxis kleiner, getrennter Commits.
- Nach erfolgreicher Verifikation: Memory `project_stresstest.md` aktualisieren (das offene
  Finding aus Block 5.7 ist dann geschlossen) bzw. löschen, falls es der einzige offene Punkt
  war.

---

## Reihenfolge der beiden Blöcke

**Block A vor Block B.** Begründung: Block A ist unabhängig, kleiner und ändert dieselbe Datei
(`BoardPanel.tsx`) an einer Stelle, die Block B ebenfalls anfasst (die `arrows`-Konstruktion).
Wird Block A zuerst gemacht, ist die `useMemo`-Umstellung in Block B direkt gegen die bereits
bereinigte (fächerlose) Version zu schreiben — siehe Deps-Hinweis oben — statt sie zweimal
anzufassen.
