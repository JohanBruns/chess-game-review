# Chess Review — Kompletter Plan Milestones 6–9

## Stand (fertig, committet)
- M1: Brett + PGN + Navigation
- M2: Single-Stellung Stockfish-Eval
- M3: Voll-Partie-Analyse + Eval-Graph (recharts)
- M4: Zug-Klassifizierung (Best/Excellent/Good/Inaccuracy/Mistake/Blunder) + 27 Tests
- M5: Accuracy-% pro Spieler + 13 Tests (40 Tests gesamt)

---

## Milestone 6 — ECO Eröffnungserkennung + Book-Klassifizierung

### Übersicht
- Lichess ECO-Datenbank (TSV) → JSON-Datei in `src/data/`
- Pure function `detectOpening(fens, map?)` → tiefsten Prefix-Match per EPD
- `'Book'` als neuer MoveClass-Wert; Moves bis zur letzten bekannten Opening-Stellung
- UI: Eröffnungsname + ECO-Code über dem Brett oder Zugliste

---

### Schritt 1 — ECO-Datenbeschaffung (einmalig, Node-Script)

**Datei:** `scripts/fetch-openings.mjs`

Lädt a.tsv–e.tsv von lichess-org/chess-openings (GitHub raw), parst
eco + name + epd (Spalten 0, 1, 4 im TSV), schreibt `src/data/openings.json`.

Ausführen mit: `node scripts/fetch-openings.mjs`

**Output:** `src/data/openings.json` — Array von `{ eco, name, epd }[]`
(~3 200 Einträge, ~400 KB unkomprimiert, ~80 KB gzipped)

Datei wird committed; Script muss danach nicht nochmal laufen.

---

### Schritt 2 — Opening-Logik (`src/lib/analysis/openings.ts`, neu)

```typescript
import openingsRaw from '../../data/openings.json'

export interface Opening { eco: string; name: string }

// Modul-Level Map: EPD → Opening (einmalig beim Import gebaut)
const DEFAULT_MAP = new Map<string, Opening>(
  openingsRaw.map(o => [o.epd, { eco: o.eco, name: o.name }])
)

// FEN → EPD: erste 4 Felder (ohne Halbzug- und Vollzugzähler)
export function fenToEpd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ')
}

// Tiefsten Treffer zurückgeben: iteriert rückwärts → erster Treffer = tiefste Eröffnung
export function detectOpening(
  fens: string[],
  map: Map<string, Opening> = DEFAULT_MAP
): { opening: Opening; fenPly: number } | null {
  for (let i = fens.length - 1; i >= 0; i--) {
    const match = map.get(fenToEpd(fens[i]))
    if (match) return { opening: match, fenPly: i }
  }
  return null
}
```

**Rückgabe:** `fenPly` = Index in `fens[]` der letzten bekannten Opening-Stellung.
Moves `0` bis `fenPly - 1` (0-basiert) sind Book-Züge.
Beispiel: fenPly=6 → fens[6] ist nach 6 Halbzügen → moves[0]..moves[5] sind Book.

---

### Schritt 3 — classify.ts anpassen

**MoveClass erweitern:**
```typescript
export type MoveClass = 'Book' | 'Best' | 'Excellent' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder'
```

**`buildMoveAnalyses` — neuer optionaler Parameter:**
```typescript
export function buildMoveAnalyses(
  moves: Move[],
  evalResults: (EvalResult | null)[],
  openingPly = 0,  // Anzahl Book-Züge (= fenPly aus detectOpening)
): MoveAnalysis[]
```

Im Loop vor den anderen Checks:
```typescript
if (i < openingPly) {
  analyses.push({ moveIndex: i, lossInWinPct: 0, classification: 'Book', accuracy: 100 })
  continue
}
```

**`playerAccuracy` — Book-Züge ausschließen:**
```typescript
const playerMoves = analyses.filter(a =>
  (player === 'white' ? a.moveIndex % 2 === 0 : a.moveIndex % 2 !== 0) &&
  a.classification !== 'Book'
)
```

---

### Schritt 4 — Tests

**`src/lib/analysis/openings.test.ts` (neue Datei):**
- `fenToEpd` strips halfmove + fullmove korrekt
- `detectOpening` returns null wenn kein Match
- `detectOpening` gibt korrekten Match aus einer Mock-Map zurück
- `detectOpening` gibt tiefsten Match zurück (letztes Match = deepest)
- `fenPly` ist korrekter Index in fens[]

