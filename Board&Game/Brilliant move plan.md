## Wie Chess.com Brilliant Moves vergibt (Classification V2)

Chess.com nutzt seit Classification V2 ein "Expected Points Model": Aus Rating des Spielers und Engine-Eval wird eine Gewinnwahrscheinlichkeit zwischen 0.00 und 1.00 berechnet, und Züge werden danach klassifiziert, wie stark sich diese Expected Points durch den Zug ändern. Brilliant ist aber eine Sonderklassifikation mit eigenen Regeln oberhalb dieses Modells:

Ein Brilliant Move ist definiert als "ein guter Figurenopfer-Zug" ("a good piece sacrifice"). Zusatzbedingungen: Du darfst nach dem Zug nicht schlecht stehen, und du darfst nicht bereits komplett gewinnen, selbst wenn du den Zug nicht gefunden hättest. Außerdem ist die Definition eines Opfers für schwächere Spieler großzügiger als für höher geratete. Brilliant Moves sind dabei immer der beste oder fast beste Zug der Stellung.

Wichtig zu wissen: Stockfish selbst liefert keine Annotationen wie Brilliant oder Blunder — nur Evals und Bestmoves. Die Klassifikation bauen die Plattformen selbst auf Basis des Engine-Outputs. Die Logik musst du also komplett selbst implementieren — was du ja ohnehin vorhast.

## Die 5 Bedingungen als implementierbare Checkliste

1. **Bester (oder fast bester) Zug** — der gespielte Zug ist Stockfishs Top-Move, oder der Expected-Points-Verlust ist ≈ 0.
2. **Echtes Figurenopfer** — Material wird hergegeben oder hängen gelassen, ohne dass es durch eine simple Abtauschfolge sofort zurückgewonnen wird. Das Opfer muss "echt" sein — eine Figur, die ohnehin verloren war, zählt nicht.
3. **Position bleibt gut** — nach dem Zug stehst du nicht schlecht (Eval nach Zug z. B. ≥ −0.5 bzw. Expected Points ≥ ~0.5).
4. **Du warst nicht sowieso schon völlig gewonnen** — prüfe den zweitbesten Zug: Wenn auch ohne das Opfer die Stellung komplett gewinnend wäre, kein Brilliant. Ein Damenopfer, das in einer bereits total gewonnenen Stellung matt setzt, qualifiziert nicht.
5. **(Optional) Rating-Skalierung** — niedrigere Ratings → laxere Opfer-Definition (z. B. zählen dort schon Bauern-/Qualitätsopfer, bei hohen Ratings nur volle Figuren).

## Konkreter Algorithmus für dein Projekt

Du brauchst MultiPV ≥ 2 aus Stockfish (Top-Move + zweitbester Zug mit Evals). Der schwierige Teil ist die Opfererkennung — dafür ist **Static Exchange Evaluation (SEE)** der Standardansatz:

```typescript
function isBrilliant(ctx: MoveContext): boolean {
  const { played, best, secondBest, evalAfter, playerColor } = ctx;

  // 1. Muss (fast) der beste Zug sein
  if (played.uci !== best.uci && expectedPointsLoss(ctx) > 0.02) return false;

  // 2. Muss ein Opfer sein
  if (!isSacrifice(ctx)) return false;

  // 3. Position nach dem Zug nicht schlecht (aus Sicht des Spielers)
  if (toPlayerPerspective(evalAfter, playerColor) < -50) return false; // Centipawns

  // 4. Ohne den Zug nicht bereits klar gewonnen
  //    (zweitbester Zug darf nicht auch "completely winning" sein)
  if (secondBest && toPlayerPerspective(secondBest.eval, playerColor) > 250) return false;

  return true;
}
```

**Opfererkennung (`isSacrifice`)** — der pragmatische Ansatz, den auch Open-Source-Nachbauten wie wintrcat/freechess nutzen:

```typescript
function isSacrifice(ctx: MoveContext): boolean {
  const board = ctx.positionAfterMove;

  // Fall A: Schlagzug, bei dem weniger zurückkommt als investiert wird
  // Fall B: Eigene Figur wird en prise gestellt / hängen gelassen
  for (const square of ownPieceSquares(board, ctx.playerColor)) {
    const piece = board.get(square);
    if (piece.type === 'p' || piece.type === 'k') continue; // Bauernopfer meist ausgeschlossen

    const seeValue = staticExchangeEval(board, square, ctx.opponentColor);
    // Gegner kann auf diesem Feld Material >= Leichtfigur (3) gewinnen
    if (seeValue >= 3) return true;
  }
  return false;
}
```

SEE simuliert die vollständige Schlagfolge auf einem Feld mit Figurenwerten (P=1, N/B=3, R=5, Q=9) und liefert den Netto-Materialgewinn des Angreifers. Nur wenn der Gegner netto ≥ Leichtfigur gewinnen *könnte* und dein Eval trotzdem gut bleibt, ist es ein echtes Opfer. Für die Rating-Skalierung kannst du die Schwelle variieren: ≥ 1 (Bauer) für <1000, ≥ 2 (Qualität) für <1600, ≥ 3 (Figur) darüber.

Zwei praktische Hinweise aus Community-Nachbauten: Rechne für Bedingung 1 und 4 besser mit Gewinnwahrscheinlichkeit statt roher Centipawns (Lichess-Formel: `winPct = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`), weil 200 cp Unterschied bei 0 → +2 riesig ist, bei +8 → +10 aber irrelevant. Und behandle Mate-Scores separat (z. B. Mate = ±10000 cp gecappt), sonst bricht die Formel.

Edge Cases, die du abfangen solltest: Zug ist selbst ein Schlagzug mit positivem SEE (kein Opfer), die "geopferte" Figur war schon vor dem Zug angegriffen und ungedeckt (hing sowieso → kein Opfer), und aufeinanderfolgende Züge derselben Opferkombination (chess.com vergibt meist nur ein Brilliant pro Kombination).
