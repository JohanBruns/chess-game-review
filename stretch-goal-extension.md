# Anweisung an Claude Code

Füge den folgenden Abschnitt **wörtlich** in `CLAUDE.md` ein, als neuen Abschnitt am Ende (Milestone 10, Stretch Goal). Ändere sonst nichts und **baue jetzt nichts davon** — das ist reine Dokumentation für später, nachdem Milestones 4–9 fertig sind.

---

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