**`classify.test.ts` Ergänzungen:**
- `buildMoveAnalyses` mit `openingPly=2`: moves[0] und moves[1] → 'Book'
- Book-Moves haben lossInWinPct=0, accuracy=100
- `playerAccuracy` zählt Book-Moves nicht
- `playerAccuracy` mit nur Book-Moves → null

---

### Schritt 5 — UI

**`src/components/OpeningBadge.tsx` (neue Komponente):**
Zeigt "C60 · Ruy Lopez" oder null. Props: `opening: Opening | null`.
Wird in `App.tsx` zwischen PgnInput und dem Brett-Bereich eingefügt.

**`MoveList` CLASS_STYLE — Book ergänzen:**
```typescript
Book: { symbol: '📖', cls: 'text-slate-400' }
```

**`App.tsx`:**
```typescript
const openingResult = useMemo(() => fens.length > 0 ? detectOpening(fens) : null, [fens])
const openingPly = openingResult?.fenPly ?? 0
// buildMoveAnalyses bekommt openingPly als dritten Parameter
```

---

## Milestone 7 — Key Moments

### Übersicht
Top-N Halbzüge mit größtem Win-%-Verlust = Wendepunkte. Hervorhebung im
Eval-Graph (farbige Punkte) und in der Zugliste (Symbol).

---

### Schritt 1 — Logik (`src/lib/analysis/classify.ts`, Ergänzung)

```typescript
export function findKeyMoments(analyses: MoveAnalysis[], n = 5): Set<number> {
  // Sortiert nach lossInWinPct absteigend, nimmt Top-N moveIndices
  // Book-Züge werden ausgeschlossen
  const sorted = [...analyses]
    .filter(a => a.classification !== 'Book')
    .sort((a, b) => b.lossInWinPct - a.lossInWinPct)
  return new Set(sorted.slice(0, n).map(a => a.moveIndex))
}
```

Rückgabe: `Set<number>` mit moveIndex-Werten. Im EvalGraph: ply = moveIndex + 1.

---

### Schritt 2 — Tests (`classify.test.ts`, Ergänzung)

- Gibt Top-3 von 5 Moves nach lossInWinPct zurück
- Gibt alle zurück wenn n > moves.length (kein Crash)
- Book-Züge ausgeschlossen
- Leeres Array → leeres Set

---

### Schritt 3 — UI

**`EvalGraph.tsx` — neue Prop `keyMomentPlies?: number[]`:**
```tsx
import { ReferenceDot } from 'recharts'

{keyMomentPlies?.map(ply => (
  <ReferenceDot key={ply} x={ply} y={data[ply]?.cp ?? 0} r={4} fill="#ef4444" stroke="none" />
))}
```

**`MoveList.tsx` — Key Moment Badge:**
Neue Prop `keyMoments: Set<number>`.
Kleines rotes Symbol (⚡) neben dem Zug-Button wenn `keyMoments.has(moveIndex)`.

**`App.tsx`:**
```typescript
const keyMoments = useMemo(
  () => moveAnalyses ? findKeyMoments(moveAnalyses) : new Set<number>(),
  [moveAnalyses]
)
const keyMomentPlies = useMemo(() => [...keyMoments].map(i => i + 1), [keyMoments])
```

---

## Milestone 8 — Coaching (Claude API)

### Übersicht
PV aus Stockfish extrahieren, API-Key via localStorage, `useCoaching` Hook,
`CoachingPanel` Komponente. Book-Züge → kein API-Call.

---

### Schritt 1 — PV in `useEngine.ts`

**`EvalResult` Erweiterung:**
```typescript
export interface EvalResult {
  cp: number | null
  mate: number | null
  bestMoveSan: string | null
  pv: string | null   // erste 5 Züge der Hauptvariante in SAN ("Nf3 Nc6 Bb5")
}
```

**In der `info`-Handler-Funktion** (ergänzen):
```typescript
const pvMatch = line.match(/ pv (.+)$/)
lastPvRef.current = pvMatch ? pvMatch[1].trim().split(' ').slice(0, 5) : []
```
Neues Ref: `const lastPvRef = useRef<string[]>([])`

**In der `bestmove`-Handler-Funktion** (beim Bauen von `finalResult`):
```typescript
function uciPvToSan(fen: string, uciMoves: string[]): string {
  const chess = new Chess(fen)
  const sans: string[] = []
  for (const uci of uciMoves) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      if (m) sans.push(m.san); else break
    } catch { break }
  }
  return sans.join(' ')
}
const pv = lastPvRef.current.length && evaluatingFenRef.current
  ? uciPvToSan(evaluatingFenRef.current, lastPvRef.current) : null

const finalResult: EvalResult = { cp: ..., mate: ..., bestMoveSan, pv }
```

