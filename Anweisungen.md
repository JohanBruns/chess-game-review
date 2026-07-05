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

## Aktuell offene Blöcke (aus IMPLEMENTATION_PLAN.md)

Zwei unabhängige, noch offene Fixes (Details/Codeschnipsel in `IMPLEMENTATION_PLAN.md`,
Abschnitte "Block A" / "Block B"): **A** — roter/oranger Angriffs-Pfeil-Fächer entfernen;
**B** — Navigations-Freeze-Fix (rAF-Bündelung in `useGame.ts`).

**Reihenfolge: Block A zuerst, dann Block B.** Beide sind unabhängig genug für getrennte
Plan-/Ausführungs-Durchgänge und getrennte Commits, müssen aber nicht in derselben Session
laufen. Begründung: Block A ändert `BoardPanel.tsx` an derselben Stelle (die `arrows`-
Konstruktion), die Block B ebenfalls anfasst — nach Block A ist die `useMemo`-Umstellung in
Block B direkt gegen die bereits bereinigte (fächerlose) Version zu schreiben, statt sie
zweimal anzufassen.

Betroffene Dateien, beide Blöcke klein genug, dass **kein Explore-Agent nötig** ist — nur
direktes Gegenlesen:
- Block A: `App.tsx` (arrow-`useMemo`s + `view*`-`let`s + `<BoardPanel>`-Props),
  `BoardPanel.tsx` (Props-Interface + Arrow-Baublock + Farb-Konstanten), `arrows.ts` (nur
  lesen — bleibt unverändert).
- Block B: `useGame.ts` (alle fünf `goTo*`-Funktionen + `currentPly`-State), `BoardPanel.tsx`
  (Arrow-Bau-Block, nach Block A bereits bereinigt).

Vorab-Checks pro Block:
- **Vor Block A:** Grep nach `attackArrows`, `getAttackArrows`, `ATTACKS_ARROW_COLOR`,
  `ATTACKED_BY_ARROW_COLOR` — sicherstellen, dass diese Symbole nirgends sonst referenziert
  werden, bevor sie entfernt werden.
- **Vor Block B:** prüfen, ob Block A bereits gelandet ist (`attackArrows`-Prop existiert
  noch in `BoardPanel.tsx`?) — davon hängt ab, welche `useMemo`-Deps-Variante aus dem Plan
  greift.
- Bei Widerspruch zwischen Spec und aktuellem Code: **AskUserQuestion** mit konkreten
  Code-Vorschau-Optionen, nicht einfach eine Interpretation wählen.

**Browser ist bei beiden Blöcken Pflicht** — beide ändern Rendering/Laufzeitverhalten, reine
Tests/Typecheck reichen nicht:
- Block A: Partie laden → `Analyze Game` → durch Züge steppen, besonders zentralisierte
  Dame/Turm/Läufer-Züge → Fächer weg, grüner/roter Best-Move-Pfeil bleibt.
- Block B: den exakten Burst-Repro-Test aus dem Plan fahren (40× `ArrowRight` + 50×
  `ArrowLeft` ohne Pause) → kein Freeze, keine „Maximum update depth exceeded"-Warnung,
  Endzustand konsistent; zusätzlich Einzelschritt-Navigation auf spürbare Verzögerung prüfen
  (soll keine geben).

Nach Block B: Memory `project_stresstest.md` aktualisieren/löschen (das offene Finding aus
Block 5.7 ist dann geschlossen) — nur nach expliziter Ansage des Users, dass der Fix
committet ist.

## Vor dem nächsten Zyklus: Stand aktiv ermitteln

Keine Fortschritts-Checkboxen pro Task hier — Status selbst prüfen, nicht annehmen:
- `git log --oneline -10` — was ist schon committed?
- `git status --short` — uncommittete Änderungen sichten, bevor editiert wird.
- Code direkt gegen `IMPLEMENTATION_PLAN.md`s "Repo ground truth"-Abschnitt (bzw. bei Block
  A/B gegen deren "Kernänderungen"/"Implementierungsskizze") prüfen — ein Block kann fertig,
  aber uncommitted sein. Falls sich Zeilennummern seit Planerstellung verschoben haben, nach
  Symbolen suchen (`attackArrows`, `getAttackArrows`, `goToNext` etc.), nicht blind nach
  Zeile gehen.
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
einmal manuell nachziehen. Nur relevant, falls Block B (siehe oben) versehentlich
Drag-and-Drop-Verhalten berührt (sollte er nicht — er ändert nur Ply-Navigation, kein
`onPieceDrop`).
