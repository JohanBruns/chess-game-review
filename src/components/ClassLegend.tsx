const LEGEND = [
  { symbol: '📖', cls: 'text-slate-400',  label: 'Buchzug'       },
  { symbol: '★',  cls: 'text-cyan-400',   label: 'Bester Zug'    },
  { symbol: '✓✓', cls: 'text-green-400',  label: 'Ausgezeichnet' },
  { symbol: '✓',  cls: 'text-green-600',  label: 'Gut'           },
  { symbol: '?!', cls: 'text-yellow-400', label: 'Ungenauigkeit' },
  { symbol: '?',  cls: 'text-orange-400', label: 'Fehler'        },
  { symbol: '??', cls: 'text-red-500',    label: 'Grober Fehler' },
]

export function ClassLegend() {
  return (
    <div className="shrink-0 border-t border-slate-700 px-3 py-2">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Legende</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {LEGEND.map(({ symbol, cls, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px]">
            <span className={`font-sans w-5 text-center ${cls}`}>{symbol}</span>
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