**Testhelper `ev()` in classify.test.ts anpassen:**
```typescript
const ev = (cp: number, bestMoveSan = null, pv = null): EvalResult =>
  ({ cp, mate: null, bestMoveSan, pv })
```

---

### Schritt 2 — Coaching-Prompt-Funktion (`src/lib/analysis/coaching.ts`, neu)

```typescript
import { winPct } from './classify'
import type { EvalResult } from '../engine/useEngine'
import type { MoveAnalysis } from './classify'

const SYSTEM_PROMPT = `Du bist ein prägnanter Schachtrainer. Erkläre einen einzelnen Zug in
2–3 Sätzen, verständlich für ein Vereinsmitglied (ca. 1200 Elo). Bewerte die
Stellung NICHT selbst — nutze ausschließlich die gelieferten Engine-Daten.
Keine Floskeln, kein Lob ohne Inhalt. Sprache: Deutsch.`

export function buildCoachingPrompt(params: {
  fenBefore: string
  sanPlayed: string
  evalBefore: EvalResult
  evalAfter: EvalResult
  analysis: MoveAnalysis
}): string { /* befüllt das Template aus CLAUDE.md §7 */ }

export { SYSTEM_PROMPT }
```

Hilfsfunktion `formatEval(r: EvalResult): string` (cp → "+1.2", mate → "Matt in 3").

Test in `src/lib/analysis/coaching.test.ts`:
- `buildCoachingPrompt({...})` enthält FEN, SAN, Klassifizierung und Eval-Werte korrekt

---

### Schritt 3 — `useCoaching` Hook (`src/hooks/useCoaching.ts`, neu)

```typescript
export function useCoaching() {
  const [state, setState] = useState<CoachingState>(...)
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem('anthropic-key') ?? ''
  )

  const saveApiKey = (key: string) => {
    setApiKey(key); localStorage.setItem('anthropic-key', key)
  }

  const explainMove = async (params: {
    fenBefore: string; sanPlayed: string
    evalBefore: EvalResult; evalAfter: EvalResult
    analysis: MoveAnalysis
  }) => {
    if (!apiKey || params.analysis.classification === 'Book') return
    setState({ explanation: null, isLoading: true, error: null })
    const prompt = buildCoachingPrompt(params)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'API-Fehler')
      setState({ explanation: json.content[0].text, isLoading: false, error: null })
    } catch (e) {
      setState({ explanation: null, isLoading: false, error: String(e) })
    }
  }

  const reset = () => setState({ explanation: null, isLoading: false, error: null })

  return { ...state, apiKey, saveApiKey, explainMove, reset }
}
```

---

### Schritt 4 — `CoachingPanel.tsx` (neue Komponente)

Props:
```typescript
interface CoachingPanelProps {
  apiKey: string
  onSaveApiKey: (key: string) => void
  canExplain: boolean  // currentPly > 0 && analysis done && nicht Book
  onExplain: () => void
  explanation: string | null
  isLoading: boolean
  error: string | null
}
```

Layout:
- Falls `apiKey === ''`: API-Key-Eingabefeld + "Speichern"-Button (kleines Formular)
- "Zug erklären"-Button (disabled wenn !canExplain || isLoading)
- Ladeindikator: `animate-pulse`-Text
- Erklärungstext: Grauer Kasten, text-sm, Schachtrainer-Stil

**`App.tsx` Ergänzungen:**
```typescript
const { explanation, isLoading, error: coachingError, apiKey, saveApiKey, explainMove, reset }
  = useCoaching()

useEffect(() => { reset() }, [currentPly])  // Erklärung bei Zug-Wechsel zurücksetzen

const canExplain = currentPly > 0
  && evalResults[currentPly - 1] != null
  && moveAnalyses != null
  && moveAnalyses[currentPly - 1]?.classification !== 'Book'

const handleExplain = () => {
  if (!canExplain || !moveAnalyses) return
  explainMove({
    fenBefore: fens[currentPly - 1],
    sanPlayed: moves[currentPly - 1].san,
    evalBefore: evalResults[currentPly - 1]!,
    evalAfter: evalResults[currentPly]!,
    analysis: moveAnalyses[currentPly - 1],
  })
}
```

`CoachingPanel` wird nach `EvalPanel` eingefügt.

---

## Milestone 9 — UI Politur

### 9.1 — Eval-Bar (`src/components/EvalBar.tsx`, neu)

