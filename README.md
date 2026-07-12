# Chess Game Review

A tool that analyzes your chess games — similar to chess.com's "Game Review" feature. It shows you which moves were good, which were bad, where you went wrong, and how to improve.

<p align="center">
  <img src="docs/images/game_summary.png" alt="Summary of a game with accuracy, best moves, and mistakes" width="80%">
</p>

<p align="center">
  <img src="docs/images/blunder.png" alt="The tool flags a blunder directly on the board" width="80%">
</p>


---

## Quick Start (recommended for most people)

The fastest way to use this tool is the Chrome extension by itself — no installs, no terminal, no Node.js. Analysis runs in a hosted version of the app, so you just need the extension.

1. Download the [`extension/`](https://github.com/JohanBruns/chess-game-review/tree/main/extension) folder from this project
2. Open `chrome://extensions` in Chrome
3. Turn on **"Developer mode"** in the top right
4. Click **"Load unpacked"** and select the `extension/` folder
5. Open any finished game on chess.com and click the new extension icon — the game opens automatically in the analysis tool

There's also an even simpler option without an extension at all: a so-called **bookmarklet** (a bookmark with built-in functionality). Details in [`extension/README.md`](extension/README.md).

> The extension sends games to a hosted instance of this app by default. If you'd rather run your own private, independent copy, see **Self-Hosting** below.

---

## Self-Hosting (optional, for your own independent copy)

Run the tool entirely on your own computer instead of using the hosted version. Useful if you want to work offline, keep everything private, or just don't want to depend on someone else's server. No programming knowledge required — just follow these steps in order.

### Step 1 — Install a small helper program (Node.js)

1. Open [nodejs.org](https://nodejs.org)
2. Download the version labeled **"LTS"** (this is the recommended, stable version)
3. Install it like any other program (just click "Next")

### Step 2 — Download the project

Download this project folder (e.g. via the green "Code" button on GitHub → "Download ZIP") and unzip it anywhere on your computer.

### Step 3 — Start the tool

1. Open the unzipped folder
2. Open a terminal window inside it (right-click in the folder → "Open Terminal here" / "Open in Terminal")
3. Type the following command and press Enter — this downloads everything the tool needs, once:
   ```
   npm install
   ```
4. Then start the tool with:
   ```
   npm run dev
   ```
5. An address like `http://localhost:5173` will appear — open it in your browser

The tool is now running locally on your machine. You can paste a game as PGN (that's the text export of a chess game) and the analysis starts automatically.

> Once you're done, just close the terminal window to stop the tool.

### Step 4 — Point the extension at your local copy

By default, the extension sends games to the hosted version of the app. To use your own local copy instead:

1. Load the extension as described in **Quick Start** above
2. Open the extension popup on chess.com
3. Replace the URL field with `http://localhost:5173`
4. Make sure the tool from Step 3 is still running whenever you use the extension

---

## What you'll see in the analysis

- **Move ratings** — every move gets a label like Best, Good, Inaccuracy, Mistake, or Blunder
- **Evaluation graph** — a chart showing when the game swung in whose favor
- **Accuracy %** — how precisely each side played overall
- **Opening recognition** — which known opening was played
- **Coaching explanations** *(optional)* — short, plain-language explanations of individual moves

---

## For developers

<details>
<summary>Show technical details</summary>

### Tech Stack

- **Frontend:** React 19 with TypeScript, built with Vite
- **Board:** react-chessboard
- **Chess logic:** chess.js (move validation, PGN parsing)
- **Engine:** Stockfish 18 (WebAssembly, runs in a Web Worker)
- **Charts:** Recharts
- **Styling:** Tailwind CSS
- **Tests:** Vitest

### Architecture

Three strictly separated layers:

1. **Engine layer** — Stockfish WASM evaluates positions deterministically, no LLM involved
2. **UI layer** — React components for board, evaluation, graphs, move list
3. **Coaching layer (optional)** — Claude API explains the engine's numbers in natural language, but doesn't evaluate itself

### Useful commands

```bash
npm run dev     # start dev server
npm run build   # create production build
npm run lint    # run linter
npm test        # run tests
```

### Project structure

```
├── src/
│   ├── components/        # React components (board, eval, coaching, ...)
│   ├── lib/
│   │   ├── analysis/      # Analysis logic (classification, accuracy)
│   │   └── engine/        # Engine communication and Web Worker
│   ├── hooks/             # Custom hooks (useGame, useCoaching)
│   ├── data/               # Static data (openings database)
│   ├── App.tsx
│   └── main.tsx
├── public/
│   ├── engine/             # Stockfish WASM files
│   ├── pieces/             # Chess piece SVGs
│   ├── sounds/             # Move sounds
│   └── marks/              # Classification icons
├── extension/               # Browser extension
├── Board&Game/              # Design assets
└── package.json
```

### Keyboard shortcuts

- **Left/Right arrow keys** — navigate between moves
- **Home/End** — jump to start/end of game

### Resources

- [Stockfish Documentation](https://stockfishchess.org/)
- [chess.js Documentation](https://github.com/jhlywa/chess.js)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Lichess Opening Database](https://github.com/lichess-org/chess-openings)

</details>

---

## Contributing

This is a personal learning project. Feel free to fork it and adapt it for your own use!

## License

MIT
