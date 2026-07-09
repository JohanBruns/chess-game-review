# Plan: Optik-Parität mit chess.com Game Review — schrittweise Umsetzung

> Referenz: https://www.chess.com/game/171330597782 → Game Review (live verglichen am 09.07.2026,
> eingeloggt als jojo2go). Verglichene Zustände: Summary-Karte, Review idle (Book-Zug),
> Blunder-Ansicht, Best-Preview, Explain-Modus, Zugliste, Eval-Graph, Navigation.
> Lokale App parallel mit derselben Partie (vs. BabluOP3850) analysiert und Screenshot-verglichen.

## So arbeitest du diesen Plan ab

- **Ein Schritt = eine Session/ein Commit.** Jeder Schritt ist eigenständig umsetzbar und
  hinterlässt die App in funktionierendem Zustand. Reihenfolge einhalten (spätere Schritte
  bauen aufs Layout von Schritt 1 auf).
- **Prompt-Vorlage pro Schritt:** „Setze Schritt N aus `game-review/PLAN_OPTIK.md` um."
  Alles Nötige (Spezifikation, Dateien, Prüfkriterien) steht im jeweiligen Schritt.
- **Modell-Empfehlung** steht bei jedem Schritt:
  - **Sonnet** = die Spezifikation hier im Plan ist vollständig, es ist präzise Fleißarbeit.
  - **Opus** = es muss live an chess.com nachgemessen/reverse-engineert werden oder es gibt
    Layout-/Verhaltens-Unklarheiten, die on-the-fly entschieden werden müssen.
- **Checkpoint-Regel (Projekt-Lektion!):** Bevor ein chess.com-UI-Detail nachgebaut wird, das
  hier nicht exakt spezifiziert ist → live im Browser prüfen (Referenz-Partie oben öffnen,
  Game Review starten). Annahmen aus dem Gedächtnis waren in diesem Projekt schon mehrfach falsch.
- **Verifikation:** Dev-Server läuft via `.claude/launch.json` (Port 5199). Partie laden
  (User `jojo2go` → Recent Games → vs. BabluOP3850), „Analyze Game", dann Screenshot-Vergleich
  gegen den offenen chess.com-Tab.
- Nach jedem Schritt: `npx tsc -b` + `npm run test` + `npm run lint` grün, dann committen
  (`feat(ui): …` bzw. `style: …`).

## Status

| Schritt | Inhalt | Modell | Status |
|---|---|---|---|
| 1 | Sidebar-Breite fixieren, Grundlayout | Sonnet | ✅ |
| 2 | Spieler-Leisten über/unter dem Brett | Sonnet | ✅ |
| 3 | Navigation: 5 große Buttons in den Sidebar-Footer | Sonnet | ✅ |
| 4 | Coach-Bubble (weiße Sprechblase) | Sonnet | ☐ |
| 5 | Explain/Best/Next-Buttonreihe | Sonnet | ☐ |
| 6 | Zugliste (Figurinen, Icon-Politik, Zeilen) | **Opus** | ☐ |
| 7 | Eval-Graph | Sonnet | ☐ |
| 8 | Eval-Bar + Brett-Details (Badge, Tints, Pfeile) | **Opus** | ☐ |
| 9 | Summary-Karte | Sonnet | ☐ |
| 10 | Typografie-Feinschliff + Abnahme-Vergleich | Sonnet | ☐ |

## Gemessene chess.com-Referenzwerte (DevTools, live 09.07.2026)

| Eigenschaft | Wert |
|---|---|
| Sidebar-Breite | fix 500 px (Inhalt ~390 px sichtbar), niemals flex-füllend |
| Schrift | System-Stack (`-apple-system, Segoe UI, …`), KEIN Webfont |
| Fließtext | 13–15 px, `rgba(255,255,255,0.72)`; Betontes weiß + bold |
| Zuglisten-Zeile | 30 px hoch, 13 px, alternierend hell/dunkel getönt |
| Selektierter Zug | `rgba(255,255,255,0.14)`-Pill, border-radius 2 px, SAN behält Klassifikationsfarbe |
| Blunder-Farbe | `#fa412d` (unsere classColors.ts stimmt bereits) |
| Seiten-Hintergrund | `#302e2b` (stimmt bereits, `--color-cc-bg`) |
| Coach-Bubble | WEISSE Sprechblase (Tail zum Avatar), dunkler Text `#312e2b`, 15 px |
| Eval-Badge in Bubble | dunkler Pill (`#312e2b`), weiße bold Zahl, oben rechts in der Bubble |
| Nav-Buttons | 5 Stück, Sidebar-Footer, gleich breit, ~44 px hoch, dunkelgrau, Chevron-Icons |

