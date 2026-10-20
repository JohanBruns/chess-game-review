# Chess Analyzer — Browser Extension

Automatically loads chess.com games into the analysis tool.

## Requirement

None by default — the extension sends games to the hosted version of the app. If you're running your own local copy instead (see the main [README](../README.md#self-hosting-optional-for-your-own-independent-copy)), `npm run dev` must be running in the `game-review` folder (port 5173), and you'll need to point the extension at `http://localhost:5173`.

## Option A: Bookmarklet (no extension setup needed)

1. Create a new bookmark
2. Paste the contents of `bookmarklet.js` as the URL (one line, starts with `javascript:`)
3. Click the bookmark on a chess.com game page → the app opens

## Option B: Chrome Extension (Manifest V3)

1. Open Chrome → `chrome://extensions`
2. Turn on "Developer mode" (top right)
3. "Load unpacked" → select this `extension/` folder
4. Open a game on chess.com → click the extension icon → "Analyze Game"

## PGN Extraction (in order)

1. **Unofficial callback endpoint** — `https://www.chess.com/callback/{live|daily}/game/{id}` — available the moment the game ends. It has no PGN field, so the PGN is rebuilt from `pgnHeaders`, the TCN-encoded `moveList` (decoded to coordinate moves like `e2e4`, which chess.js accepts) and `moveTimestamps` (→ `%clk` annotations). Unofficial; may break without notice.
2. **Official public API** — `https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}` — stable, but needs a username and can lag a few minutes behind a just-finished game.
3. **`__NEXT_DATA__` script** — last resort, in case chess.com serves the page via Next.js.

## Known Limitations

- URL length limit: ~8000 characters. Very long games (500+ moves) may exceed this.
- chess.com occasionally changes its internal page structure → strategy 1 can break temporarily as a result.
- Only works for finished games; ongoing live games can be fetched via the callback endpoint.
