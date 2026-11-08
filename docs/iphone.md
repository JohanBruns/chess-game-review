# Using Game Review on iPhone

iOS doesn't let one app add features to another, so the analysis can't live *inside* the
chess.com app. What works instead, with no Mac and no App Store:

1. **Home Screen app** — Game Review added to the Home Screen gets its own icon and opens
   full-screen like a regular app. Opening it loads and analyzes your newest game by itself.
2. **Share → notification → app** — an iOS Shortcut in the chess.com app's share sheet sends the
   game to your phone as a notification. One tap on it opens the Home Screen app with the game.

## Adding the Home Screen app

Open `https://chess-game-review-drab.vercel.app` in Safari → **Share** → **Add to Home Screen**,
with *Open as Web App* left on. Then enter your chess.com username once in the app.

To load a game:

- **Just open the app** — it loads and analyzes your newest game on its own: when it starts, and
  when you come back to it after at least a minute away (e.g. after playing a game). A game that
  chess.com lists only later, while the app is open, is offered in a banner (*New game vs. … —
  Analyze*); the app keeps looking for five minutes after each opening. Turn it off in
  **Settings → Open my newest game on start**.
- **Analyze last game** — loads and analyzes your newest game from chess.com's public archive. Once
  a game is loaded but not analyzed, the button analyzes that game instead. A game you just finished can
  take a few minutes to appear; the line under the buttons names the game that was loaded, so you
  can see if it's the previous one.
- **Paste link** — in the chess.com app tap **Share** → **Copy**, switch to Game Review, tap
  *Paste link* and confirm iOS's *Paste* prompt. Finds a just-finished game immediately.
- **Recent Games ▾** — pick from your latest 20 games.

Good to know: the Home Screen app and Safari keep separate storage. Settings, saved username and
the analysis cache don't carry over between them.

## Sharing from the chess.com app

iOS never routes links or Shortcuts into a Home Screen web app, and web apps can't register in the
share sheet. Only a tap on a web push notification can open one, so that's the route.

### Setting it up

1. In the Home Screen app: **Settings** (gear) → **Share from chess.com** → **Enable
   notifications**, and allow them. **Test** should bring up a notification.
2. Tap **Copy Shortcut link**. Keep this link private: it can send notifications to this phone.
3. In the **Shortcuts** app → **+** → name it e.g. *Analyze game*.
4. Tap the **ⓘ** (details) → enable **Show in Share Sheet**. Under *Share Sheet types* keep
   **Text** and **URLs**. In the first block (*Receive … from Share Sheet*) set *If there's no
   input* to **Get Clipboard** — then the Shortcut also works on a copied link.
5. Add the action **URL Encode** — input: *Shortcut Input*.
6. Add the action **Text**: paste the copied link, then directly after it (no space) the *URL
   Encoded Text* variable.
7. Add the action **Get Contents of URL** — input: the *Text* from step 6.

Already have the Safari Shortcut? Replace its link in the **Text** action, and its last action
with **Get Contents of URL**.

Now in the chess.com app: finished game → **Share** → **Analyze game**, then tap the notification.
(If the Shortcut isn't listed, scroll the share sheet's app row to the end → *More* / *Edit
Actions* and add it.)

The game waits 15 minutes, so if you miss the notification, opening the app from its icon loads it
too. If notifications stop arriving, **Test** will say so: turn the setup off and on again, then
replace the link in the Shortcut.

### How it works

The app makes a push subscription and its own VAPID key pair on the phone
(`src/lib/sharePush.ts`) and packs them into the token in the link, so the server needs no
secret and no database. `api/share-push.ts` encrypts and sends the push, and only to known push
services. `public/sw.js` parks the game in Cache Storage and shows the notification, and the app
picks the game up when it comes to the front.

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

## Without notifications: opening in Safari

The same Shortcut works without any setup if its **Text** action is
`https://chess-game-review-drab.vercel.app/?share=` followed by the *URL Encoded Text* variable,
and its last action is **Open URLs**. Safari opens and the analysis starts.
