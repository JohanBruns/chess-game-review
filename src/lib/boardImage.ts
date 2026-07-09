import { Chess } from 'chess.js'
import { pieceImageMap, type PieceKey } from './themes'

export interface PiecePlacement {
  square: string
  pieceKey: PieceKey
}

// Board-square occupancy for a FEN, independent of react-chessboard/chess.js's own rendering —
// pure data the canvas exporter below draws from.
export function fenToPlacements(fen: string): PiecePlacement[] {
  const chess = new Chess(fen)
  const placements: PiecePlacement[] = []
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue
      placements.push({ square: piece.square, pieceKey: `${piece.color}${piece.type.toUpperCase()}` as PieceKey })
    }
  }
  return placements
}

// Pixel rect for a square on a `boardSize`×`boardSize` canvas, mirroring BoardPanel's
// screen-position math (badgeScreenPosition) but in absolute pixels instead of percentages.
export function squarePixelRect(
  square: string,
  orientation: 'white' | 'black',
  boardSize: number,
): { x: number; y: number; size: number } {
  const file = square.charCodeAt(0) - 97  // 0 = a … 7 = h
  const rank = parseInt(square[1], 10)      // 1–8
  const squareSize = boardSize / 8
  const col = orientation === 'black' ? 7 - file : file
  const row = orientation === 'black' ? rank - 1 : 8 - rank
  return { x: col * squareSize, y: row * squareSize, size: squareSize }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

export interface ExportBoardImageOptions {
  fen: string
  boardImageUrl: string
  piecesBasePath: string
  orientation: 'white' | 'black'
  size?: number  // output PNG is `size`×`size` px, default 640
}

// Renders the position (board background + pieces, both from the currently active theme) to a
// PNG blob via an off-DOM canvas. Browser-only (Image/canvas) — not covered by the node-env
// test suite; squarePixelRect/fenToPlacements above carry the tested layout logic.
export async function exportBoardImage(options: ExportBoardImageOptions): Promise<Blob | null> {
  const size = options.size ?? 640
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const boardImg = await loadImage(options.boardImageUrl)
  ctx.drawImage(boardImg, 0, 0, size, size)

  const placements = fenToPlacements(options.fen)
  const pieceMap = pieceImageMap(options.piecesBasePath)
  const pieceImgs = await Promise.all(placements.map(p => loadImage(pieceMap[p.pieceKey])))

  placements.forEach((p, i) => {
    const rect = squarePixelRect(p.square, options.orientation, size)
    ctx.drawImage(pieceImgs[i], rect.x, rect.y, rect.size, rect.size)
  })

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

// Triggers a browser download of a blob under the given filename.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
