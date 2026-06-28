Wir bauen Milestone 2 aus CLAUDE.md: Stockfish-Anbindung für EINE Stellung.
Noch keine Voll-Partie-Analyse, keine Klassifizierung — nur: aktuelle
Stellung an die Engine schicken und das Ergebnis anzeigen.

Wichtige Vorgaben:
- Nutze das npm-Paket "stockfish" (Stockfish 18), und zwar die
  SINGLE-THREADED LITE-Variante (stockfish-18-lite-single).
  Grund: läuft OHNE COOP/COEP-Header — wir wollen KEINE Header-Konfiguration.
- Engine läuft in einem Web Worker, damit die UI nicht einfriert.
- UCI-Protokoll: uci → isready → position fen <FEN> → go depth 15;
  parse die "info ... score cp X" bzw. "score mate Y" Zeilen und "bestmove".
- Engine-Logik nach src/lib/engine/ (Schichten-Trennung aus CLAUDE.md).
- Prüf die genaue Lade-/Worker-API der installierten "stockfish"-Version
  (wie du es bei react-chessboard v5 gemacht hast) — rate nicht aus dem Gedächtnis.

UI für diesen Milestone (minimal):
- Ein Button "Stellung bewerten" unter dem Brett
- Zeigt für die aktuell angezeigte Stellung: Eval (z.B. +0.8 oder Matt in X)
  und den besten Zug der Engine
- Ladeindikator während die Engine rechnet

Zeig mir ZUERST einen Plan, inkl. wie die Stockfish-Dateien unter Vite
korrekt ausgeliefert werden (das ist die typische Stolperstelle).
Bau erst nach meiner Bestätigung.