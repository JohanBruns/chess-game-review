# Chess Game Review

Ein Tool, das deine Schachpartien analysiert — so wie die "Game Review"-Funktion von chess.com. Es zeigt dir, welche Züge gut und welche schlecht waren, wo du einen Fehler gemacht hast und wie du dich verbessern kannst.

<p align="center">
  <img src="docs/images/blunder.png" alt="Das Tool markiert einen Fehlzug (Blunder) direkt auf dem Brett" width="80%">
</p>

Im Beispiel oben erkennt das Tool sofort: Der Zug `Qxe5` war ein **Blunder** (ein schwerer Fehler) — die Bewertung springt um +5.47 zugunsten des Gegners. Genau solche Momente macht dir das Tool sichtbar, Zug für Zug.

Am Ende der Analyse bekommst du eine Übersicht über die ganze Partie:

<p align="center">
  <img src="docs/images/game_summary.png" alt="Zusammenfassung einer Partie mit Genauigkeit, besten Zügen und Fehlern" width="80%">
</p>

---

## Anleitung: So bekommst du das Tool zum Laufen

Du brauchst kein Programmierwissen dafür — folge einfach diesen Schritten der Reihe nach.

### Schritt 1 — Ein kleines Hilfsprogramm installieren (Node.js)

Das Tool läuft auf deinem Computer und braucht dafür ein kostenloses Hilfsprogramm namens **Node.js**.

1. Öffne [nodejs.org](https://nodejs.org)
2. Lade die Version mit der Aufschrift **"LTS"** herunter (das ist die empfohlene, stabile Version)
3. Installiere sie wie jedes andere Programm (einfach "Weiter" klicken)

### Schritt 2 — Das Projekt herunterladen

Lade dir diesen Projektordner herunter (z. B. über den grünen "Code"-Button auf GitHub → "Download ZIP") und entpacke ihn irgendwo auf deinem Computer.

### Schritt 3 — Das Tool starten

1. Öffne den entpackten Ordner
2. Öffne darin ein Terminal-Fenster (Rechtsklick im Ordner → "Terminal hier öffnen" bzw. "Open in Terminal")
3. Tippe folgenden Befehl ein und drücke Enter — das lädt einmalig alles, was das Tool zum Laufen braucht:
   ```
   npm install
   ```
4. Danach startest du das Tool mit:
   ```
   npm run dev
   ```
5. Es erscheint eine Adresse wie `http://localhost:5173` — öffne diese im Browser

Das Tool läuft jetzt bei dir lokal. Du kannst eine Partie per PGN einfügen (das ist der Text-Export einer Schachpartie) und die Analyse startet automatisch.

> Sobald du fertig bist, kannst du das Terminal-Fenster einfach schließen, um das Tool wieder zu beenden.

### Schritt 4 (optional) — Partien direkt von chess.com laden

Wenn du keine Partien manuell kopieren willst, gibt es eine kleine Browser-Erweiterung, die den "Analysieren"-Knopf direkt auf chess.com hinzufügt.

1. Öffne in Chrome die Seite `chrome://extensions`
2. Schalte oben rechts den **"Entwicklermodus"** ein
3. Klicke auf **"Entpackte Erweiterung laden"** und wähle den Ordner `extension/` aus diesem Projekt
4. Wichtig: Das Tool aus Schritt 3 muss dafür weiterhin laufen
5. Öffne jetzt eine beliebige Partie auf chess.com und klicke auf das neue Erweiterungs-Icon — die Partie öffnet sich automatisch im Analyse-Tool

Alternativ gibt es auch eine noch einfachere Variante ganz ohne Erweiterung: ein sogenanntes **Bookmarklet** (ein Lesezeichen mit eingebauter Funktion). Details dazu stehen in [`extension/README.md`](extension/README.md).

---

## Was du in der Analyse siehst

- **Zug-Bewertungen** — jeder Zug bekommt ein Label wie Beste, Gut, Ungenauigkeit, Fehler oder Blunder
- **Bewertungsverlauf** — ein Graph zeigt, wann sich die Partie zugunsten welcher Seite gedreht hat
- **Genauigkeit in %** — wie präzise jede Seite insgesamt gespielt hat
- **Eröffnungserkennung** — welche bekannte Eröffnung gespielt wurde
- **Coaching-Erklärungen** *(optional)* — kurze, verständliche Erklärungen zu einzelnen Zügen

---

## Für Entwickler:innen

<details>
<summary>Technische Details anzeigen</summary>

### Tech Stack

- **Frontend:** React 19 mit TypeScript, gebaut mit Vite
- **Brett:** react-chessboard
- **Schachlogik:** chess.js (Zugvalidierung, PGN-Parsing)
- **Engine:** Stockfish 18 (WebAssembly, läuft in einem Web Worker)
- **Graphen:** Recharts
- **Styling:** Tailwind CSS
- **Tests:** Vitest

### Architektur

Drei strikt getrennte Schichten:

1. **Engine-Schicht** — Stockfish WASM bewertet Stellungen deterministisch, kein LLM involviert
2. **UI-Schicht** — React-Komponenten für Brett, Bewertung, Graphen, Zugliste
3. **Coaching-Schicht (optional)** — Claude API erklärt die Engine-Zahlen in natürlicher Sprache, bewertet aber nicht selbst

### Nützliche Befehle

```bash
npm run dev     # Entwicklungsserver starten
npm run build   # Produktions-Build erstellen
npm run lint    # Linter ausführen
npm test        # Tests ausführen
```

### Projektstruktur

```
├── src/
│   ├── components/        # React-Komponenten (Brett, Eval, Coaching, ...)
│   ├── lib/
│   │   ├── analysis/      # Analyse-Logik (Klassifizierung, Accuracy)
│   │   └── engine/        # Engine-Kommunikation und Web Worker
│   ├── hooks/             # Custom Hooks (useGame, useCoaching)
│   ├── data/               # Statische Daten (Eröffnungsdatenbank)
│   ├── App.tsx
│   └── main.tsx
├── public/
│   ├── engine/             # Stockfish-WASM-Dateien
│   ├── pieces/             # Schachfiguren-SVGs
│   ├── sounds/             # Zug-Sounds
│   └── marks/              # Klassifizierungs-Icons
├── extension/               # Browser-Erweiterung
├── Board&Game/              # Design-Assets
└── package.json
```

### Tastenkürzel

- **Pfeiltasten links/rechts** — zwischen Zügen navigieren
- **Pos1/Ende** — zum Anfang/Ende der Partie springen

### Ressourcen

- [Stockfish Documentation](https://stockfishchess.org/)
- [chess.js Documentation](https://github.com/jhlywa/chess.js)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Lichess Opening Database](https://github.com/lichess-org/chess-openings)

</details>

---

## Mitmachen

Das ist ein privates Lernprojekt. Forke es gerne und passe es für deine eigenen Zwecke an!

## Lizenz

MIT
