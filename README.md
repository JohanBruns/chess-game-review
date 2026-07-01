# Chess Game Review

A web-based chess game analysis tool inspired by chess.com's Game Review feature. Analyze your games with real-time engine evaluation (Stockfish), move classification, accuracy metrics, and detailed coaching insights.

## Features

- **PGN/FEN Loading** — Import your games from PGN notation or load positions via FEN
- **Real-time Engine Analysis** — Stockfish WASM engine evaluates every position instantly
- **Move Classification** — Automatic move ratings (Best, Excellent, Good, Inaccuracy, Mistake, Blunder)
- **Eval Graph** — Visual representation of evaluation changes throughout the game
- **Accuracy Metrics** — Per-player accuracy percentages based on engine analysis
- **Opening Recognition** — Displays ECO opening names and classifications
- **Coaching Mode** — Optional AI-powered explanations of moves using Claude API
- **Browser Extension** — Analyze games directly from chess.com without manual PGN copying

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Modern web browser with WebAssembly support

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will start at `http://localhost:5173`. Open it in your browser and paste a PGN or FEN to begin analyzing.

### Building for Production

```bash
npm run build
```

### Linting

```bash
npm lint
```

### Running Tests

```bash
npm test
```

## Tech Stack

- **Frontend Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **UI Components:** react-chessboard for board rendering
- **Styling:** Tailwind CSS
- **Chess Logic:** chess.js for move validation and PGN parsing
- **Analysis Engine:** Stockfish 18 (WebAssembly, runs in Web Worker)
- **Charting:** Recharts for evaluation graphs
- **Testing:** Vitest for unit tests

## Architecture

The application follows a strict three-layer architecture:

1. **Engine Layer** — Stockfish WASM evaluates positions and provides deterministic analysis (no ML/LLM involvement)
2. **UI Layer** — React components for board, evaluation, graphs, and move lists
3. **Coaching Layer** (Optional) — Claude API generates natural language explanations of engine evaluations

## Keyboard Shortcuts

- **Left/Right Arrow Keys** — Navigate between moves
- **Home/End** — Jump to start/end of game

## Browser Extension

A Chrome extension is included to analyze games directly from chess.com:

### Option A: Bookmarklet (Simple)
1. Create a new bookmark
2. Paste the content of `extension/bookmarklet.js` as the URL
3. Click the bookmark on any chess.com game page

### Option B: Chrome Extension (Full-featured)
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder
4. Click the extension icon on chess.com game pages

See `extension/README.md` for more details.

## Project Structure

```
├── src/
│   ├── components/        # React components (board, eval, coaching, etc.)
│   ├── lib/
│   │   ├── analysis/      # Core analysis logic (classification, accuracy)
│   │   └── engine/        # Engine communication and Web Worker
│   ├── hooks/             # Custom React hooks (useGame, useCoaching)
│   ├── data/              # Static data (openings database)
│   ├── App.tsx
│   └── main.tsx
├── public/
│   ├── engine/            # Stockfish WASM files
│   ├── pieces/            # Chess piece SVGs
│   ├── sounds/            # Move sounds
│   └── marks/             # Classification icons
├── extension/             # Browser extension files
├── Board&Game/            # Design assets and chess piece graphics
└── package.json
```

## Contributing

This is a personal project for learning chess analysis. Feel free to fork and adapt it for your own use!

## License

MIT

## Resources

- [Stockfish Documentation](https://stockfishchess.org/)
- [chess.js Documentation](https://chillychessprogramming.github.io/chess.js/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Lichess Opening Database](https://github.com/lichess-org/chess-openings)