---

## Schritt 1 — Sidebar-Breite fixieren, Grundlayout · **Sonnet**

**Problem:** Sidebar ist `flex-1` und füllt ~880 px → Buttons, Zugliste und Summary-Tabelle
wirken über die volle Breite zerdehnt. chess.com: Sidebar **fix ~400 px**, Brett dominiert.

**Aufgaben** ([src/App.tsx](src/App.tsx), Sidebar-Wrapper bei Zeile ~724):
1. Sidebar: `flex-1 min-w-0` → feste Breite `w-[400px] shrink-0` (bei sehr schmalen Fenstern
   `min-w-[320px]` erlauben).
2. Brett-Spalte: nimmt den Restplatz, Brett bleibt quadratisch und wird horizontal zentriert
   (die bestehende `min()`-Rechnung für die Brettgröße anpassen: Sidebar-Anteil ist jetzt
   konstant 400 statt 320).
3. Prüfen, dass Setup-, Summary- und Review-Chapter alle in 400 px sauber aussehen (nichts
   überläuft; MoveList-Spaltenbreiten `w-[46%]` funktionieren weiter).

**Fertig wenn:** Screenshot bei 1568 px Fensterbreite zeigt Brett links dominant + 400-px-Sidebar
rechts; kein horizontales Scrollen; alle drei Chapter benutzbar.

---

## Schritt 2 — Spieler-Leisten über/unter dem Brett · **Sonnet**

**Problem:** chess.com zeigt über dem Brett den Gegner, darunter den eigenen Spieler
(Avatar + Name + Rating + Uhr). Bei uns fehlt das komplett.

**Aufgaben:**
1. Neue Komponente `src/components/PlayerBar.tsx`:
   - Links: Avatar 32 px (abgerundetes Quadrat) — Platzhalter mit Initiale auf `--color-cc-surface`
     (echte Avatare später möglich, siehe Rückfragen).
   - Daneben: Username **bold weiß** 14 px, dahinter `(Rating)` in `text-cc-text-dim`.
   - Rechts: Uhr-Pill — dunkler Hintergrund `#1e1c1a`, Mono-/Tabular-Ziffern 16 px bold, ⏱-Icon;
     bei chess.com ist die Uhr des Nicht-Am-Zug-Spielers gedimmt (hier statisch: letzte
     bekannte Uhrzeit VOR dem aktuellen Ply aus den `%clk`-Daten).
2. Daten: `whiteName/blackName/whiteElo/blackElo` gibt es in `useGame` bereits;
   Uhrzeiten pro Ply aus [src/lib/analysis/clocks.ts](src/lib/analysis/clocks.ts) ableiten
   (kumulativ letzter `%clk`-Wert je Seite bis `currentPly`; wenn keine Daten → Pill weglassen).
3. Einbau in App.tsx: obere Bar = Seite, die NICHT `orientation` entspricht; untere Bar =
   `orientation`-Seite (bei Flip tauschen).

**Fertig wenn:** Beide Bars zeigen Name/Rating korrekt, Uhren zählen beim Durchsteppen der Züge
runter, Flip (F) tauscht die Bars.

---

## Schritt 3 — Navigation: 5 große Buttons in den Sidebar-Footer · **Sonnet**

**Problem:** Bei uns 9 kleine Emoji-Buttons unter dem Brett. chess.com: **5 große Buttons als
Footer der Sidebar** (⏮ ◀ ▶ ▶| ⏭-Äquivalent: first/prev/play/next/last), Tools separat.

