# Milestone 4: Zug-Klassifizierung + Tests

## Context
Die Batch-Analyse aus Milestone 3 liefert `evalResults[]` (cp/mate pro Halbzug, Weiß-Perspektive). Jetzt soll daraus pro Zug ein Loss in Win-% berechnet und ein Klassifizierungs-Label (Best/Excellent/Good/Inaccuracy/Mistake/Blunder) erzeugt werden — sowohl als testbare Pure Functions als auch in der Zugliste sichtbar.

---

## 1. Vitest installieren & konfigurieren

```bash
npm install -D vitest
```

In `vite.config.ts` ein `test`-Block ergänzen:
```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { environment: 'node' },
})
```

Kein separates `vitest.config.ts` nötig. Testbefehl: `npx vitest run`.

---

## 2. Pure Functions — `src/lib/analysis/classify.ts` (neu)

### Typen
```typescript
export type MoveClass = 'Best' | 'Excellent' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder'

export interface MoveAnalysis {
  moveIndex: number        // 0-based, korrespondiert mit moves[] aus useGame
  lossInWinPct: number     // >= 0; aus Sicht des Ziehenden
  classification: MoveClass
}
```

### `winPct(cp: number): number`
Formel aus CLAUDE.md §3.1:
```typescript
export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}
```
Hilfsfunction für Mate-Scores:
```typescript
function evalToCp(r: EvalResult): number {
  if (r.cp !== null) return r.cp
  if (r.mate !== null) return r.mate > 0 ? 10000 : -10000
  return 0
}
```

### `classifyMove(loss: number, isEngineBestMove: boolean): MoveClass`
```typescript
export function classifyMove(loss: number, isEngineBestMove: boolean): MoveClass {
  if (isEngineBestMove) return 'Best'
  if (loss <= 2)  return 'Excellent'
  if (loss <= 5)  return 'Good'
  if (loss <= 10) return 'Inaccuracy'
  if (loss <= 20) return 'Mistake'
  return 'Blunder'
}
```

### `buildMoveAnalyses(moves, evalResults): MoveAnalysis[]`
Öffentliche Funktion, die alle Züge klassifiziert:
```typescript
export function buildMoveAnalyses(
  moves: Move[],
  evalResults: (EvalResult | null)[],
): MoveAnalysis[]
```

Berechnung pro Zug i (0-indexed):
- `evalBefore = evalResults[i]` (Stellung VOR Zug i)
- `evalAfter  = evalResults[i + 1]` (Stellung NACH Zug i)
- Beide müssen non-null sein, sonst überspringen (kein Eintrag)
- Ziehender ist Weiß wenn `i % 2 === 0`, sonst Schwarz
- Von Züher-Perspektive: Weiß → cp unveränder, Schwarz → cp negieren
  ```
  cpBefore_mover = isWhite ?  evalToCp(evalBefore) : -evalToCp(evalBefore)
  cpAfter_mover  = isWhite ?  evalToCp(evalAfter)  : -evalToCp(evalAfter)
  ```
- `loss = winPct(cpBefore_mover) - winPct(cpAfter_mover)`, geclampt auf ≥ 0
- `isEngineBestMove = moves[i].san === evalBefore.bestMoveSan`
- `classification = classifyMove(loss, isEngineBestMove)`

---

## 3. Tests — `src/lib/analysis/classify.test.ts` (neu)

**`winPct` Tests:**
- `winPct(0)` ≈ 50 (Symmetriemitte)
- `winPct(100)` > 50
- `winPct(-100)` < 50
- `winPct(0) + winPct(0) === 100` (Symmetrie: winPct(-x) = 100 - winPct(x))
- Konkrete Referenzwerte (1 Nachkommastelle): `winPct(200)` ≈ 72.1, `winPct(1000)` ≈ 97.5

**`classifyMove` Tests — alle Schwellen + Grenzfälle:**
| Test | Erwartung |
|---|---|
| isEngineBestMove=true, loss=0 | Best |
| isEngineBestMove=true, loss=50 | Best (Priorität!) |
| loss=0, isEngineBestMove=false | Excellent |
| loss=2 (genau) | Excellent |
| loss=2.001 | Good |
| loss=5 (genau) | Good |
| loss=5.001 | Inaccuracy |
| loss=10 (genau) | Inaccuracy |
| loss=10.001 | Mistake |
| loss=20 (genau) | Mistake |
| loss=20.001 | Blunder |
| loss=100 | Blunder |

---

## 4. MoveList anpassen — `src/components/MoveList.tsx`

**Neues Prop:**
```typescript
moveAnalyses: MoveAnalysis[] | null  // null = noch keine Analyse
```

**Darstellung:** Hinter jeder SAN-Notation ein kleines farbiges Span mit Symbol:
| Klasse | Symbol | Farbe (Tailwind) |
|---|---|---|
| Best | ★ | text-cyan-400 |
| Excellent | ✓✓ | text-green-400 |
| Good | ✓ | text-green-600 |
| Inaccuracy | ?! | text-yellow-400 |
| Mistake | ? | text-orange-400 |
| Blunder | ?? | text-red-500 |

Lookup: `moveAnalyses[i]` für moveIndex === i. Da `moveAnalyses` nach moveIndex sortiert ist, kann direkt per Index zugegriffen werden.

---

## 5. App.tsx anpassen

```typescript
import { buildMoveAnalyses } from './lib/analysis/classify'

// useMemo — wird neu berechnet, sobald evalResults vollständig ist
const moveAnalyses = useMemo(() => {
  if (evalResults.length === 0) return null
  return buildMoveAnalyses(moves, evalResults)
}, [moves, evalResults])

// An MoveList übergeben:
<MoveList
  moves={moves}
  currentPly={currentPly}
  onSelectPly={goToPly}
  moveAnalyses={moveAnalyses}
/>
```

---

## Datei-Übersicht

| Datei | Aktion |
|---|---|
| `package.json` | vitest als devDependency |
| `vite.config.ts` | `test: { environment: 'node' }` ergänzen |
| `src/lib/analysis/classify.ts` | neu — winPct, classifyMove, buildMoveAnalyses |
| `src/lib/analysis/classify.test.ts` | neu — Vitest-Tests für alle Funktionen |
| `src/components/MoveList.tsx` | moveAnalyses Prop + Annotation-Symbole |
| `src/App.tsx` | useMemo + neues Prop an MoveList |

---

## Verifikation

1. `npx vitest run` → alle Tests grün
2. `npm run dev` → Partie laden → "Partie analysieren" → Zugliste zeigt Symbole (★ ✓✓ ? ?? etc.)
3. Frühe Züge oft "Best" oder "Excellent" (Evans Gambit ist bekannte Theorie-Stellung)
4. Eventuelle Fehler (z.B. 17.Nf6+) zeigen ?! oder schlechter für den Gegner
