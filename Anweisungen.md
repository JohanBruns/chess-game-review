# Anweisungen.md — Selbstständiger Plan→Execute-Workflow für IMPLEMENTATION_PLAN.md

IMPORTANT: if you think that a certain feature can be implemented in a better/easier way than descibed in the plan, feel free to act independently from this guide!
> Diese Datei ist so geschrieben, dass eine frische Claude-Code-Session sie zusammen mit
> `IMPLEMENTATION_PLAN.md` lesen und **ohne weitere Rückfragen zum Vorgehen** direkt mit
> dem nächsten offenen `Tx`-Block weitermachen kann. `CLAUDE.md` (Projekt-Architektur,
> Stack, Constraints) gilt weiterhin zusätzlich — diese Datei beschreibt nur den
> Meta-Workflow, mit dem die `Tx`-Blöcke aus `IMPLEMENTATION_PLAN.md` abgearbeitet werden.

## Zyklus pro Block

1. **Modellwechsel:** Planungsphase mit **Opus** im `/plan`-Modus. Nach Freigabe des Plans
   Modellwechsel auf **Sonnet** für die Umsetzung.
2. Ein Zyklus = genau **ein** `Tx`-Block aus `IMPLEMENTATION_PLAN.md`. Nie mehrere Blöcke
   gleichzeitig planen oder umsetzen, auch wenn sie im selben File stehen.
3. Nach erfolgreicher Umsetzung + Verifikation: Session-Ende oder nächster Zyklus für den
   nächsten Block. Kein Commit ohne explizite Ansage des Users.

## Schritt 0: Nächsten offenen Block ermitteln

`IMPLEMENTATION_PLAN.md` selbst hat **keine** Fortschritts-Checkboxen pro `Tx`-Block (nur
eine globale Checkliste ganz am Ende). Status also aktiv ermitteln, nicht annehmen:

- `git log --oneline -10` — welche Blöcke sind schon committed (Commit-Messages
  durchsuchen)?
- Zusätzlich den Code direkt prüfen, da ein Block fertig implementiert aber noch
  **uncommitted** sein kann (Arbeitsbaum-Status zählt genauso als "erledigt"):
  - T1: existiert `getThreatArrow` in `src/lib/analysis/arrows.ts`?
  - T2: enthält `MoveClass` in `src/lib/analysis/classify.ts` `'Miss'`?
  - T3: enthält `MoveClass` `'Forced'`?
  - T4: hat `classifyMove`/`isSacrifice` die in T4 beschriebenen zusätzlichen Guards
    (Opfer-Gegencheck, Great-Swing-Branches)?
  - T5: ist `playerAccuracy` bereits eine Volatilitäts-gewichtete + harmonische
    Aggregation statt eines simplen arithmetischen Mittels?
  - T6: ist die Best-Move-Pfeil-Unterdrückung bei Gleichheit + Toggle-States (`showBestMove`
    / `showThreats`) vorhanden? Und hat `BoardPanel` eine `orientation`-Prop (Board-Flip,
    inkl. gespiegelter Badge-Geometrie)?
  - T7: optional/Stretch — nur angehen, wenn explizit gewünscht.
- Den ersten Block, der weder committed noch im Code vorhanden ist, als nächstes bearbeiten.
- **Clean-Slate-Check, bevor der nächste Block geplant wird:** `npx tsc -b` laufen lassen
  (nicht `npx tsc --noEmit` — siehe Warnung in der Ausführungsphase). Ein vorheriger Block
  kann fertig implementiert, aber uncommitted **und** unvollständig sein (z. B. T2 hat
  `'Miss'` zu `MoveClass` hinzugefügt, aber zwei `Record<MoveClass, …>`-Maps nicht
  nachgezogen → stiller TS-Fehler). Solche Lücken vor Beginn des neuen Blocks selbst fixen,
  nicht in den Diff des neuen Blocks hineinrutschen lassen und falsch zuordnen.
- Bewusst **keine** "Stand bei Abfassung"-Momentaufnahme hier pflegen: eine solche Notiz
  dupliziert nur, was der obige Check (git log + Code-Marker) sowieso liefert, und veraltet
  bei jedem Zyklus erneut — Risiko, dass eine künftige Session ihr statt der Prüfung selbst
  vertraut. Stattdessen bei jedem Zyklus die Marker-Liste oben tatsächlich durchgehen.

## Planungsphase (Opus, `/plan`-Modus)