**Aufgaben:**
1. [src/components/NavControls.tsx](src/components/NavControls.tsx) aufteilen:
   - `NavControls` (neu): 5 Buttons, gleich breit (`flex-1`), Höhe 44 px, `gap-1.5`,
     Hintergrund `#3a3937` (≈ `--color-cc-surface`), `hover: --color-cc-surface-hover`,
     radius 5 px, **SVG-Chevrons** statt Emoji (inline-SVG, Farbe `rgba(255,255,255,0.72)`):
     `|◀` `◀` `▶(Play)` `▶` `▶|`. Play-Button = Autoplay-Toggle (settings.autoplay
     umschalten; zeigt ▶/⏸).
   - `BoardToolbar` (neu, klein): Flip, Theme, Settings, Link, Export als dezente Icon-Buttons
     (transparent, 28 px, graue SVG- oder Text-Icons — keine Emojis) — bleibt unter dem Brett.
2. App.tsx: `NavControls` als `shrink-0`-Footer ans Ende der Sidebar (unter dem Eval-Graph im
   Review-Chapter; im Setup/Summary-Chapter ebenfalls ganz unten). `BoardToolbar` ersetzt die
   bisherige Leiste unter dem Brett.
3. Disabled-Logik und `takeover`-Prop 1:1 übernehmen.

**Fertig wenn:** Sidebar endet mit Graph + 5-Button-Reihe wie im chess.com-Screenshot;
Tastatur-Shortcuts unverändert; Practice/Puzzle-Takeover deaktiviert die Nav weiterhin.

---

## Schritt 4 — Coach-Bubble (weiße Sprechblase) · **Sonnet**

**Problem:** Unsere Bubble ist eine dunkle Box mit hellem Text. chess.com: weiße Sprechblase
mit Tail, dunkler Text, farbige Headline, dunkler Eval-Pill.

**Aufgaben** ([src/components/ReviewView.tsx](src/components/ReviewView.tsx),
[SummaryView.tsx](src/components/SummaryView.tsx), [CoachBubble.tsx](src/components/CoachBubble.tsx)):
1. Avatar: 56–64 px, abgerundetes Quadrat, links neben der Bubble (statt 36-px-Kreis).
2. Bubble: `background: #fff`, `color: #312e2b`, radius 8 px, Padding 10–12 px,
   CSS-Tail (Dreieck, ~10 px) links Richtung Avatar. Gleicher Stil in Summary und Review.
3. Inhalt Review-idle:
   - Zeile 1: Klassifikations-Icon 16 px + `Bxf7+ is a blunder` — **SAN + Klassenwort in der
     Klassifikationsfarbe** (`classColor()`), bold; Rest dunkel.
   - Zeile 2: Erklärungssatz (bestehende commentary/headline), normalgewichtig, dunkel.
     Hoverbare Taktik-Phrasen (CoachBubble-Tokens): Unterstreichung gepunktet dunkel statt
     bisheriger heller Farben — auf weißem Grund lesbar halten.
   - Eval-Badge: Pill oben rechts IN der Bubble — `background:#312e2b`, weiß, bold 13 px,
     radius 4 px, Padding 2×6 px (z. B. `-3.91`, `+0.24`).
4. Explain-Modus: 💡-Icon + „Explaining ♗xf7" analog (Icon statt Klassifikations-Icon).
5. Summary: gleiche weiße Bubble für die `summaryHeadline`.
6. `coachEnabled=false` (Settings) blendet weiter nur den Bubble-Inhalt aus.

**Fertig wenn:** Side-by-side mit chess.com-Screenshot: weiße Bubble + Tail + farbige Headline +
dunkler Eval-Pill; in Summary und Review konsistent.

---

## Schritt 5 — Explain/Best/Next-Buttonreihe · **Sonnet**

**Problem:** Kleine `text-xs`-Buttons, Next überbreit, „Practice from here" als Fremdkörper.
chess.com: drei **gleich breite** Buttons mit Icons.

