# Game Review Clone — Build-Spec (für Claude Code → als `CLAUDE.md` speichern)

> Ziel: Das „Game Review / Game Analysis"-Feature von chess.com so nah wie möglich nachbauen.
> Engine-getrieben (Stockfish WASM), Web-App. Diese Datei ist die Referenz, an die sich Claude Code halten soll.

---

## 1. Architektur (3 Schichten — strikt trennen)

1. **Engine-Schicht (deterministisch):** Stockfish bewertet jede Stellung → centipawn/mate-Eval + bester Zug. Daraus werden Eval-Bar, Graph, Klassifizierung, Accuracy berechnet. **Hier kommt KEIN LLM rein.**
2. **UI-Schicht:** Brett, Eval-Bar, Verlaufsgraph, Zug-Liste mit Klassifizierungs-Icons, Navigation.
3. **Coaching-Schicht (optional, LLM):** Claude API generiert natürlichsprachliche Erklärungen aus den Zahlen der Engine-Schicht. Niemals den LLM die Stellung *bewerten* lassen — er erklärt nur, was die Engine schon ermittelt hat.

## 2. Stack

- Vite + React + TypeScript
- `chess.js` (Legalität, PGN-Parsing, FEN)
- `react-chessboard` (Brett-UI)
- `stockfish.wasm` in einem Web Worker, UCI-Protokoll
- `recharts` (Eval-Verlaufsgraph)
- Tailwind (Styling)
- ECO-Eröffnungs-DB (lichess `chess-openings` TSV → als JSON einbinden)

## 3. chess.com-Mechanik — REFERENZ (so rechnen, nicht selbst neu erfinden)

### 3.1 Eval → Win-% (Erwartungswert)
Klassifizierung läuft NICHT über rohe Centipawns, sondern über **Win-%**, weil 100 cp Verlust bei +900 irrelevant, bei 0 dramatisch ist.

```
WinPct(cp) = 50 + 50 * ( 2 / (1 + exp(-0.00368208 * cp)) - 1 )
```
- `cp` = Eval in Centipawns aus Sicht des ziehenden Spielers (Vorzeichen entsprechend drehen).
- Mate-Scores: als sehr großes cp behandeln (z. B. ±10000), Win-% → ~0 oder ~100.

### 3.2 Zug-Klassifizierung
Pro Zug:
1. `winPctBefore` = Win-% der Stellung vor dem Zug (Sicht des Ziehenden).
2. `winPctAfter`  = Win-% nach dem gespielten Zug.
3. `loss = winPctBefore_best - winPctAfter` (Verlust ggü. dem besten Zug der Engine).

Schwellen (START-Heuristik, selbst tunen!):
| Klasse | Bedingung |
|---|---|
| **Book** | Zug noch in der Eröffnungs-DB |
| **Best** | gespielter Zug == Engine-Top-Zug |
| **Excellent** | loss ≤ 2 % |
| **Good** | 2 % < loss ≤ 5 % |
| **Inaccuracy (?!)** | 5 % < loss ≤ 10 % |
| **Mistake (?)** | 10 % < loss ≤ 20 % |
| **Blunder (??)** | loss > 20 % |

