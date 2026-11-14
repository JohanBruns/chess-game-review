// Bookmarklet — als Lesezeichen speichern (URL-Feld muss mit "javascript:" beginnen).
// Auf einer chess.com-Spielseite anklicken → die App öffnet sich mit genau dieser Partie.
//
// Einrichtung:
//   1. Neues Lesezeichen anlegen
//   2. URL = gesamten Inhalt dieser Datei (ab "javascript:") eintragen
//   3. Auf einer chess.com-Partie (chess.com/game/…) anklicken
//
// Das Bookmarklet liest nur die Partie-ID aus der Adresse und übergibt sie als ?game=… an die
// App; die lädt die Partie dann selbst (api/chesscom-game.ts). So muss hier kein PGN gebaut
// werden. Im Code unten stehen bewusst nur /* … */-Kommentare: Browser fügen die Zeilen beim
// Einfügen zu einer zusammen, ein //-Kommentar würde dann den ganzen Rest auskommentieren.

javascript:(()=>{
  const APP = 'https://chess-game-review-drab.vercel.app';

  /* /game/123, /game/live/123, /game/daily/123, /live/game/123, /analysis/game/live/123 … */
  const m = location.pathname.match(/\/(?:(live|daily)\/)?game\/(?:(live|daily|chess960)\/)?(\d+)/);
  if (!/(^|\.)chess\.com$/.test(location.hostname) || !m) {
    alert('Keine chess.com-Partie auf dieser Seite gefunden.');
    return;
  }

  /* Eine laufende Partie zu analysieren verstößt gegen chess.coms Fair-Play-Regeln. */
  if (document.querySelector('.resign-button-component, .draw-button-component, .abort-button-component, [aria-label="Resign"]')) {
    alert('Die Partie läuft noch — Analyse erst nach Spielende.');
    return;
  }

  /* Mit bekanntem Typ als Link übergeben, sonst nur die ID (die App probiert dann live und daily). */
  const type = m[2] ?? m[1];
  const game = type === 'live' || type === 'daily'
    ? `https://www.chess.com/game/${type}/${m[3]}`
    : m[3];
  window.open(`${APP}/?game=${encodeURIComponent(game)}`, '_blank');
})();
