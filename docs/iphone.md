# Using Game Review on iPhone

iOS doesn't let one app add features to another, so the analysis can't live *inside* the
chess.com app. What works instead, with no Mac and no App Store:

1. **Share → Analyze** — an iOS Shortcut that shows up in the chess.com app's share sheet and
   opens the shared game straight in Game Review.
2. **Home Screen app** — Game Review added to the Home Screen gets its own icon and opens
   full-screen like a regular app.

## How a shared game gets loaded

When you tap *Share* on a game, the chess.com app hands out a sentence with a link, e.g.

```
Schauen Sie sich dieses #Schachspiel an: jojo2go gegen RiCk_Prime_C137 - https://www.chess.com/game/185820408402
```

The app accepts that text as `?share=<text>` (or pasted into *✎ Manual*) and resolves it to a
PGN (`src/lib/chesscom.ts`):

1. `/api/chesscom-game?id=…` — a small Vercel function (`api/chesscom-game.ts`) that relays
   chess.com's callback endpoint. It has the game the moment it ends. The browser can't call
   chess.com there directly (no CORS).
2. Fallback: the official public API — the monthly archives of the two players named in the
   share text (and your saved username). Can lag a few minutes behind a just-finished game.

`?pgn=`, `?username=` and `?autofetch=1` keep working as before.

## Setting up the Shortcut

1. Open the **Shortcuts** app → **+** → name it e.g. *Analyze game*.
2. Tap the **ⓘ** (details) → enable **Show in Share Sheet**. Under *Share Sheet types* keep
   **Text** and **URLs**. In the first block (*Receive … from Share Sheet*) set *If there's no
   input* to **Get Clipboard** — then the Shortcut also works on a copied link.
3. Add the action **URL Encode** — input: *Shortcut Input*.
4. Add the action **Text** with
   `https://chess-game-review-drab.vercel.app/?share=` followed by the *URL Encoded Text*
   variable (no space in between).
5. Add the action **Open URLs** — input: the *Text* from step 4.

Now in the chess.com app: finished game → **Share** → **Analyze game**. Safari opens and the
analysis starts. (If the Shortcut isn't listed, scroll the share sheet's app row to the end →
*More* / *Edit Actions* and add it.)

## Adding the Home Screen app

Open `https://chess-game-review-drab.vercel.app` in Safari → **Share** → **Add to Home Screen**.

Good to know:
- Links (including the Shortcut) always open in Safari — iOS never routes them into a Home
  Screen web app. Inside the Home Screen app, copy the game link in chess.com, then paste it
  into *✎ Manual*, or use *Recent Games* with your username.
- The Home Screen app and Safari keep separate storage: settings, saved username and the
  analysis cache don't carry over between them.