### 3.3 Spezial-Klassen (proprietär → Annäherung, optional)
- **Brilliant (!!):** Zug ist ein Materialopfer (gibst Material, das nicht sofort zurückkommt) UND ist trotzdem bester/nahezu bester Zug (loss klein) UND du stehst danach nicht verloren UND die Stellung war nicht eh schon trivial gewonnen.
- **Great (!):** gespielter Zug ist klar bester UND der Abstand zum zweitbesten Zug ist groß (= „der einzige gute Zug" in kritischer Stellung). → MultiPV=2 in Stockfish nötig.
- **Miss:** der beste Zug hätte einen großen Win-%-Sprung gebracht (z. B. Matt/gewinnende Taktik), du hast ihn verpasst → als verpasste Chance markieren.

### 3.4 Accuracy-%
Pro Zug:
```
moveAccuracy = 103.1668 * exp(-0.04354 * lossInWinPct) - 3.1669    // clamp 0..100
```
Spiel-Accuracy = gewichteter/harmonischer Mittelwert der Zug-Accuracies pro Spieler (Annäherung; lichess gewichtet nach Stellungs-Volatilität — als v2 optional).

### 3.5 Eval-Bar & Graph
- Eval-Bar: Win-% oder cp (geclampt auf z. B. ±10) als Balken.
- Graph: cp/Win-% pro Halbzug über die Partie (recharts).

### 3.6 Key Moments
Die N Halbzüge mit dem größten Win-%-Delta = Wendepunkte. Im Graph/Liste hervorheben.

## 4. Engine-Anbindung (Stockfish WASM)
- Im **Web Worker** laufen lassen → UI friert nicht ein.
- Start **single-threaded** (kein SharedArrayBuffer/COOP-COEP-Header nötig). Multi-thread erst als Optimierung.
- UCI-Flow pro Stellung: `position fen <FEN>` → `go depth 16` → `info ... score cp X | score mate Y` + `pv ...` parsen → `bestmove`.
- Für Great/Brilliant: `setoption name MultiPV value 2`.
- Feste Tiefe (15–18) für Parität; Tiefe als Einstellung. Fortschrittsbalken während Voll-Partie-Analyse.

## 5. Features (Must-haves)
- [ ] PGN/FEN laden + Brett mit Navigation (vor/zurück, Sprung)
- [ ] Eval-Bar + Verlaufsgraph
- [ ] Zug-Klassifizierung mit Icons in der Zug-Liste
- [ ] Accuracy-% pro Spieler
- [ ] Eröffnungserkennung (ECO-Name anzeigen)
- [ ] Key Moments / kritische Stellungen
- [ ] Coaching-Text pro Zug (Claude API, optional einschaltbar)

## 6. Tests (Pflicht für die Logik-Schicht)
Reine Funktionen deterministisch testen — hält Claude Code ehrlich:
- `winPct(cp)` gegen bekannte Werte
- `classify(loss)` für jede Schwelle
- `moveAccuracy(loss)` Grenzfälle
- Eröffnungs-Match (Prefix-Logik)

## 7. Coaching-Prompt-Template (Laufzeit → Claude API)
Wird pro erklärtem Zug aufgerufen. Die Engine-Zahlen sind FIX vorgegeben — der LLM bewertet nicht, er erklärt.

```
System: Du bist ein prägnanter Schachtrainer. Erkläre einen einzelnen Zug in
2–3 Sätzen, verständlich für ein Vereinsmitglied (ca. 1200 Elo). Bewerte die
Stellung NICHT selbst — nutze ausschließlich die gelieferten Engine-Daten.
Keine Floskeln, kein Lob ohne Inhalt. Sprache: Deutsch.

User:
Stellung (FEN): {fen_before}
Gespielter Zug: {san_played}
Engine-Bewertung vorher: {eval_before} ({winpct_before}%)
Engine-Bewertung nachher: {eval_after} ({winpct_after}%)
Bester Zug laut Engine: {san_best}  → Hauptvariante: {pv_best}
Klassifizierung: {classification}   (Win-%-Verlust: {loss}%)

Erkläre: Warum ist dieser Zug {classification}? Was wäre {san_best} besser
gewesen und welche konkrete Idee/Drohung steckt dahinter?
```

Tuning-Tipps für diesen Prompt:
- Engine-Zahlen IMMER mitgeben → verhindert Halluzinieren von Bewertungen.
- `{pv_best}` (Hauptvariante) mitgeben → Erklärung wird konkret statt vage.
- Länge hart begrenzen (2–3 Sätze) → wie chess.coms kurze Kommentare.
- Bei „Book" gar nicht erst den LLM aufrufen → spart API-Kosten.

## 8. Constraints / Umgebung
- Windows 10, kein Admin → alles npm/local, kein systemweiter Install.
- Erst funktionierende vertikale Slices, dann Politur (siehe Milestones).

## Milestone 10 (Stretch Goal) — chess.com-Integration via Browser-Extension

**Ziel:** Von einer offenen chess.com-Spielseite aus die Partie automatisch in dieses Analyse-Tool laden — ohne manuelles PGN-Kopieren. Erst angehen, wenn der Kern (M1–M9) steht.

Zerfällt in zwei Teilprobleme: (A) PGN von chess.com holen, (B) PGN in die App bekommen.

### (A) PGN von chess.com holen
Es gibt **keinen** offiziellen API-Endpoint, der zu einer Game-ID direkt die PGN liefert. Drei Wege, vom direktesten zum saubersten:

1. **Content-Script scrapet die Seite** — da der User eingeloggt ist und sein Spiel offen hat, steht die PGN bereits auf der Seite (Share/Download PGN). Direkt, aber fragil (bricht bei Frontend-Änderungen). Bester MVP-Weg.
2. **Inoffizieller Callback-Endpoint** — `https://www.chess.com/callback/live/game/{id}` liefert JSON inkl. PGN (Achtung: "live" und "game" sind in der URL vertauscht). Einfach, aber inoffiziell, instabil, kann ohne Vorwarnung wegfallen, und zu viele Requests riskieren eine IP-Sperre. ToS-Graubereich.
3. **Offizielle API per Nutzer + Monat** — `https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}/pgn` gibt alle Partien eines Monats als PGN. Stabil und ToS-konform, aber indirekt (Username + Monat nötig, dann das richtige Spiel rausfiltern). Rate-Limit: max. 2 gleichzeitige Requests.

**ToS-Hinweis:** Scraping und inoffizielle Endpoints sind ein Graubereich. Für private Nutzung der eigenen Spiele geringes Risiko, aber der offizielle Weg (3) ist der saubere.

### (B) PGN in die App bekommen
- Die Extension öffnet die lokal laufende App mit der PGN als URL-Parameter:
  `http://localhost:5173/?pgn=<url-codierte-PGN>`
- Die App liest beim Start `URLSearchParams`; ist `pgn` vorhanden → dekodieren → die **bestehende `loadPgn`-Funktion aus `useGame`** aufrufen (Partie lädt automatisch).
- Das Öffnen eines localhost-Tabs ist eine Navigation, kein `fetch` → keine CORS-Probleme.
- Caveat: URL-Längenlimit (~2000–8000 Zeichen). Normale Partien passen; bei sehr langen Partien Bridge über `chrome.storage` statt Query-Param.

### Aufbau (Manifest V3)
- `manifest.json`: Zugriff auf `*://*.chess.com/game/*` + Action-Button.
- Content-Script holt die PGN von der Seite.
- Button "In meinem Tool analysieren" → öffnet die localhost-App mit der PGN.

### Leichtgewichtiger Einstieg
Statt einer ganzen Extension zuerst ein **Bookmarklet** (Lesezeichen mit JS) bauen: auf der chess.com-Seite anklicken → PGN greifen → App öffnen. Ein File, ein Klick, kein Extension-Setup — gut zum Testen des Konzepts.

### Günstige Vorbereitung (kann früher passieren)
Die einzige App-seitige Änderung ist klein: beim Start `?pgn=` auslesen und an `loadPgn` übergeben. Dieser Hook kann schon vor der eigentlichen Extension eingebaut werden.
