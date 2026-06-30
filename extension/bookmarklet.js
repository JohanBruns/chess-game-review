// Bookmarklet — als Lesezeichen speichern (URL-Feld muss mit "javascript:" beginnen).
// Auf einer chess.com-Spielseite anklicken → PGN extrahieren → App öffnen.
//
// Einrichtung:
//   1. Neues Lesezeichen anlegen
//   2. URL = gesamten Inhalt dieser Datei (ab "javascript:") als eine Zeile eintragen
//   3. Auf chess.com/game/* anklicken

javascript:(async()=>{
  const APP = 'http://localhost:5173';

  // Strategy 1: __NEXT_DATA__
  let pgn = null;
  try {
    const d = JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent||'{}');
    pgn = d?.props?.pageProps?.game?.pgn
       || d?.props?.pageProps?.gameData?.pgn
       || d?.props?.pageProps?.gamePgn;
  } catch(_){}

  // Strategy 2: Unofficial callback API
  if (!pgn) {
    const m = location.pathname.match(/\/game\/(live|daily|chess960)\/(\d+)/);
    if (m) {
      try {
        const r = await fetch(`https://www.chess.com/callback/${m[1]}/game/${m[2]}`,{credentials:'include'});
        if (r.ok) {
          const j = await r.json();
          pgn = j?.game?.pgn || j?.pgn;
        }
      } catch(_){}
    }
  }

  if (!pgn) { alert('PGN nicht gefunden. Seite vollständig laden und nochmal versuchen.'); return; }

  const url = `${APP}/?pgn=${encodeURIComponent(pgn)}`;
  if (url.length > 8000) { alert(`PGN zu lang für URL (${url.length} Zeichen).`); return; }
  window.open(url, '_blank');
})();