**Aufgaben** ([src/components/ReviewView.tsx](src/components/ReviewView.tsx)):
1. idle: `💡 Explain` (Sekundär) · `⭐ Best` (Sekundär, nur wenn `canBest`) · `→ Next` (Primär
   grün). Alle `flex-1` (gleich breit), Höhe 36 px, radius 5 px, 14 px **bold**, Icon 16 px vor
   dem Label (Lightbulb/Star/Arrow als inline-SVG oder die vorhandenen mark-PNGs für den Stern).
   Wenn Best fehlt: Explain + Next je 50 %.
2. explain: `‹` (Sekundär, nur Icon) · `›` (Primär grün, nur Icon) · `✓ Got it!` (Sekundär) —
   chess.com-Anordnung exakt so (der grüne Button ist der Vorwärts-Pfeil!).
3. best: ein voll breiter grüner `▶ Resume`.
4. Sekundär-Stil: `background:#3a3937`, Text `rgba(255,255,255,0.85)`; Primär: `--color-cc-green`.
5. „Practice from here": aus der Button-Zone raus — als dezenter Textlink unter der Zugliste
   oder hinter einem Settings-Toggle (Rückfrage 1; bis zur Antwort: dezenter Textlink).

**Fertig wenn:** Alle drei Sub-Modi (idle/best/explain) matchen die chess.com-Screenshots
(gleiche Anordnung, Icons, Gewichtung).

---

## Schritt 6 — Zugliste · **Opus** (Icon-Politik + Figurinen live gegenprüfen)

**Problem:** Mono-Font, Icons an jedem Zug, Zeiten überall, grüner Selektions-Pill — alles
anders als chess.com.

**Spezifikation (aus dem Live-Vergleich):**
- Zeilenhöhe 30 px, Systemfont, SAN 13 px **bold**; Zugnummer gedimmt (`text-cc-text-faint`,
  11 px) links, Breite ~28 px.
- **Figurinen** vor der SAN (♗xf7+ statt Bxf7+). Umsetzung: Unicode-Figurinen ODER 12-px-Bilder
  aus dem aktiven Piece-Theme (Rückfrage 3; Default bis zur Antwort: Unicode).
- **Icon-Politik (wichtig, live verifiziert):** Inline-Icons NUR für Book, Brilliant, Great,
  Excellent, Good, Inaccuracy, Mistake, Miss, Blunder — **Best-Züge bekommen KEIN Icon und
  KEINE Farbe** (chess.com lässt Best-SANs in normaler Textfarbe!). Farbige SAN nur für:
  Brilliant, Great, Excellent(grün), Inaccuracy, Mistake, Miss, Blunder.
  ⚠️ Vor Umsetzung am Referenz-Review nochmal stichprobenartig verifizieren (welche Klassen
  genau Icon+Farbe tragen — unsere heutigen Screenshots zeigen Icons bei Book/?!/?/??/👍,
  keine bei Best/Great-losen Normalzügen).
- **Keine Zugzeiten** in der Review-Zugliste (chess.com blendet sie dort aus). Im
  Setup-Chapter dürfen sie bleiben (Rückfrage 1).
- ⚡-Retry-Marker: chess.com hat keinen → per Settings-Toggle oder dezenter (Rückfrage 1;
  Default: nur bei Hover der Zeile sichtbar).
- Selektierter Zug: `rgba(255,255,255,0.14)`-Pill, radius 2 px, SAN **behält** ihre
  Klassifikationsfarbe (nicht mehr grün füllen).
