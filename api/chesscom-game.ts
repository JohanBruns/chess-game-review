// Vercel serverless function: GET /api/chesscom-game?id=<game id>[&type=live|daily]
//
// Proxies chess.com's unofficial callback endpoint, which has the game the instant it ends but
// sends no CORS headers, so the app (src/lib/chesscom.ts) can't fetch it from the browser.
// Responds with { game } — the callback JSON's game object, turned into a PGN client-side.
// The chess.com app's share links (chess.com/game/{id}) don't say live or daily, so both are
// tried when no type is given.

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const id = params.get('id') ?? ''
  if (!/^\d{1,20}$/.test(id)) return json({ error: 'invalid id' }, 400)
  const typeParam = params.get('type')
  const types = typeParam === 'live' || typeParam === 'daily' ? [typeParam] : ['live', 'daily']

  for (const type of types) {
    try {
      const res = await fetch(`https://www.chess.com/callback/${type}/game/${id}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (chess-game-review)' },
      })
      if (!res.ok) continue
      const body = await res.json() as { game?: { moveList?: string; isFinished?: boolean } }
      if (!body.game?.moveList) continue
      // A finished game never changes — let the CDN keep it. A running one must stay fresh.
      const cache = body.game.isFinished ? 'public, s-maxage=86400, max-age=3600' : 'no-store'
      return json({ game: body.game }, 200, cache)
    } catch {
      // try the next type
    }
  }
  return json({ error: 'game not found' }, 404)
}

function json(body: unknown, status: number, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache },
  })
}