1. **Ein** gezielter Explore-Subagent, keine drei standardmäßig. Fragenliste vorher selbst
   erarbeiten: exakte Signaturen, Datei+Zeile, bestehende Helper zum Wiederverwenden,
   Test-Stil der bestehenden `*.test.ts`. Für alles außerhalb der bekannten `MoveClass`-
   Konsumenten-Liste (Punkt 2) gilt: welche Dateien konsumieren sonst noch den betroffenen
   Union-Typ oder ähnliche exhaustive Strukturen? Immer den relevanten Abschnitt aus
   `IMPLEMENTATION_PLAN.md` explizit im Agenten-Prompt zitieren, nicht nur "erkunde die
   Klassifizierungslogik" sagen.
2. **Fügt der Block `MoveClass` einen neuen Wert hinzu** (wie T2 `'Miss'`, T3 `'Forced'`)?
   Dann ist die Konsumenten-Liste bereits bekannt — dafür braucht es **keinen**
   Explore-Agenten, nur direktes Gegenlesen der festen Dateien:
   - `src/lib/analysis/classify.ts` — die Quelle (`MoveClass`-Union selbst)
   - `src/components/BoardPanel.tsx` — `MARK_FILE`, `CLASS_COLOR`
   - `src/components/ClassLegend.tsx` — `LEGEND`-Array + `counts`-Initializer
   - `src/components/MoveList.tsx` — `CLASS_ICON`
   - `src/hooks/useCoaching.ts` + `src/App.tsx` — Book-artige Skip-Guards (spart API-Kosten /
     verhindert nutzlose Erklär-Anfragen für die neue Klasse, falls sie wie Book/Forced keine
     Erklärung braucht)
   Diese Liste hat sich für T2 und T3 identisch bestätigt. Bei anderen exhaustiven
   Strukturen (nicht `MoveClass`) bleibt es beim Explore-Agenten aus Punkt 1.
   - **Fügt der Block stattdessen ein neues (optionales) Feld zu `MoveAnalysis` hinzu**
     (wie T5 `winPctAfterRaw`)? Auch dafür reicht ein einzelnes Grep statt eines
     Explore-Agenten: `: MoveAnalysis = {` und `MoveAnalysis[] = [` suchen (Test-/
     Coaching-Dateien, die die Struktur literal statt über `buildMoveAnalyses`
     konstruieren) — bei optionalen Feldern meist unkritisch, aber kurz gegenlesen, ob
     eine Literal-Konstruktion das Feld für ihren Testfall eigentlich bräuchte.
3. Braucht der Block ein neues Icon/Mark-Asset? Vor "kein Asset vorhanden → Platzhalter"
   erst `Board&Game/marks/` prüfen (Staging-Ordner für vom User bereitgestellte Assets,
   nicht direkt in `public/marks/`) — der `forced_128x.png`-Badge für T3 lag dort bereits.
4. Die gefundenen Dateien, die den Typ exhaustiv konsumieren, selbst kurz gegenlesen statt
   nur dem Report zu vertrauen — genau dort stecken die "Pflicht-Folgeänderungen", die
   sonst TS-Fehler verursachen.
5. **Aktiv prüfen, ob die Spec-Formulierung im aktuellen Code überhaupt funktionieren kann**,
   bevor geplant wird — nicht die Spec-Prosa einfach übernehmen. Beispiel aus T2: die Spec
   verlangte zwei Bedingungen, die im Code zufällig dieselbe Zahl sind, wodurch die Regel nie
   ausgelöst hätte. Bei Widerspruch: **AskUserQuestion** mit konkreten Code-Vorschau-Optionen
   nutzen (empfohlene Option zuerst), nicht einfach eine Interpretation wählen.
   - **Spezialfall „geclampte Zwischengröße":** Prüfen, ob ein von der Spec verlangter
     Vergleichswert aus einer bereits verlustbehafteten/geclampten Zwischengröße
     zurückgerechnet wird, statt den rohen Wert direkt zu erhalten — dann kann die Spec-
     Bedingung strukturell nie erreichbar sein. Beispiel aus T4: `classifyMove` rekonstruierte
     `winPctAfter = winPctBefore - loss`, aber `loss` wird vom Aufrufer auf `>= 0` geclampt →
     das rekonstruierte `winPctAfter` konnte `winPctBefore` nie übersteigen, obwohl genau das
     für die Great-Swing-Branches gebraucht wurde (totes Codegewissen). Fix: zusätzlichen
     Parameter mit dem rohen, ungeclampten Wert einführen (hier `winPctAfterRaw`), statt die
     Spec-Bedingung auf der geclampten Rekonstruktion laufen zu lassen.
   - **Spezialfall „Wert kippt pro Halbzug die Perspektive":** Prüfen, ob ein Wert relativ
     zur ziehenden Seite berechnet wird (z. B. "mover-perspective" cp/winPct), bevor er roh
     über mehrere Halbzüge hinweg verglichen wird (z. B. für ein Volatilitäts-/Trend-Fenster).
     Beispiel aus T5: `winPctAfterRaw` ist mover-perspective und kippt jeden Halbzug zwischen
     Weiß-/Schwarzsicht — ein Std-Dev-Fenster über die rohe Werte-Folge hätte nur den
     Perspektivwechsel selbst gemessen, nicht die tatsächliche Stellungs-Volatilität. Fix:
     vor dem Fenster-Vergleich auf eine einheitliche (z. B. Weiß-)Perspektive normalisieren.
