# Anweisungen.md — Ausführungs-Workflow für IMPLEMENTATION_PLAN.md

> Diese Datei beschreibt nur den Meta-Workflow. `CLAUDE.md` (Projekt-Architektur, Stack,
> Constraints) und `IMPLEMENTATION_PLAN.md` (Feature-Spec des geführten Game-Reviews) gelten
> zusätzlich.
IMPORTANT: if you think that a certain feature can be implemented in a better/easier way than
described in the plan, feel free to act independently from this guide!

## Status

Der geführte Game-Review (Explain/Best/Next, chess.com-Stil) aus `IMPLEMENTATION_PLAN.md` ist
fertig umgesetzt (siehe dessen "Status"-Abschnitt). Diese Datei bleibt als Workflow-Vorlage für
die **nächste** Änderung an diesem Feature oder für ein neues Feature in diesem Projekt.

## Vor dem nächsten Zyklus: Stand aktiv ermitteln

Keine Fortschritts-Checkboxen pro Task hier — Status selbst prüfen, nicht annehmen:
- `git log --oneline -10` — was ist schon committed?
- Code direkt gegen `IMPLEMENTATION_PLAN.md`s "Repo ground truth"-Abschnitt prüfen — ein Block
  kann fertig, aber uncommitted sein.
- `npx tsc -b` laufen lassen, bevor ein neuer Block geplant wird (Clean-Slate-Check) — **nicht**
  `npx tsc --noEmit` (siehe unten).

## Planungsphase (Opus, `/plan`-Modus)

1. Ein gezielter Explore-Subagent, keine drei standardmäßig. Fragenliste vorher selbst
   erarbeiten: exakte Signaturen, Datei+Zeile, bestehende Helper zum Wiederverwenden.
2. **Fügt der Block `MoveClass` einen neuen Wert hinzu?** Dann sind die Konsumenten bereits
   bekannt (kein Explore-Agent nötig, nur direktes Gegenlesen):
   - `src/lib/analysis/classify.ts` — die `MoveClass`-Union selbst
   - `src/components/BoardPanel.tsx` — `MARK_FILE`, `CLASS_COLOR`
   - `src/components/ClassLegend.tsx` — `LEGEND`-Array + `counts`-Initializer
   - `src/components/MoveList.tsx` — `CLASS_ICON`
   - `src/lib/analysis/review.ts` — `reviewHeadline`s exhaustives `phrase`-Record (neu seit
     diesem Feature — nicht vergessen, das ist ein weiterer `Record<MoveClass, …>`-Konsument)
3. Braucht der Block ein neues Icon/Mark-Asset? Vor "kein Asset vorhanden → Platzhalter" erst
   `Board&Game/marks/` prüfen (Staging-Ordner für vom User bereitgestellte Assets).
4. Aktiv prüfen, ob die Spec-Formulierung im aktuellen Code überhaupt funktionieren kann, bevor
   geplant wird — nicht die Spec-Prosa einfach übernehmen. Bei Widerspruch: **AskUserQuestion**
   mit konkreten Code-Vorschau-Optionen nutzen, nicht einfach eine Interpretation wählen.
5. Separaten Plan-Subagenten nur starten, wenn der Scope sich als größer als erwartet
   herausstellt oder eine unabhängige Zweitmeinung zum Design nötig ist.
6. Plan-Datei-Struktur, die sich bewährt hat: **Context** (warum diese Änderung) →
   **Kernänderung** (Datei(en)/Signaturen mit Codeschnipsel) → **Pflicht-Folgeänderungen**
   (TS-Exhaustiveness o.ä.) → **Tests** (konkrete Zahlenbeispiele) → **Verifikation**.
7. Scope-Grenze im Plan explizit festhalten — nur den aktuellen Block, keine Nachbar-Themen.

## Ausführungsphase (Sonnet)

1. Plan-Datei abarbeiten, in der dort festgelegten Reihenfolge.
2. Verifikation: `npx vitest run` + `npx tsc -b`.
   **Nicht** `npx tsc --noEmit` — in diesem Repo ein stiller No-Op (root `tsconfig.json` hat
   `"files": []` + Project References). `npx tsc -b` ist der echte Check (= der `build`-Script
   in `package.json`).
3. Browser (`mcp__claude-in-chrome__*`) **nur**, wenn der Block tatsächlich UI/Rendering
   ändert — für reine Logik-Blöcke reichen Tests + Typecheck, das im Verifikations-Abschnitt
   des Plans explizit so begründen.
4. Falls Browser doch nötig: Aktionen bündeln (`browser_batch`), gezielt zoomen statt
   wiederholter Vollbild-Screenshots, kein Screenshot nach jedem einzelnen Klick.
5. Nach Umsetzung: `git status --short` + `git diff --stat` prüfen, dass nur die im Plan
   vorgesehenen Dateien geändert wurden (Scope-Creep-Check).
6. **Kein Commit ohne explizite Ansage des Users** — auch nicht am Ende eines erfolgreich
   verifizierten Blocks.

## Subagenten-/Browser-Disziplin

Subagenten "wenn nötig", nicht standardmäßig. Browser-Automatisierung bei UI-Änderungen
weiterhin erwünscht — Ziel ist Effizienz, nicht Vermeidung: bündeln, gezielt zoomen, nicht bei
jedem Zwischenschritt neu screenshotten.

**Bekannte Lücke: Drag-and-Drop auf dem Brett (react-chessboard v5 / dnd-kit).** Weder
`left_click_drag` noch manuell dispatchte `PointerEvent`-Sequenzen lösen dnd-kits Pointer-Sensor
zuverlässig aus. Funktionierender Workaround: die echte `options.onPieceDrop`/`canDragPiece`-
Funktion über die React-Fiber vom gemounteten `<Chessboard>` holen (`__reactFiber$...`-Key auf
einem `[data-square]`-Element, dann `.return`-Kette nach `memoizedProps.options` mit
`'boardOrientation' in options` durchsuchen) und direkt mit realistischen Argumenten aufrufen
(`{ piece: {pieceType, isSparePiece}, sourceSquare, targetSquare }`). Prüft denselben
App-Code-Pfad wie ein echter Drop; für reines UI-Feingefühl (Cursor, Snap-back) müsste der User
einmal manuell nachziehen.
