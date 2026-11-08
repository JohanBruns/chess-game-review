import { lazy, Suspense, type ComponentProps } from 'react'
import type { EvalGraph as EvalGraphType } from './EvalGraph'

// The eval graph pulls in recharts (with lodash, d3 and friends) — the largest part of the
// bundle, and only needed once a game has been analyzed. Loaded on first use; until then an
// empty 80px arc in the graph's own colors holds its place, so nothing jumps.
const EvalGraph = lazy(() => import('./EvalGraph').then(m => ({ default: m.EvalGraph })))

export function LazyEvalGraph(props: ComponentProps<typeof EvalGraphType>) {
  if (props.evalResults.length === 0) return null
  return (
    <Suspense fallback={<div className="w-full h-20 rounded-[5px]" style={{ background: '#403d39' }} />}>
      <EvalGraph {...props} />
    </Suspense>
  )
}
