# Handoff / Auftrag für Claude Code — Chess Game Review

Du arbeitest am Projekt "Chess Game Review" (chess.com Game-Review-Klon).
Die vollständige Spec, Architektur und alle Formeln stehen in `CLAUDE.md` im Projekt-Root — lies sie zuerst.

---

## Wo das Projekt steht

**Stack:** Vite + React + TypeScript, Tailwind v4, chess.js, react-chessboard v5, Stockfish WASM, recharts.

**Fertig (committet):**
- Milestone 1: Schachbrett + PGN laden + Navigation + Zugliste
- Milestone 2: Stockfish-Eval für eine einzelne Stellung
- Milestone 3: Voll-Partie-Analyse + Eval-Verlaufsgraph (recharts)
- Milestone 4: Klassifizierungs-**Logik** ist gebaut (winPct / classifyMove in `src/lib/analysis/`)

**Das Problem:** Der **Test-Teil von Milestone 4 fehlt komplett.**
`npm test` meldet "Missing script: test". Es gibt kein vitest-Setup, keine Testdateien, kein `test`-Skript in `package.json`. Verfügbare Skripte aktuell: nur `dev`, `build`, `lint`, `preview`.

**Wichtige Fakten zum Setup (nicht neu erfinden):**
- Engine = npm-Paket `stockfish`, Variante `stockfish-18-lite-single` (single-threaded, kein COOP/COEP nötig).
- Engine-Dateien liegen in `public/engine/`. Der JS-Build ist ein self-contained UCI-Worker.
- Architektur strikt dreischichtig: deterministische Logik in `src/lib/`, UI in `src/components/`, Coaching (LLM) erst später. Engine bewertet — kein LLM bewertet Stellungen.

---

## SOFORT-AUFGABE (autonom erledigen)

Schließe Milestone 4 ab, indem du den fehlenden Test-Teil baust:

1. **vitest einrichten** als devDependency (passend zur Vite-Version konfigurieren).
2. **`"test": "vitest run"`** in `package.json` unter `scripts` eintragen.
3. **Tests schreiben** für die bestehende Analyse-Logik in `src/lib/analysis/`:
   - `winPct(cp)`: gegen bekannte Werte (z. B. cp 0 → 50 %), plus große positive/negative cp.
   - `classifyMove(...)`: **jede** Klassifizierungs-Schwelle aus CLAUDE.md Abschnitt 3 (Best/Excellent/Good/Inaccuracy/Mistake/Blunder) + Grenzfälle direkt an den Schwellen.
   - **Vorzeichen-Logik** explizit testen: Eval aus Sicht des ziehenden Spielers korrekt auf Weiß-Perspektive normiert (Schwarz am Zug → negiert). Das ist die typische Fehlerquelle.
4. Falls die bestehende Logik durch die Tests als fehlerhaft auffällt (z. B. Vorzeichen, Off-by-one an einer Schwelle): **die Logik korrigieren**, nicht die Tests an die Logik anpassen. Die Schwellen aus CLAUDE.md sind maßgeblich.
5. Am Ende muss **`npm test` mit Exit-Code 0** durchlaufen, ohne übersprungene Tests.

**Constraint:** Ändere nichts außerhalb von `src/lib/analysis/`, den neuen Testdateien, `package.json` und ggf. einer vitest-Config. Die Milestones 1–3 nicht anfassen.

**Verifikation:**
- `npm run` listet jetzt `test`.
- `npm test` → grün.
- `npm run build` → keine TypeScript-Fehler.

---

## Housekeeping (gleich mit erledigen)

In `CLAUDE.md` nachtragen / aktualisieren:
- Engine-Setup festhalten: Paket `stockfish`, Variante `stockfish-18-lite-single`, Dateien in `public/engine/`, self-contained UCI-Worker.
- In der Milestone-Checkliste (Abschnitt 5) Milestone 1–4 abhaken: `[ ]` → `[x]` (M4 erst nach grünen Tests).

---

## DANACH: restliche Milestones — EINS NACH DEM ANDEREN

Arbeite die folgenden Milestones **nacheinander** ab. **Nach jedem Milestone: STOPP.** Zeig mir eine kurze Zusammenfassung (was gebaut, wie testen) und warte auf mein "weiter", bevor du den nächsten beginnst. Nicht mehrere am Stück durchlaufen.

Für jeden Milestone gilt: zuerst kurzer Plan, dann bauen, reine Logik in `src/lib/` + Tests, UI in `src/components/`.

### Milestone 5 — Accuracy-%
- Pro Zug `moveAccuracy` aus dem Win-%-Verlust (Formel in CLAUDE.md Abschnitt 3.4), clamp 0–100.
- Spiel-Accuracy pro Spieler (Weiß/Schwarz) als gewichteter/harmonischer Mittelwert.
- Anzeige beider Accuracy-Werte im UI.
- Tests für `moveAccuracy` (Grenzfälle).

### Milestone 6 — Eröffnungserkennung
- ECO-Eröffnungs-DB einbinden (lichess `chess-openings`, als JSON in `src/data/`).
- Längsten passenden Zug-Prefix matchen → ECO-Name anzeigen.
- Züge, die noch in der DB sind, als **"Book"** klassifizieren (ergänzt die M4-Klassifizierung).

### Milestone 7 — Key Moments
- Die N Halbzüge mit dem größten Win-%-Delta als Wendepunkte markieren.
- Im Eval-Graph und/oder in der Zugliste hervorheben.

### Milestone 8 — Coaching-Text (Claude API)
- Pro Zug optional eine kurze natürlichsprachliche Erklärung über die Claude API.
- Nutze das Coaching-Prompt-Template aus CLAUDE.md Abschnitt 7 (Engine-Zahlen werden mitgegeben, der LLM bewertet NICHT selbst).
- Bei "Book"-Zügen keinen API-Call (Kosten sparen).

### Milestone 9 — UI-Politur
- Klassifizierungs-Icons, Eval-Bar-Feinschliff, responsives Brett.

---

## Arbeitsweise (für alle Milestones)
- Reine Logik (Mathematik) → `src/lib/` **mit Tests**. UI → `src/components/`.
- Nach jedem grünen Milestone: ich committe + pushe selbst, dann gebe ich "weiter".
- Dauerhafte Entscheidungen (Paketwahl, finale Schwellenwerte) in `CLAUDE.md` festhalten.
- Schwellenwerte aus CLAUDE.md sind Startwerte; ich tune sie später gegen echtes chess.com.
