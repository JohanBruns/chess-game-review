# Chess Analyzer — Browser Extension

Lädt chess.com-Partien automatisch ins lokale Analyse-Tool.

## Voraussetzung

`npm run dev` im `game-review`-Ordner muss laufen (Port 5173).

## Option A: Bookmarklet (kein Extension-Setup nötig)

1. Neues Lesezeichen anlegen
2. Als URL den Inhalt von `bookmarklet.js` eintragen (eine Zeile, beginnt mit `javascript:`)
3. Auf einer chess.com-Spielseite das Lesezeichen anklicken → App öffnet sich

## Option B: Chrome Extension (Manifest V3)

1. Chrome öffnen → `chrome://extensions`
2. "Entwicklermodus" einschalten (oben rechts)
3. "Entpackte Erweiterung laden" → diesen `extension/`-Ordner auswählen
4. Auf chess.com eine Partie öffnen → Extension-Icon klicken → "Partie analysieren"

## PGN-Extraktion (zwei Strategien)

1. **`__NEXT_DATA__`-Script** — schnell, kein Netzwerk-Request nötig; funktioniert wenn chess.com Next.js für diese Seite nutzt
2. **Inoffizieller Callback-Endpoint** — `https://www.chess.com/callback/live/game/{id}` — Fallback; instabil, kann wegfallen

## Bekannte Einschränkungen

- URL-Längenlimit: ~8000 Zeichen. Sehr lange Partien (500+ Züge) können das überschreiten.
- chess.com ändert gelegentlich seine interne Seitenstruktur → Strategie 1 kann dann kurzfristig brechen.
- Funktioniert nur für abgeschlossene Partien; laufende Live-Partien sind über den Callback-Endpoint abrufbar.
