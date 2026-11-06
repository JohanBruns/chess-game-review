# Using Game Review on iPhone

iOS doesn't let one app add features to another, so the analysis can't live *inside* the
chess.com app. What works instead, with no Mac and no App Store:

1. **Home Screen app** (recommended) — Game Review added to the Home Screen gets its own icon and
   opens full-screen like a regular app. Games load with one tap: *Last game* or *Paste link*.
2. **Share → Analyze** — an iOS Shortcut in the chess.com app's share sheet that opens the shared
   game straight in Game Review, but always in Safari (see below).

## Adding the Home Screen app

Open `https://chess-game-review-drab.vercel.app` in Safari → **Share** → **Add to Home Screen**,
with *Open as Web App* left on. Then enter your chess.com username once in the app.

To load a game:

- **Last game** — your newest game from chess.com's public archive. A game you just finished can
  take a few minutes to appear; the line under the buttons names the game that was loaded, so you
  can see if it's the previous one.
- **Paste link** — in the chess.com app tap **Share** → **Copy**, switch to Game Review, tap
  *Paste link* and confirm iOS's *Paste* prompt. Finds a just-finished game immediately.
- **Recent Games ▾** — pick from your latest 20 games.

Good to know:
- Nothing can open the Home Screen app from outside: iOS never routes links or Shortcuts into a
  Home Screen web app, and web apps can't register in the share sheet. Only a tap on a web push
  notification can open one — not used here, since it would need a server-side store and still
  take an extra tap.
- The Home Screen app and Safari keep separate storage: settings, saved username and the
  analysis cache don't carry over between them.

## How a shared game gets loaded

When you tap *Share* on a game, the chess.com app hands out a sentence with a link, e.g.

```
Schauen Sie sich dieses #Schachspiel an: jojo2go gegen RiCk_Prime_C137 - https://www.chess.com/game/185820408402
```

The app accepts that text from *Paste link*, as `?share=<text>`, or pasted into *PGN*, and
resolves it to a PGN (`src/lib/chesscom.ts`):

1. `/api/chesscom-game?id=…` — a small Vercel function (`api/chesscom-game.ts`) that relays
   chess.com's callback endpoint. It has the game the moment it ends. The browser can't call
   chess.com there directly (no CORS).
2. Fallback: the official public API — the monthly archives of the two players named in the
   share text (and your saved username). Can lag a few minutes behind a just-finished game.

`?pgn=`, `?username=` and `?autofetch=1` keep working as before.

## Setting up the Shortcut (optional, opens Safari)

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
