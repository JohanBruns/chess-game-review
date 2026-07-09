# ChessEval → chess.com Game Review: Voll-Paritäts-Plan

## Kontext

Das Projekt `C:\Users\Johan\Desktop\ChessEval\game-review` (Vite + React 19 + TS + Tailwind 4 + chess.js 1.4 + react-chessboard 5.10 + recharts + Stockfish 18 lite WASM) ist ein chess.com-Game-Review-Klon. Die **Logik-Basis ist bereits stark**: 11 Zugklassen (Brilliant…Blunder), gegen 5 echte chess.com-Partien validiert, volatility-weighted Accuracy inkl. Phasen-Split, rating-aware Thresholds, Opening-Detection, Retry-Feature, 193 Vitest-Tests grün. Ziel des Users: **volle Parität zu chess.com Game Review** — Optik/Layout, Logik und Features.

Scope-Entscheidungen des Users (2026-07-08): Coach-Text **nur Templates** (wie chess.com, kein LLM); **Desktop only** (kein Mobile-Layout); **Weiterspielen-vs-Engine + Puzzles-aus-Fehlern als späte Phase**; **keine Audio-Erzählung**; **Sidebar in zwei Kapiteln wie chess.com** (Referenz-Screenshots vom 2026-07-08): Kapitel 1 = eigenständige Summary-Ansicht vor „Start Review", Kapitel 2 = Review-Ansicht nach „Start Review" (Zurück-Pfeil im Header führt zurück zu Kapitel 1) — die Ansichten ersetzen einander komplett, kein gemischtes Layout.

### Gap-Analyse (Ist vs. chess.com, Recherche Juli 2026)