6. Separaten Plan-Subagenten **nur** starten, wenn der Scope sich während der Exploration
   als größer als erwartet herausstellt oder eine unabhängige Zweitmeinung zum Design nötig
   ist. Bei überschaubarem Scope (ein Kern-File + wenige Pflicht-Folge-Dateien) das Design
   direkt selbst synthetisieren — spart einen Subagenten-Umweg.
7. Plan-Datei-Struktur, die sich bewährt hat:
   - **Context** — warum diese Änderung, welches Problem/Spec-Detail löst sie
   - **Kernänderung** — konkrete Datei(en)/Zeilen/Funktionssignaturen, mit Codeschnipsel
   - **Pflicht-Folgeänderungen** — eigener Abschnitt für alles, was wegen TS-Exhaustiveness
     oder ähnlicher struktureller Kopplung zwingend mitgeändert werden muss
   - **Tests** — konkrete Zahlenbeispiele (nicht nur "Testfall hinzufügen"), im Stil der
     bestehenden Tests in derselben Datei
   - **Verifikation** — explizit begründen, ob ein Browser-Check nötig ist oder nicht (siehe
     unten)
8. Scope-Grenze im Plan explizit festhalten: nur der aktuelle `Tx`-Block, andere Blöcke
   nicht anfassen, auch wenn sie im selben File stehen oder thematisch nahe liegen.

## Ausführungsphase (Sonnet)

1. Plan-Datei abarbeiten, in der dort festgelegten Reihenfolge.
2. Verifikation: `npx vitest run` + `npx tsc -b`.
   **Nicht** `npx tsc --noEmit` verwenden — das ist in diesem Repo ein stiller No-Op
   (root `tsconfig.json` hat `"files": []` + Project References, prüft also nichts).
   `npx tsc -b` ist der echte Check (= der `build`-Script in `package.json`). Diese Falle
   hat in T2 zwei fehlende `Miss`-Einträge in `Record<MoveClass, …>`-Maps unbemerkt
   durchrutschen lassen.
   Browser (`mcp__claude-in-chrome__*`) **nur**, wenn der Block tatsächlich UI/Rendering
   ändert (z. B. T6 Arrow-Rendering-Polish, die Icon-Sichtbarkeit aus T2/T4) — für reine
   Logik-Blöcke (T2, T3, T5 und der Logik-Anteil von T4) reichen Tests + Typecheck als
   Nachweis, das explizit im Verifikations-Abschnitt des Plans so begründen statt den
   Browser sicherheitshalber trotzdem zu benutzen.
3. Falls Browser doch nötig: Aktionen bündeln (`browser_batch`), gezielt zoomen statt
   wiederholter Vollbild-Screenshots, kein Screenshot nach jedem einzelnen Klick — das hat
   in einer früheren Session über 60 % des Kontextfensters verbraucht.
4. Nach Umsetzung: `git status --short` + `git diff --stat` prüfen, dass nur die im Plan
   vorgesehenen Dateien geändert wurden (Scope-Creep-Check).
5. **Kein Commit ohne explizite Ansage des Users** — auch nicht am Ende eines erfolgreich
   verifizierten Blocks.

## Subagenten-Disziplin

Subagenten "wenn nötig", nicht standardmäßig. Ein eng zugeschnittener Explore-Agent mit
konkreter Fragenliste ist besser als mehrere breite. Zusätzliche Subagenten nur, wenn sie
echte Rechercheleistung übernehmen, die sonst den Hauptkontext aufbläht (z. B. "finde alle
Stellen, die eine andere exhaustive Struktur als `MoveClass` konsumieren" — für `MoveClass`
selbst siehe die feste Liste in der Planungsphase, Punkt 2).

## Browser-Disziplin

Browser-Automatisierung ist bei UI-Änderungen weiterhin erwünscht und richtig (steht auch
so in `CLAUDE.md`) — das Ziel ist **Effizienz**, nicht Vermeidung. Regel: bündeln, gezielt
zoomen, nicht bei jedem Zwischenschritt neu screenshotten, keine redundante
"Doppelt-Prüfung" eines Zustands, den ein einzelner deterministischer Klick schon belegt
hat.