Vertikaler Balken links neben dem Brett. Weiß-Anteil wächst von unten.

```tsx
function evalToCp(r: EvalResult): number {
  if (r.cp !== null) return r.cp
  if (r.mate !== null) return r.mate > 0 ? 10000 : -10000
  return 0
}

export function EvalBar({ evalResult }: { evalResult: EvalResult | null }) {
  const pct = evalResult ? winPct(evalToCp(evalResult)) : 50

  return (
    <div className="relative flex flex-col w-5 h-[480px] overflow-hidden rounded-l">
      {/* Schwarz-Anteil oben */}
      <div className="bg-slate-900 w-full transition-all duration-300"
           style={{ height: `${100 - pct}%` }} />
      {/* Weiß-Anteil unten */}
      <div className="bg-slate-100 w-full transition-all duration-300"
           style={{ height: `${pct}%` }} />
    </div>
  )
}
```

In `App.tsx`: `EvalBar` links neben `BoardPanel` in einem gemeinsamen `flex-row`-Wrapper.
`evalResult`-Prop = `evalResults[currentPly] ?? result` (Batch-Analyse hat Vorrang).

### 9.2 — Klassifizierungs-Tooltips

`MoveList.tsx`: Allen Klassifizierungs-Spans `title={analysis.classification}` hinzufügen.
Keine weiteren Abhängigkeiten.

### 9.3 — Responsives Brett

`BoardPanel.tsx`: `w-[480px]` → `w-full max-w-[480px]`.

`App.tsx` Layout: Linke Spalte `flex-shrink-0 w-full max-w-[500px]`.

---

## Verifikation pro Milestone

### M6
```
node scripts/fetch-openings.mjs  → src/data/openings.json vorhanden
npm test   → alle Tests grün (inkl. openings.test.ts)
npm run build  → kein TS-Fehler
Browser: Ruy-Lopez-PGN laden → "C60 · Ruy Lopez" erscheint
         Erste 6 Züge zeigen 📖-Symbol in der Zugliste
```

### M7
```
npm test   → findKeyMoments Tests grün
Browser: Partie analysieren → rote Punkte im Eval-Graph
         ⚡-Symbole in der Zugliste bei denselben Zügen
```

### M8
```
npm test   → buildCoachingPrompt Test grün
Browser: Claude-API-Key eingeben (Haiku)
         Zu einem Fehler-Zug navigieren → "Zug erklären" klicken
         Erklärung erscheint in ~1-2 s
         Book-Zug → Button disabled
         Zum nächsten Zug → Erklärung reset
```

### M9
```
npm run build  → kein TS-Fehler
Browser: Eval-Bar links neben Brett sichtbar, bewegt sich bei Navigation
         Hover auf ?? → Tooltip "Blunder"
         Fenster schmäler → Brett passt sich an
```

---

## Datei-Übersicht (alle Änderungen)

| Datei | M6 | M7 | M8 | M9 |
|-------|----|----|----|----|
| `scripts/fetch-openings.mjs` | NEU | — | — | — |
| `src/data/openings.json` | NEU | — | — | — |
| `src/lib/analysis/openings.ts` | NEU | — | — | — |
| `src/lib/analysis/openings.test.ts` | NEU | — | — | — |
| `src/lib/analysis/classify.ts` | MoveClass+Book+openingPly | findKeyMoments | — | — |
| `src/lib/analysis/classify.test.ts` | Book-Tests | KM-Tests | — | — |
| `src/lib/analysis/coaching.ts` | — | — | NEU | — |
| `src/lib/analysis/coaching.test.ts` | — | — | NEU | — |
| `src/lib/engine/useEngine.ts` | — | — | pv-Feld+Parsing | — |
| `src/hooks/useCoaching.ts` | — | — | NEU | — |
| `src/components/OpeningBadge.tsx` | NEU | — | — | — |
| `src/components/EvalGraph.tsx` | — | ReferenceDot | — | — |
| `src/components/MoveList.tsx` | Book-Symbol | keyMoments-Badge | — | Tooltips |
| `src/components/CoachingPanel.tsx` | — | — | NEU | — |
| `src/components/EvalBar.tsx` | — | — | — | NEU |
| `src/App.tsx` | openingResult | keyMoments | coaching-Hook | EvalBar+Layout |

---

## Reihenfolge

M6 → M7 → M8 → M9. Jeder Milestone endet mit `npm test` (grün) + `npm run build` (fehlerfrei).
Nach jedem Milestone: Commit, dann Freigabe für den nächsten.
