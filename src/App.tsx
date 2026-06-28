import { useEffect, useCallback } from 'react'
import { useGame } from './hooks/useGame'
import { useEngine } from './lib/engine/useEngine'
import { PgnInput } from './components/PgnInput'
import { BoardPanel } from './components/BoardPanel'
import { NavControls } from './components/NavControls'
import { MoveList } from './components/MoveList'
import { EvalPanel } from './components/EvalPanel'

function App() {
  const {
    currentFen,
    moves,
    currentPly,
    error,
    isLoaded,
    canGoPrev,
    canGoNext,
    loadPgn,
    goToFirst,
    goToPrev,
    goToNext,
    goToLast,
    goToPly,
  } = useGame()

  const {
    isReady,
    isEvaluating,
    result,
    error: engineError,
    evaluate,
  } = useEngine()

  const handleEvaluate = useCallback(
    () => evaluate(currentFen),
    [evaluate, currentFen],
  )

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goToNext() }
      else if (e.key === 'Home') { e.preventDefault(); goToFirst() }
      else if (e.key === 'End') { e.preventDefault(); goToLast() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goToFirst, goToPrev, goToNext, goToLast])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <PgnInput onLoad={loadPgn} error={error} />
      <div className="flex flex-row gap-4 px-4 pb-4 items-start">
        <div className="flex flex-col gap-2 flex-shrink-0">
          <BoardPanel fen={currentFen} />
          <NavControls
            onFirst={goToFirst}
            onPrev={goToPrev}
            onNext={goToNext}
            onLast={goToLast}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            isLoaded={isLoaded}
          />
          <EvalPanel
            isReady={isReady}
            isEvaluating={isEvaluating}
            result={result}
            error={engineError}
            isGameLoaded={isLoaded}
            onEvaluate={handleEvaluate}
          />
        </div>
        <MoveList
          moves={moves}
          currentPly={currentPly}
          onSelectPly={goToPly}
        />
      </div>
    </div>
  )
}

export default App
