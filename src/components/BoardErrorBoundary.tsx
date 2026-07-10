import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

// Safety net for react-chessboard's internal <Piece> animation effect, which reads a square's
// getBoundingClientRect() synchronously and throws ("Square width not found") if the square isn't
// laid out with a real size yet — observed as a rare race on the setup→review transition at small
// viewport sizes (see TODO.md). Errors thrown from effects are commit-phase errors in React, so
// without a boundary here they unmount the entire app (blank #root, only a reload recovers).
// "Reload board" remounts just the Chessboard subtree, which clears react-chessboard's own
// internal state instead of losing the whole session.
export class BoardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Board crashed, showing recovery fallback:', error, info)
  }

  private handleReset = () => this.setState({ hasError: false })

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-cc-panel rounded text-center px-4">
          <p className="text-sm text-cc-text-dim">The board hit a rendering glitch.</p>
          <button
            onClick={this.handleReset}
            className="px-3 py-1.5 rounded bg-cc-green hover:bg-cc-green-hover text-white text-xs font-semibold transition-colors"
          >
            Reload board
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
