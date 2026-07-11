# Offene Aufgaben

- [ ] Perf-Fix (Ein-Pass + gedrosseltes Progress-Publish, 2026-07-11) im ECHTEN Browser gegenmessen (Chrome-Extension war offline, Diagnose+Verifikation liefen in der Preview-Sandbox). Erwartung: Opera Game deutlich unter den alten 23 s; DEV-Konsole loggt `[SF] batch analysis: N positions in X ms`. Falls real weiterhin langsam: nächster Hebel ist der per-Publish-Render selbst (React.memo/Memoisierung der teuren Kinder — EvalGraph/MoveList — statt Engine-Schicht).

- [ ] Bug fixen: Im Explain-Modus bewegt/aktualisiert sich die Plus-Minus-Evaluation-Bar links nicht immer mit (bei normalen Nicht-Matt-Centipawn-Stellungen fehlt die Zahl an der Bar). Erster Fix (`f9f939e`) hat nur den Matt-Countdown-Sonderfall behoben. Noch offen.