- Alternierende Zeilen: beibehalten, Kontrast leicht anheben (chess.com `light-row`/`dark-row`).
- **Explain-Modus:** Engine-Variante als **eingerückte Sub-Zeile direkt unter dem aktuellen
  Zug** in der Liste rendern („4. ♗xf7+ ♔xf7 5. ♕e2", aktueller Schritt hell hinterlegt),
  statt der SAN-Chips unter den Buttons. Dazu `lineSans`/`lineStep` an MoveList durchreichen
  (oder Slot-Render in ReviewView).

**Dateien:** [src/components/MoveList.tsx](src/components/MoveList.tsx),
[ReviewView.tsx](src/components/ReviewView.tsx) (PV-Zeile), ggf. `classIcons.ts`.

**Fertig wenn:** Zugliste im Review-Chapter ist vom chess.com-Screenshot (Zoom liegt vor) auf
Anhieb kaum unterscheidbar; Klick-Navigation, Auto-Scroll und Retry funktionieren weiter.

---

## Schritt 7 — Eval-Graph · **Sonnet**

**Problem:** Gräulicher Verlaufs-Fill, grüne Current-Ply-Linie, abgerundete Karte.
chess.com: deckend weiße Fläche, rote Current-Marker, randlos.

**Aufgaben** ([src/components/EvalGraph.tsx](src/components/EvalGraph.tsx)):
1. Fill: deckend `#e9e9e8`–weiß (Gradient raus, `stopOpacity` 1), Stroke dünn hell.
2. Current-Ply-Marker: vertikale Linie **rot** (`#fa412d`, 2 px) + **roter Punkt** (r≈4) am
   Schnittpunkt mit der Kurve (statt grüner Linie).
3. Dots: zusätzlich Inaccuracy (gelb `#f7c631`) und Mistake (orange `#ffa459`) —
   `DOT_CLASSES = {Brilliant, Great, Inaccuracy, Mistake, Miss, Blunder}`; r≈3.5,
   dunkler Rand wie bisher.
4. Container: Rundung/Karten-Hintergrund raus — voll breit, Höhe ~90 px, Hintergrund etwas
   dunkler als Sidebar (`#262421` flächig ohne radius), dünne Mittellinie behalten.
5. Positionen: Review-Chapter = direkt über den Nav-Buttons (Schritt 3); Summary = unter der
   Coach-Bubble (ist schon so).

**Fertig wenn:** Graph sieht aus wie im chess.com-Zoom-Screenshot (weiße Fläche, rote
Positionslinie, farbige Fehler-Dots); Klick-zu-Ply und Tooltip funktionieren weiter.

---

## Schritt 8 — Eval-Bar + Brett-Details · **Opus** (Tints/Badge-Verhalten live nachmessen)

**Aufgaben:**
1. **Eval-Bar** ([src/components/EvalBar.tsx](src/components/EvalBar.tsx)): Breite 40 px →
   ~22 px, radius 3 px, Label 9–10 px bold, am Rand der **führenden** Seite (oben wenn Schwarz
   führt, unten wenn Weiß führt), Farbe kontrastierend zur Balkenhälfte (ist schon so).
2. **Klassifikations-Badge** ([src/components/BoardPanel.tsx](src/components/BoardPanel.tsx)):
   Größe von fix 20 px auf **relativ ~40 % der Feldbreite** (`w-[5%]` der Brettbreite via
   Prozent + aspect), sitzt auf der Ecke oben rechts des Zielfelds, ragt leicht über den
   Feldrand hinaus (chess.com-Look).
3. **From/To-Tints:** ⚠️ Live nachmessen (DevTools am Referenz-Review): Beobachtung von heute —
   beim Blunder war das Herkunftsfeld salmon-rot getönt, das Zielfeld gelb-grün (Standard-
   Highlight) mit ??-Badge. Klären, ob chess.com from=Klassenfarbe/to=Standard nutzt oder
   beide Klassenfarbe, dann exakt übernehmen (`squareStyles` in BoardPanel).
4. **Pfeilfarben:** Der „so wird's bestraft"-Antwortpfeil nach einem Fehler ist bei chess.com
   **hellblau** (heute beobachtet, ~`#4fa8ff`); unser Threat-Pfeil ist rot (`THREAT_ARROW_COLOR`
   in App.tsx). Live verifizieren, welcher Pfeil wann erscheint, Farbe angleichen.
   (Achtung: Memory sagt, der Best-Move-Pfeil sei severity-coded grün/rot-orange — auch das
   dabei gegenprüfen.)

**Fertig wenn:** Blunder-Ansicht side-by-side: Badge-Größe/-Position, Feld-Tints und
Pfeilfarben stimmen mit chess.com überein.

---

## Schritt 9 — Summary-Karte · **Sonnet**

**Problem:** Werte kleben an den äußersten Rändern, Label mittig; „Hide details" als Text;
keine Avatare; Kopf ohne Icon.

**Aufgaben** ([src/components/SummaryView.tsx](src/components/SummaryView.tsx)):
1. Kopf: „Game Review" mit grünem Stern-Icon davor, **zentriert** (Review-Chapter behält den
   Back-Pfeil links).