| Bereich | chess.com | App heute |
|---|---|---|
| Summary-Ansicht (Kapitel 1) | Eigene Sidebar-Ansicht, ersetzt MoveList & Co. komplett: Coach-Bubble oben, Mini-Graph, Accuracy beider Spieler, Klassifikations-Zähltabelle mit Icons (einklappbar), **Game Rating (geschätzte Elo)**, Phasen-Bewertung, unten gepinnter „Start Review"-Button | Nur Inline-Accuracy-Zeile + 4-Spalten-Phasengrid in EvalPanel; kein Game Rating; kein Ansichts-Wechsel |
| Review-Ansicht (Kapitel 2) | „Start Review" wechselt in zweite Sidebar-Ansicht: Zurück-Pfeil im Header, Coach oben (Kommentar + Eval-Badge), Explain/Next-Buttons, MoveList, Graph + Nav-Controls unten; geführter Walkthrough der Key Moments | ReviewPanel unten, Template-Headline + Explain/Best/Next, kein geführter Ablauf, keine getrennte Ansicht |
| Kommentartiefe | Taktik-Themen (Gabel, hängende Figur, Mattdrohung) + **interaktive Phrasen: Hover → Pfeile/Feld-Highlights auf dem Brett** | Nur 1-Zeilen-Headline („Qxg4 is a miss") |
| Settings | Zahnrad: Best-Move-Arrow, Review-As, Brett-Badges, Autoplay, Coach an/aus | Keine Settings (nur ThemePicker) |
| Engine-Lines-Panel | MultiPV-Textliste, Hover → Pfeil | **Gebaut, aber tot**: `EngineLines.tsx`/`lines.ts` nicht in App verdrahtet; ebenso `getThreatArrow`/`getAttackArrows` |
| Extras | Weiterspielen vs. Engine, Retry mit Weiter-Flow, Zugzeiten (%clk), Share | Retry basic; %clk wird in `useGame.ts:53-55` weggestrippt; kein Share/Export |
| Optik | Montserrat-artige Font, Badge-Pop-in, Konfetti bei Top-Accuracy, feinere MoveList/Graph-Styles | Default-Font, kaum Animationen |
| Kleinkram | — | Deutscher Timeout-String in englischer UI (`useEngine.ts:~100`), Debug-`console.log('[SF]')` (`useEngine.ts:~118`) |

⚠️ Memory-Korrektur: Der im Projekt-Memory erwähnte „Claude-API-Coaching-Layer (`useCoaching.ts`/`CoachingPanel.tsx`)" **existiert nicht** (nie implementiert bzw. zu `ReviewPanel` + `review.ts`-Templates refactored). Nach Plan-Freigabe Memory aktualisieren.

## Konventionen (gelten für JEDE Phase)

- Pure Logik in `src/lib/analysis/*.ts` + colocated `*.test.ts` (Vitest); Komponenten dünn halten.
- Typecheck: `npx tsc -b` (Projekt-Referenzen — NICHT `tsc --noEmit`). `npx vitest run`: 193 Tests müssen grün bleiben.
- react-chessboard v5: einzelnes `options`-Prop. `chess.loadPgn` wirft → try/catch.
- Dev-Server: `.claude/launch.json`, Port 5199; UI-Verifikation via Preview-Tools.
- camelCase-Dateinamen, Conventional Commits.
- **Checkpoint-Regel**: Vor jedem von chess.com kopierten UI-Element das echte Game Review live im Browser (Browser-MCP) prüfen — Annahmen über chess.com-UI waren in diesem Repo schon zweimal falsch (siehe Memory).

Empfohlene Reihenfolge: 1 → 2 → 2b → 3 → 4 → 5 → 6 → 7 → 8. Phasen 1+2 liefern den größten sichtbaren Paritätssprung (Stand 2026-07-09: 1–7 erledigt — als Nächstes 8, letzte Phase). Jede Phase = eine Opus/Sonnet-Session.

### Modell-Empfehlung je Phase

| Phase | Modell | Warum |
|---|---|---|
| 1 — Game-Rating + Summary-Logik | **Sonnet** | Spec ist präzise (Signaturen, Tabelle, Testfälle vorgegeben) — pure Functions abarbeiten |
| 2 — Summary-Ansicht (Kapitel 1) | **Sonnet** | UI-Nachbau nach Live-Screenshot-Checkpoint, klare Vorlage — ✅ in alter Form ausgeführt |
| 2b — Retrofit SummaryCard → SummaryView | **Sonnet** | Mechanischer Umbau auf die Zwei-Kapitel-Architektur, Delta ist präzise spezifiziert |
| 3 — Review-Ansicht (Kapitel 2) + geführter Review | **Opus** | Live-Verhalten von chess.com muss reverse-engineert werden, State-Machine + großer App.tsx-Umbau mit vielen Interaktions-Kanten |
| 4 — Taktik-Themen + Phrasen-Highlights | **Opus** | Tiefste Phase: chess.js-Brett-Introspektion, 7 Detektoren, testreichste Phase, subtile Fehlerquellen |
| 5 — Settings + tote Features verdrahten | **Sonnet** | Mechanisches Verdrahten, Muster (useTheme) existiert bereits |
| 6 — Optik-Politur | **Sonnet** | Visuelle Angleichung per Side-by-Side, kein Algorithmus-Risiko |
| 7 — %clk, Share/Export | **Sonnet** | Isolierte, gut spezifizierte Einzelfeatures |
| 8 — Play-vs-Engine + Puzzles | **Opus** | Zweiter Request-Pfad im Engine-Worker neben der Batch-Analyse ist der heikelste Engine-Eingriff; Zustands-Wiederherstellung beim Practice-Exit |

Faustregel: Opus für die Phasen mit Reverse-Engineering, neuen Algorithmen oder Engine-Worker-Eingriffen (3, 4, 8) — Sonnet für alles, wo dieser Plan die Lösung schon konkret vorgibt (1, 2, 5, 6, 7). Im Zweifel (z. B. wenn Phase 2 beim Live-Checkpoint stark vom Plan abweicht): auf Opus hochstufen.

---

## Phase 1 — Summary-Logik + Game-Rating-Schätzer (pure lib) + Engine-Housekeeping

**Modell: Sonnet**
**Ziel:** Alle Zahlen für die Report-Card als getestete pure Functions; bekannte Engine-Warts beheben. Keine UI-Änderung.

**Neu:** `src/lib/analysis/gameRating.ts` + `.test.ts`, `src/lib/analysis/summary.ts` + `.test.ts`
**Ändern:** `src/lib/engine/useEngine.ts` — deutschen Timeout-String → Englisch; `console.log('[SF]', line)` entfernen oder DEV-gaten.

`gameRating.ts`:
```ts
export interface GameRatingInput {
  analyses: MoveAnalysis[]; player: 'white' | 'black';
  accuracy: number | null; opponentElo?: number;
}
export function estimateGameRating(input: GameRatingInput): number | null
```
Algorithmus (Konstanten exportiert & dokumentiert): (1) monotone stückweise-lineare Accuracy→Elo-Kalibrationstabelle, z. B. `[[50,250],[60,600],[70,950],[78,1350],[85,1750],[90,2050],[94,2350],[97,2600],[99,2850],[100,3100]]`; (2) Zugqualitäts-Adjustment: Malus pro Blunder/Miss/Mistake-Rate (normiert auf Nicht-Book/Forced-Züge), kleiner Bonus für Brilliant/Great; (3) Sample-Size-Dämpfung: bei < ~12 klassifizierten Zügen Richtung `opponentElo` regressieren; (4) Clamp [100, 3500], auf 50er runden (chess.com zeigt runde Zahlen). `null` bei fehlender Accuracy.

`summary.ts`:
```ts
export function classificationCounts(analyses, player): Record<MoveClass, number>
export type PhaseGrade = 'Excellent' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder'
export function phaseGrade(phaseAcc: number | null): PhaseGrade | null  // z. B. ≥90/≥75/≥60/≥45/sonst
export function buildGameSummary(...): GameSummary  // Aggregator über playerAccuracy/phaseAccuracy + obige
```
Thresholds als exportierte Konstanten (Phase-2-Checkpoint verfeinert sie gegen die Live-Site).

**Tests:** Tabellen-Endpunkte + Monotonie; „gleiche Accuracy, mehr Blunder → niedrigeres Rating"; Dämpfung; Rundung; null-Propagation; `classificationCounts` auf synthetischem Array; `phaseGrade`-Grenzwerte.
**Verify:** `npx tsc -b` sauber, Vitest grün; kein `[SF]`-Log/deutscher String mehr (grep).

---

## Phase 2 — Summary-Ansicht („Kapitel 1") + Sidebar-View-Umbau

> **Status (2026-07-08):** Phase 1 komplett erledigt. Phase 2 wurde in der ALTEN Plan-Form ausgeführt (SummaryCard als Karte im gemischten Sidebar-Stack, Kollaps-zu-Strip bei Navigation) — **vor Phase 3 zuerst Phase 2b (Retrofit, s. u.) ausführen.** Bereits erledigt und wiederverwendbar: `summary.ts`/`gameRating.ts`/`classIcons.ts` (inkl. `CLASS_DISPLAY_ORDER`), `SummaryCard.tsx`-Inhalte (Accuracy-Pills, Zähltabelle, Rating-Pills, Phasen-Zeilen), `whiteName`/`blackName` aus `useGame`, EvalPanel-Entschlackung. Live-Checkpoint-Erkenntnis aus der Umsetzung: Phasen-Zeilen zeigen NUR ein Icon (kein Grade-Wort) — chess.com druckt nirgends ein Phasen-Wort.

**Modell: Sonnet** (bei starker Abweichung am Live-Checkpoint → Opus)
**Ziel:** Nach der Analyse wechselt die Sidebar in eine eigenständige Summary-Ansicht wie chess.com — Kapitel 1 vor „Start Review". Sie **ersetzt** den kompletten bisherigen Sidebar-Inhalt (MoveList, Graph, Legend etc. sind hier NICHT sichtbar); größter sichtbarer Paritätsgewinn.

**Checkpoint zuerst:** Live-chess.com-Review öffnen und gegen die Referenz-Screenshots (2026-07-08) abgleichen: exakte Element-Reihenfolge der Summary-Ansicht, **was der Chevron zwischen Zähltabelle und Game Rating genau ein-/ausklappt**, Game-Rating-Pills, Phasen-Zeilen, Farben, wie der „Start Review"-Button unten gepinnt ist (füttert Phase 3).

**Neu:** `src/components/SummaryView.tsx` — füllt die ganze Sidebar (`overflow-y-auto`, „Start Review"-Button unten gepinnt). Reihenfolge von oben (per Referenz-Screenshots):
1. Header „Game Review".
2. Coach-Avatar links + Sprechblase mit Summary-Template („You had a nice tactical find in this game. Let's review!" — 2–3 Varianten je nach Accuracy/Brilliant-Great-Vorkommen, als pure Function in `review.ts` + Tests).
3. Mini-EvalGraph (kompakte, nicht-interaktive Variante des bestehenden Graphen).
4. Spieler-Zeile (Namen aus PGN + Avatar-Platzhalter) mit großen Accuracy-Pills darunter (helle/dunkle Pille wie chess.com).
5. Klassifikations-Zähltabelle (Icon + Klassenname in Klassenfarbe aus `classColors.ts`, W/B-Spalten — Icons aus `/marks/*.png`; die `CLASS_ICON`-Map aus `MoveList.tsx` nach `src/lib/analysis/classIcons.ts` extrahieren und beidseitig importieren), per Chevron einklappbar (Verhalten am Checkpoint klären).
6. Game-Rating-Pills (`estimateGameRating` aus Phase 1).
7. Phasen-Zeilen: Opening/Middlegame/Endgame mit `phaseGrade`-Icon je Spieler („–" wenn Phase nicht erreicht). Der „New 10 min"-Rematch-Button von chess.com entfällt (kein Pendant).
8. Unten gepinnt: großer grüner „Start Review"-Button (in Phase 2 noch ohne Funktion bzw. Platzhalter — der Wechsel nach Kapitel 2 kommt in Phase 3).

**Ändern:**
- `src/App.tsx` — neuer View-State `sidebarView: 'setup' | 'summary' | 'review'`: `'setup'` = heutige Sidebar vor/während der Analyse (EvalPanel mit Analyze-Button + Progress, MoveList, Graph …); Analyse fertig → automatisch `'summary'` (SummaryView ersetzt alles); `'review'` wird erst in Phase 3 gebaut. Brett- und Tastatur-Navigation bleiben in jeder View aktiv.
- `src/hooks/useGame.ts` — `whiteName`/`blackName` (+ `result`) aus PGN-Headern exposen (bisher nur Elo).
- `src/components/EvalPanel.tsx` — Accuracy-/Phasengrids raus (leben jetzt in SummaryView); bleibt (nur in `'setup'`): Analyze-Button + Progress + Live-Eval-Zeile.

**Verify:** Dev-Server 5199, echtes chess.com-Spiel laden, Analyze → Sidebar wechselt komplett auf SummaryView (keine MoveList mehr sichtbar); Chevron klappt ein/aus; Screenshot vs. Referenz-Screenshot; `tsc -b` + Vitest grün.

---

## Phase 2b — Retrofit: SummaryCard → SummaryView (Delta zur bereits ausgeführten alten Phase 2)

> **Status: ✅ fertig (2026-07-08, Commit `88db590`).** `sidebarView: 'setup'|'summary'|'review'` in `App.tsx`; `SummaryCard.tsx` → `SummaryView.tsx` (Vollansicht: Header, Coach-Bubble mit neuer `summaryHeadline()`-Template-Funktion in `review.ts`, Mini-EvalGraph, Accuracy-Pills, einklappbare Zähltabelle, Game-Rating, Phasen-Zeilen, unten gepinnter „Start Review"-Button). `'review'` ist bis Phase 3 ein Platzhalter (Zurück-Pfeil-Header + wiederverwendeter MoveList/EvalGraph/ClassLegend/RetryPanel/ReviewPanel-Stack). Kollaps-bei-Navigation entfernt — Kapitel bleibt bei Tastatur-Nav stehen. Live verifiziert (Partie danius777/jojo2go): Analyze → Summary-Ansicht → Start Review → Review-Ansicht (Zurück-Pfeil sichtbar, kein Start-Review-Button mehr) → Zurück-Pfeil → Summary-Ansicht, keine Konsolenfehler. 214 Tests grün, `tsc -b`/`eslint` sauber.

**Modell: Sonnet** — kleine eigene Session VOR Phase 3 (Phase 3 setzt `sidebarView` + SummaryView voraus).
**Ziel:** Die vorhandene SummaryCard-Implementierung auf die Zwei-Kapitel-Architektur heben. Reine Umbau-Phase, keine neue Analyse-Logik.

**Ist-Stand:** `SummaryCard.tsx` rendert als Karte zwischen OpeningBadge und EvalPanel im immer-sichtbaren Sidebar-Stack (`App.tsx` ~429–473); `summaryExpanded`-State expandiert nach Analyse und kollabiert bei jedem Ply-Wechsel zum Accuracy-Strip (Reset-Block in `App.tsx` ~120).

**Schritte:**
1. `sidebarView: 'setup' | 'summary' | 'review'`-State in `App.tsx` einführen; Analyse-fertig-Effekt (`wasAnalyzingRef`) setzt statt `summaryExpanded` nun `sidebarView = 'summary'`.
2. `SummaryCard.tsx` → `SummaryView.tsx` umbenennen und zur Voll-Ansicht ausbauen: bestehende Inhalte (Spieler-Zeile, Accuracy-Pills, Zähltabelle, Rating-Pills, Phasen-Icon-Zeilen) behalten; NEU dazu: „Game Review"-Header, Coach-Avatar + Sprechblase mit Summary-Template (pure Function in `review.ts` + Tests), Mini-EvalGraph, unten gepinnter grüner „Start Review"-Button (bis Phase 3 ohne Funktion).
3. Kollaps-Verhalten umbauen: `summaryExpanded` + Kollaps-bei-Navigation aus `App.tsx` entfernen (der Ansichts-Wechsel ersetzt den Kompakt-Strip); der Chevron bleibt lokal in SummaryView und klappt nur noch gemäß Live-Checkpoint (Zähltabelle o. Ä.).
4. Sidebar-Rendering verzweigen: `'setup'` = heutiger Stack (OpeningBadge, EvalPanel mit Analyze + Progress, MoveList, EvalGraph, ClassLegend, RetryPanel); `'summary'` = nur SummaryView; `'review'` = Platzhalter (kommt in Phase 3). Tastatur-/Brett-Navigation bleibt in jeder View aktiv.

**Verify:** Analyze → Sidebar wechselt komplett auf SummaryView (MoveList/Graph/Legend weg); Navigation per Pfeiltasten lässt die SummaryView stehen (kein Strip mehr); `tsc -b` + `npx vitest run` grün; Screenshot vs. Referenz-Screenshot Kapitel 1.

---

## Phase 3 — Review-Ansicht („Kapitel 2"): Geführter Review

> **Status: ✅ fertig (2026-07-09, uncommittet).** Live-Checkpoint gegen die Referenz-Screenshots (`Board&Game/review/Screenshot_3/21/22/23/24/27/28`) **widerlegte die geplante Agenda-Architektur**: chess.coms geführter Review nutzt KEINE Key-Moment-Agenda — „Start Review" springt auf **Zug 1** (Screenshot_21 öffnet auf „e4 is a book move") und „Next" steppt **Zug für Zug bis zum Ende**, der Coach kommentiert JEDEN Zug. Die idle/best/explain-Submodi entsprechen exakt dem bereits gebauten `ReviewPanel`-State-Machine (idle: Explain/[Best]/Next; best: Explain/Resume + Best-Preview mit Stern-Badge; explain: ◀/▶/Got it! + PV-Chips). Deshalb **kein `guidedReview.ts`/`useGuidedReview.ts`/`buildReviewAgenda` gebaut** (wäre gegen die Realität over-engineered) — stattdessen die vorhandene, bereits getestete Logik in eine Voll-Ansicht umgezogen. **Neu:** `src/components/ReviewView.tsx` (Kapitel-2-Sidebar: Zurück-Pfeil-Header, Coach-Bubble oben mit Klassen-Icon + Headline + Eval-Badge, Explain/Best/Next-Button-Zeile, MoveList als `flex-1`, Mini-EvalGraph unten; MoveList/Graph/RetryPanel als ReactNode-Slots von App durchgereicht). **Geändert:** `App.tsx` — `'review'`-View rendert `ReviewView`; `handleStartReview` ruft `goToPly(1)` + `setSidebarView('review')`; `handleBackToSummary` resettet zusätzlich `reviewSub`/`explainStep` (sonst friert das Summary-Brett auf einer Explain-Preview ein — beim Live-Verify gefunden+gefixt); Enter = Next im Review-idle-Modus; `coachClass` (Klassen-Icon der Bubble) abgeleitet; `'setup'`-Zweig auf OpeningBadge + EvalPanel + MoveList reduziert (ReviewPanel/ClassLegend/Graph/Retry raus — die leben jetzt in Kapitel 1/2). **Gelöscht:** `ReviewPanel.tsx` (migriert). `ClassLegend.tsx` ist jetzt verwaist (Import weg) — Löschung bleibt wie geplant Phase 6. NavControls bleiben unter dem Brett (bedienen alle drei Ansichten, inkl. Flip/Theme) statt zusätzlich in der Sidebar — bewusste Abweichung von Plan-Item 6, keine Redundanz. **Kein neuer Test nötig** (reine UI-Umlagerung getesteter Logik): 214 Vitest-Tests grün, `tsc -b` + `eslint` sauber. Live per claude-in-chrome MCP auf Port 5399 verifiziert (Scholar's Mate `?pgn=…`): Analyze → Summary → Start Review (öffnet auf e4-book, Zug 1) → Best (⭐ g6, Resume, Stern-Badge) → Explain (💡, PV-Chips) → Zurück-Pfeil (Brett zeigt echte Stellung, nicht eingefroren) → Summary; keine Konsolen-/Vite-Fehler.

**Modell: Opus**
**Ziel:** Kern-UX von chess.com: „Start Review" wechselt die Sidebar in die zweite Ansicht (Kapitel 2) — Coach oben, MoveList darunter, Graph + Nav-Controls unten, Zurück-Pfeil im Header — und führt durch die Key Moments.

**Checkpoint zuerst:** Live prüfen: Was ist der erste Stop (typisch: letzter Buchzug), springt „Next" oder steppt es jeden Zug, was sagt der Coach je Stop, wie endet der Flow (Abschluss-Summary)? Und: Was macht der Zurück-Pfeil genau — resettet er den Guided-Fortschritt oder wird bei erneutem „Start Review" fortgesetzt?

**Neu:**
- `src/lib/analysis/guidedReview.ts` + `.test.ts`:
```ts
export interface ReviewStop { ply: number; kind: 'opening' | 'keyMoment' | 'highlight' | 'end' }
export function buildReviewAgenda(analyses, keyMoments, openingPly, totalPlies): ReviewStop[]
```
Agenda = letzter Buchzug zuerst ('opening'-Stop), dann Key Moments in Partie-Reihenfolge (dedupe; Brilliant/Great als 'highlight' auch außerhalb der Top-5), 'end'-Stop am letzten Ply.
- `src/hooks/useGuidedReview.ts` — State-Machine `{ mode: 'off' | 'active', stopIndex }`, Aktionen `start/next/prev/exit`; next/prev rufen `goToPly(agenda[i].ply)`; bei manueller Navigation (MoveList-Klick, Tastatur) resynct stopIndex auf nächsten Agenda-Stop ≤ currentPly statt den Modus zu beenden.
- `src/components/ReviewView.tsx` — die komplette Kapitel-2-Sidebar (Layout per Referenz-Screenshot 3), von oben:
  1. Header: **Zurück-Pfeil** links neben „Game Review" → `sidebarView: 'summary'` (zurück zu Kapitel 1).
  2. `CoachPanel` (Subkomponente): Coach-Avatar links, Sprechblase (mit Schwänzchen) rechts — Klassifikations-Icon + Zug + Kurzkommentar („♛xf3 is best"), rechts Eval-Delta-Badge (z. B. „+3.48"). Absorbiert ReviewPanels idle/best/explain-Submodi (EINE Coach-Fläche).
  3. Button-Zeile: „Explain" | „Next" (Next grün hervorgehoben); im Guided-Mode zusätzlich Back. Ein separater „Exit Review"-Button entfällt — der Zurück-Pfeil übernimmt das.
  4. MoveList (bestehende Komponente, mit Klassifikations-Icons), nimmt den flexiblen Restplatz ein.
  5. Mini-EvalGraph unten.
  6. NavControls ganz unten (Start/Prev/Play/Next/Ende).
  RetryPanel lebt weiterhin in dieser Ansicht (unterhalb der MoveList bzw. kontextuell).

**Ändern:** `src/App.tsx` — `'review'`-View rendert ReviewView; „Start Review" in SummaryView setzt `sidebarView: 'review'` und startet den Guided-Mode am ersten Agenda-Stop; Zurück-Pfeil → `'summary'` (Guided-Verhalten laut Checkpoint); Enter = Next im Guided-Mode. `ReviewPanel.tsx` nach Migration löschen (`review.ts`-Lib bleibt). Neue Template-Strings für Opening-Stop („You played the {openingName}…") und End-Stop („White played at {rating} level…") in `review.ts` + Tests.

**Tests:** `buildReviewAgenda`-Ordnung, Dedupe, kein Opening-Stop ohne Buchzüge, End-Stop immer zuletzt.
**Verify:** Analyze → SummaryView → „Start Review" → Sidebar wechselt komplett auf ReviewView (Zurück-Pfeil sichtbar, SummaryView weg) → Next läuft alle Stops ab → endet auf End-Stop; Zurück-Pfeil führt zurück zur SummaryView; Pfeile/Badges je Stop korrekt; Tastatur-Nav in beiden Ansichten funktionsfähig.

---

## Phase 4 — Coach-Kommentar v2: Taktik-Themen + interaktive Phrasen-Highlights

> **Status: ✅ fertig (2026-07-09, uncommittet).** Vollständig wie geplant umgesetzt. **Neu:** `src/lib/analysis/tactics.ts` (+`.test.ts`, 9 Tests) — `detectThemes(move, evalBefore, evalAfter, bestPreview)` mit 7 Detektoren (`allowsMate`/`missedMate`/`mateThreat`/`missedWin`/`hangingPiece`/`fork`/`attacksHigherValue`), Bausteine `seeGain`/`PIECE_VAL` (hängende Figur via SEE≥2), `getAttackArrows` (**toter Code jetzt verdrahtet**) für Fork (≥2 höher-/gleichwertige-oder-royale Ziele) bzw. Einzel-Angriff (ungedeckte höhere Figur), Mate-Felder mover-perspektivisch (`moverMate = isWhite?mate:-mate`, wie classify), Priorität Mate>Hanging>Fork>Attacks, max. 2 Themen; jedes Theme trägt `description` (Klausel) + `ThemeHighlight{squares,arrows}`. `src/lib/analysis/commentary.ts` (+`.test.ts`, 5 Tests) — `buildCommentary(ctx): CommentToken[]`, Basis = `reviewHeadline`, hängt bis zu 2 klassifikations-passende Theme-Phrasen als Highlight-Tokens an (Blunder/Mistake/Inaccuracy→negativ+verpasst, Miss→verpasst+negativ, Best/Brilliant/Great/Excellent→positiv; sonst Fallback = reiner Headline), deterministische Connector-Variante per Ply-Parität. `src/components/CoachBubble.tsx` — rendert Tokens; Highlight-Tokens sind unterstrichene Buttons mit `onMouseEnter/Leave` (Hover-Preview) + `onClick` (Pin), aktives Token orange. **Geändert:** `BoardPanel.tsx` — tote Props `threatArrow`/`candidateArrow` (+Farbkonstanten) ENTFERNT, neu `extraArrows?:{from,to,color}[]` + `extraSquareHighlights?:Record<string,string>` (Theme-Highlights über den Last-Move-Tint gemergt; react-chessboard legt `squareStyles` auf ein inneres Overlay-Div). `ReviewView.tsx` — Coach-Bubble rendert im idle-Submodus `CoachBubble` mit Tokens statt Plain-Headline (best/explain unverändert). `App.tsx` — `hoveredHighlight`/`pinnedHighlight`-State (Reset bei Ply-Wechsel), `themes`/`commentary` memoized, `activeHighlight = hovered ?? pinned`, `extraArrows`/`extraSquareHighlights` gegated auf `sidebarView==='review' && reviewSub==='idle'`; Theme-Farben `#e2903f` (Pfeil) / `rgba(226,144,63,0.45)` (Feld). **228 Vitest-Tests grün (+14), `tsc -b`+`eslint` sauber.** Live per Preview-MCP (Port 5199) am Scholar's-Mate-`?pgn=` verifiziert: Nf6?? → Coach „Nf6 is a blunder — *it allows a forced mate*." (M1-Badge), Hover/Pin der Phrase färbt das Feld des schwarzen Königs (e8) orange, mouseout/Unpin löscht, Book-Zug (e5) fällt auf reinen Headline zurück, Theme-Highlight koexistiert konfliktfrei mit dem grünen Best-Move-Pfeil.

**Modell: Opus**
**Ziel:** Reichere Templates („Qxg4 is a miss — your queen was attacking the rook…") mit hoverbaren Phrasen, die Pfeile/Highlights aufs Brett zeichnen. Tiefste Phase; Scope strikt auf die gelisteten Detektoren.

**Neu:**
- `src/lib/analysis/tactics.ts` + `.test.ts`:
```ts
export interface ThemeHighlight { squares: Square[]; arrows: ArrowSquares[] }
export interface TacticalTheme {
  kind: 'hangingPiece' | 'fork' | 'mateThreat' | 'missedMate' | 'missedWin' | 'attacksHigherValue' | 'allowsMate'
  description: string; highlight: ThemeHighlight
}
export function detectThemes(move, evalBefore, evalAfter, bestPreview): TacticalTheme[]
```
Bausteine (großteils vorhanden): `seeGain`/`PIECE_VAL` aus `see.ts` (hängende Figuren), `getAttackArrows` aus `arrows.ts` (**hier wird der tote Code verdrahtet**), Fork via `chess.attackers` (≥2 höher-/gleichwertige ungedeckte/royale Ziele), mateThreat/allowsMate/missedMate aus `mate`-Feldern, missedWin aus Miss-Kontext. Max. 2 Themen pro Zug, Priorität Mate > Hanging > Fork > Attacks.
- `src/lib/analysis/commentary.ts` + `.test.ts`:
```ts
export type CommentToken = { text: string } | { text: string; highlight: ThemeHighlight }
export function buildCommentary(ctx): CommentToken[]
```
Templates je Klassifikation mit Themen-Fragmenten als Highlight-Tokens; Fallback = heutige `reviewHeadline`. Deterministisch (Variante per Ply-Hash) für stabile Tests.
- `src/components/CoachBubble.tsx` (oder CoachPanel erweitern) — rendert `CommentToken[]`; Highlight-Tokens unterstrichen/farbig, `onMouseEnter/Leave` (+ Click-to-pin) hebt das `ThemeHighlight` in App-State.

**Ändern:**
- `src/components/BoardPanel.tsx` — Arrow-Props generalisieren: `bestMoveArrow` bleibt, neu `extraArrows?: {from,to,color}[]` + `extraSquareHighlights?: Record<string,string>`; tote `threatArrow`/`candidateArrow`-Props entfernen (Threat-Pfeil kommt in Phase 5 via `extraArrows` zurück).
- `src/App.tsx` — `hoveredHighlight`-State; `detectThemes`/`buildCommentary` memoized für aktuellen Ply; CoachPanel konsumiert Tokens statt Plain-Headline.

**Tests:** jeder Detektor auf handgebauten FENs (hängende Dame, Springergabel, Grundreihen-Mattdrohung, verpasstes Matt-in-1); Token-Struktur. Testreichste Phase.
**Verify:** Spiel mit bekanntem Blunder: Hover auf Phrase → Pfeile erscheinen, Unhover → weg; kein Konflikt mit grünem Best-Move-Pfeil.

---

## Phase 5 — Settings-Menü + tote Features verdrahten (EngineLines, Threat-Arrow)

> **Status: ✅ fertig (2026-07-09).** `src/lib/settings.ts`/`useSettings.ts` (localStorage-Roundtrip, Muster wie `useTheme`) + `SettingsMenu.tsx` (Overlay-Modal wie `ThemePicker` statt Popover — kein Popover-Primitive im Repo, 7 Toggles + reviewAs/depth-Select). EngineLines in `EvalPanel` verdrahtet (Setup-Ansicht, Hover → Kandidaten-Pfeil via `getBestMoveArrow`), Threat-Arrow (`getThreatArrow`, rot `#e5533d`) und der automatische Best-Move-Pfeil jetzt settings-gated. **Kein `guidedReview.ts`** (existiert seit Phase 3 nicht, siehe dortiger Status) — `reviewAs` filtert stattdessen direkt die `keyMoments`-Set-Filterung in `App.tsx` (⚡-Retry-Marker) + setzt die Default-Brett-Orientierung. `useEngine.ts` nimmt einen `depth`-Parameter (12/15/18) mit depth-skaliertem Watchdog-Timeout (7 s/10 s/20 s) an. Live verifiziert (Scholar's-Mate `?pgn=`): Threat-Arrow + Best-Move-Arrow koexistieren korrekt, `reviewAs: white` filtert ⚡-Marker richtig, Board-Badges-Toggle greift sofort. 234 Vitest-Tests grün, `tsc -b` sauber.

**Modell: Sonnet**
**Ziel:** chess.com-Zahnrad mit persistierten Toggles; gebaute-aber-tote Features werden echt.

**Neu:** `src/hooks/useSettings.ts` + `src/lib/settings.ts` (Defaults/Typ + localStorage-Roundtrip, purer Teil testbar):
```ts
export interface ReviewSettings {
  showBestMoveArrow: boolean; showBoardBadges: boolean; showThreatArrow: boolean;
  showEngineLines: boolean; coachEnabled: boolean; soundEnabled: boolean;
  autoplay: boolean; reviewAs: 'white' | 'black' | 'both'; depth: 12 | 15 | 18;
}
```
localStorage-Key `gr.settings`, merge-with-defaults (forward-kompatibel), Muster wie `useTheme`. Plus `src/components/SettingsMenu.tsx` — Zahnrad-Button (bei NavControls) mit Popover-Toggles.

**Ändern:**
- `src/App.tsx` — Settings respektieren: Best-Move-Pfeil, Brett-Badges (Flag an BoardPanel), Threat-Arrow via `getThreatArrow(currentFen, evalResults[ply]?.bestMoveSan)` als roter `extraArrow`, Sounds gaten, Coach ausblendbar, `reviewAs` filtert Guided-Agenda + ⚡-Retry-Buttons und setzt Default-Orientierung; Autoplay = Intervall-goToNext (Pause bei manueller Nav).
- **`EngineLines` verdrahten**: unter der Eval-Zeile in EvalPanel wenn `showEngineLines`; Hover → Kandidaten-Pfeil via `getBestMoveArrow(currentFen, hoveredSan)` als `extraArrow`. (`lines.ts`/`EngineLines.tsx` existieren + sind getestet.)
- `src/lib/engine/useEngine.ts` — `analyzeGame(fens, depth)`; `go depth ${depth}`; Watchdog mit Depth skalieren (z. B. depth 18 → 20 s).
- `guidedReview.ts` — `reviewAs`-Filterparam (getestet).

**Tests:** `settings.ts`-Merge/Persist-Roundtrip (localStorage-Mock), Agenda-Filterung.
**Verify:** Toggles überleben Reload; Depth-18-Analyse läuft durch; EngineLines-Hover-Pfeil; Badges verschwinden bei Toggle off.

---

## Phase 6 — Optik-Politur: Font, MoveList, Animationen, Retry-Polish

> **Status: ✅ fertig (2026-07-09).** `@fontsource/montserrat` installiert, `--font-heading`/`--font-sans` in `index.css` registriert; Montserrat auf Headings/Zahlen (Game-Review-Header, Accuracy-/Rating-Pills). `MoveList`: Icon jetzt vor dem SAN, klassengefärbter SAN-Text für markante Züge, alternierende Zeilenhintergründe, engeres Padding, ⚡-Marker kleiner/gedimmt. `EvalGraph`: Gradient-Fill ergänzt (Tooltip mit Zug+Eval und Current-Ply-Cursor gab es aus Phase 3/4 schon). Animationen: Badge-Pop-in (Scale/Fade, 150 ms) auf BoardPanel-Markierungen, `animationDurationInMs: 200` für react-chessboard-Zugbewegungen, Kapitel-Wechsel-Fade (Setup/Summary/Review, 150 ms), CSS-only Confetti-Burst bei Accuracy ≥ 90 (kein Canvas/Dependency, live korrekt *nicht* ausgelöst bei 89.4 %). Retry-Polish: `correct_128x.png`/`incorrect_128x.png` als neue `resultBadge`-Prop auf `BoardPanel` (reuse der bestehenden Badge-Positionslogik), „Continue"-Button ersetzt „Try Again"/„Exit Retry" bei korrektem Zug. `ClassLegend.tsx` gelöscht (seit Phase 3 verwaist, durch SummaryView-Tabelle redundant). Dabei zwei React-Hooks-Lint-Fehler gefixt: die reviewAs→Orientation-Kopplung von `useEffect` auf das Render-Phase-„adjust state"-Pattern umgestellt (wie der bestehende `prevPly`-Block), `Math.random` im Confetti von `useMemo` auf `useState`-Lazy-Init verschoben. Live verifiziert, 234 Tests grün, `tsc -b`/`eslint` sauber.

**Modell: Sonnet**
**Ziel:** Restlichen Look-and-Feel-Gap schließen.

**Checkpoint zuerst:** App vs. Live-chess.com side-by-side; konkrete Deltas listen (Font, Spacing, MoveList-Zeilenstil, Graph) BEVOR gecodet wird.

**Items:**
- Font: `@fontsource/montserrat` (400/600/700) für Headings/Zahlen + System-UI-Stack für Body; in `index.css` `@theme` registrieren (`--font-*`).
- MoveList Richtung chess.com: alternierende Zeilen-Hintergründe, klassengefärbte SANs für markante Züge (`classColors.ts`), Icon VOR dem SAN, engeres Inline-Layout; ⚡-Key-Moment-Marker dezenter.
- EvalGraph-Feinschliff per Checkpoint (Fill-Gradient, Hover-Tooltip mit Zug+Eval, Current-Ply-Cursor).
- Animationen: Badge-Pop-in auf BoardPanel (CSS-Keyframe scale/fade ~150 ms); Konfetti/Celebration auf SummaryView bei Accuracy ≥ 90 (kleiner selbstgeschriebener Canvas/CSS-Burst, keine Dependency); Übergangs-Animation beim Kapitel-Wechsel Summary ↔ Review (Slide/Fade ~150 ms); react-chessboards `animationDurationInMs` ~200 ms setzen/prüfen.
- Retry-Polish: ungenutzte `/marks/correct.png`/`incorrect.png` als Pass/Fail-Badge auf dem Zielfeld; „Continue"-Button bei Erfolg (Retry verlassen + weiter).
- `ClassLegend` wird durch die SummaryView-Tabelle redundant → entfernen.

**Verify:** Screenshots vs. Referenz bei Desktop-Breite; Interaktions-Smoke-Test (Nav, Retry, Guided Review).

---

## Phase 7 — Extras: %clk-Zugzeiten, Share/Export, Kleinkram

> **Status: ✅ fertig (2026-07-09).** `src/lib/analysis/clocks.ts` (`parseClocks` gegen das rohe PGN vor dem Kommentar-Strip, `parseTimeControl`, `moveTimes`, `formatMoveTime`) — `useGame.ts` behält jetzt das rohe PGN und berechnet `moveTimeSeconds` beim Laden; dezentes Zeit-Label je Zug in `MoveList`. Share/Export: „Copy analysis link" baut die `?pgn=`-URL aus dem gespeicherten Roh-PGN; „Export board image" rendert Position + aktives Theme via neuem `src/lib/boardImage.ts` (`fenToPlacements`/`squarePixelRect` pur & getestet, `exportBoardImage`/`downloadBlob` als Canvas/Browser-Teil, nicht node-testbar) zu einem PNG-Download. Beide über neue 🔗/📷-Buttons in `NavControls` erreichbar. Live verifiziert: Zugzeiten gegen manuelle Clock-Rechnung bestätigt (0:02/0:01/0:08/0:04/0:05/0:15/0:01), Export-PNG zeigt per Blob-Interception die korrekte Stellung + Theme, Copy-Link-URL roundtrippt in einem frischen Tab (der eigentliche Clipboard-Write ließ sich in der automatisierten Preview wegen fehlendem Dokumentfokus nicht direkt prüfen — Environment-Limitierung, kein Code-Bug). 255 Vitest-Tests grün, `tsc -b`/`eslint` sauber.

**Modell: Sonnet**
**Neu:** `src/lib/analysis/clocks.ts` + Tests:
```ts
export function parseClocks(pgn: string): (number | null)[]       // Sekunden Restzeit je Ply
export function moveTimes(clocks, timeControl?): (number | null)[] // je Zug verbrauchte Sekunden (prevClock − clock + Inkrement)
```
RAW-PGN parsen (VOR dem Kommentar-Strip in `useGame.ts:53-55`) via `/\{\[%clk\s+([\d:.]+)\]\}/g`; `useGame` gibt `clocks` zurück. Anzeige: kleines Zeit-Label je Zug in MoveList und/oder unter Spielernamen.

**Share/Export:** „Copy analysis link" (baut `?pgn=`-URL — Inbound existiert schon in App.tsx); „Export board image" — Position auf `<canvas>` (Brett-Hintergrund + Piece-PNGs des aktiven Themes, beides URL-adressierbar) → `toBlob` → PNG-Download. Layout-Mathe pur in `src/lib/boardImage.ts`.

Plus: in Phasen 2–6 aufgelaufene Klein-Gaps bündeln.
**Verify:** chess.com-Spiel mit Clocks → plausible Zugzeiten; Copy-Link roundtrippt in frischem Tab; PNG mit korrektem Theme.

---

## Phase 8 — Weiterspielen vs. Engine + Puzzles aus Fehlern

**Modell: Opus**
**Ziel:** Die beiden großen chess.com-Umfeld-Features (User-Entscheid: beide in scope, als letzte Phase).

- **Play-out vs. Stockfish:** „Practice from here"-Button (CoachPanel/RetryPanel): interaktives Brett (Retry-Infrastruktur `attemptMove` wiederverwenden), Engine antwortet via `go movetime 500` (neuer leichtgewichtiger Play-Modus in `useEngine.ts` — separater Request-Pfad neben Batch-Analyse, gleicher Worker), Zug-Loop bis Exit/Matt; Eval-Bar läuft mit; „Exit Practice" stellt Review-Zustand wieder her.
- **Puzzles aus Fehlern:** `src/lib/analysis/puzzles.ts` + Tests — aus `moveAnalyses` alle Mistake/Miss/Blunder-Plies mit eindeutig bester Antwort (Gap zu secondBest ≥ Threshold) als Puzzle-Kandidaten extrahieren (`{fenBefore, bestSan, playedSan, classification}`); UI: „Puzzles (n)"-Button → sequenzieller Retry-Flow über alle Kandidaten (bestehendes RetryPanel-Muster mit Fortschritt „2/5" + Correct/Incorrect-Badges aus Phase 6).

**Tests:** Puzzle-Extraktion (Kandidaten-Filter, Gap-Threshold); Play-Modus-Logik soweit pur.
**Verify:** Praxis-Partie gegen Engine ab Blunder-Position spielbar; Puzzle-Durchlauf über echtes Spiel mit ≥2 Fehlern.

---

## Nacharbeit (nach Plan-Freigabe, vor Phase 1)

- Projekt-Memory korrigieren: LLM-Coaching-Layer existiert nicht (`ReviewPanel` + `review.ts`-Templates statt `useCoaching.ts`/`CoachingPanel.tsx`); `EngineLines`/Threat-Arrows aktuell unverdrahtet.
- Lokale Commits (`cbf5724`, `6bbcbb3`) sind noch nicht gepusht — vor Phase 1 pushen.

## Verifikation (gesamt)

Je Phase: `npx tsc -b` sauber + `npx vitest run` grün (193 + neue) + Live-Check auf Port 5199 via Preview-Tools. UI-Parität je Phase per Side-by-Side gegen ein echtes chess.com Game Review (Browser-MCP, eingeloggt), analog zur bewährten Brilliant/Great-Validierungsmethodik (Spiele 171190174548 u. a.).

## Referenzen

- [How does Game Review work?](https://support.chess.com/en/articles/8584089-how-does-game-review-work)
- [Game Rating Berechnung](https://support.chess.com/en/articles/10773754-how-is-game-rating-calculated-in-game-review)
- [Game Review Design-Update](https://www.chess.com/news/view/game-review-design-update)
- [Game Review v2 Features](https://www.chess.com/news/view/chesscom-launches-game-review-v2)
