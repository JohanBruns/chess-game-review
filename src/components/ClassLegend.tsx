const LEGEND = [
  { src: '/marks/book_128x.png',      label: 'Buchzug'        },
  { src: '/marks/brilliant_128x.png', label: 'Brillant (!!)' },
  { src: '/marks/great_find_128x.png',label: 'Stark (!)'     },
  { src: '/marks/best_128x.png',      label: 'Bester Zug'    },
  { src: '/marks/excellent_128x.png', label: 'Ausgezeichnet' },
  { src: '/marks/good_128x.png',      label: 'Gut'           },
  { src: '/marks/inaccuracy_128x.png',label: 'Ungenauigkeit' },
  { src: '/marks/mistake_128x.png',   label: 'Fehler'        },
  { src: '/marks/blunder_128x.png',   label: 'Grober Fehler' },
]

export function ClassLegend() {
  return (
    <div className="shrink-0 border-t border-slate-700 px-3 py-2">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Legende</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {LEGEND.map(({ src, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px]">
            <img src={src} alt={label} className="w-4 h-4 shrink-0" />
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