2. Spalten-Raster (chess.com-Layout): **Label links**, zwei feste Werte-Spalten rechts —
   Weiß-Spalte und Schwarz-Spalte (je ~64 px, zentriert), Klassifikations-Icon dazwischen.
   ALLE Reihen (Players, Accuracy, Zähltabelle, Game Rating, Phasen) an denselben zwei
   Spalten ausrichten. Konkret: CSS-Grid `[Label 1fr | 64px | 32px | 64px]`.
3. Players-Reihe: zwei Avatar-Kacheln 48 px (Platzhalter wie Schritt 2), Spieler der
   Review-Perspektive (`settings.reviewAs`) grün umrandet; Namen als eigene Zeile darüber.
4. Accuracy-Pills: weiß-auf-hell für Weiß (`bg-white text-[#312e2b]`), dunkel für Schwarz
   (`#262421`, weiße Schrift), bold 15 px, radius 4 px — Position in den zwei Werte-Spalten.
5. Einklappen: nur ein `^`-Chevron zentriert (ohne „Hide details"-Text).
6. Game-Rating-Pills im selben Stil wie Accuracy-Pills.
7. Bottom: „Start Review" grün, Höhe 48 px, bold 15 px, radius 8 px; darüber „Puzzles (n)"
   als dunkler Sekundär-Button (chess.com hat dort „New 10 min" — gleicher Stil).

**Fertig wenn:** Side-by-side mit den beiden Summary-Screenshots von heute: gleiche
Spaltenausrichtung, Pills, Chevron, Buttons.

---

## Schritt 10 — Typografie-Feinschliff + Abnahme · **Sonnet**

**Aufgaben:**
1. [src/index.css](src/index.css): `--font-heading` (Montserrat) entfernen oder nur noch für
   Zahlen-Pills verwenden — chess.com nutzt durchgehend den System-Stack mit bold-Gewichten.
   `@fontsource/montserrat`-Import in dem Fall aus `main.tsx`/package.json entfernen.
2. Sidebar-Grundtextfarbe auf `rgba(255,255,255,0.72)` (`--color-cc-text-dim` anpassen),
   reines Weiß nur für Betontes (Namen, Zahlen, Headlines).
3. GamePicker-Leiste optisch angleichen (dunkler, dezenter — bleibt funktional wie sie ist).
4. **Abnahme:** Referenz-Partie in beiden Tabs öffnen, alle Zustände durchsteppen
   (Summary → Start Review → Book-Zug → Blunder → Best → Explain → Ende) und je einen
   Side-by-side-Screenshot machen. Abweichungen notieren → entweder fixen oder bewusst
   als „eigenes Feature" dokumentieren.

**Fertig wenn:** Screenshot-Serie zeigt Parität; Restabweichungen sind dokumentiert und gewollt.

---

## Offene Rückfragen (vor Schritt 5/6 beantworten)

1. **Eigene Features:** ⚡-Retry-Marker, „Practice from here", Puzzles-Button und Zugzeiten
   gibt es bei chess.com (an diesen Stellen) nicht. Verstecken für 100 % Parität, oder dezent
   integriert lassen? *(Default im Plan: dezent integriert)*
2. **GamePicker-Leiste** oben ist App-eigen — bleibt, wird nur optisch angeglichen (Schritt 10).
3. **Figurinen:** Unicode (sofort machbar) oder Mini-Bilder aus dem Piece-Theme?
   *(Default: Unicode)*
4. **Typewriter-Effekt** der Coach-Texte — mitbauen? *(Default: nein, optionaler Bonus-Schritt)*
5. **Avatare:** Initialen-Platzhalter oder echte Profilbilder via
   `https://api.chess.com/pub/player/{user}` → `avatar`? *(Default: Platzhalter; API-Avatare
   als optionaler Bonus-Schritt)*
