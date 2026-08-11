import { candidateFor } from './authority'
import { inside, point, square } from './coordinates'
import { baseState, otherSide, type NewStateOptions } from './state'
import type { Action, Candidate, GameState, GameStatus, Piece, PieceKind, Side } from './types'

const SHAPE = { files: 9, ranks: 10 }
type Board = Record<string, Piece>

function put(board: Board, side: Side, kind: PieceKind, coordinates: string[]): void {
  for (const coordinate of coordinates) board[coordinate] = { side, kind }
}

function initialBoard(): Board {
  const board: Board = {}
  put(board, 'second', 'rook', ['a1', 'i1'])
  put(board, 'second', 'knight', ['b1', 'h1'])
  put(board, 'second', 'elephant', ['c1', 'g1'])
  put(board, 'second', 'advisor', ['d1', 'f1'])
  put(board, 'second', 'king', ['e1'])
  put(board, 'second', 'cannon', ['b3', 'h3'])
  put(board, 'second', 'pawn', ['a4', 'c4', 'e4', 'g4', 'i4'])
  put(board, 'first', 'rook', ['a10', 'i10'])
  put(board, 'first', 'knight', ['b10', 'h10'])
  put(board, 'first', 'elephant', ['c10', 'g10'])
  put(board, 'first', 'advisor', ['d10', 'f10'])
  put(board, 'first', 'king', ['e10'])
  put(board, 'first', 'cannon', ['b8', 'h8'])
  put(board, 'first', 'pawn', ['a7', 'c7', 'e7', 'g7', 'i7'])
  return board
}

function palace(side: Side, x: number, y: number): boolean {
  return x >= 3 && x <= 5 && (side === 'second' ? y >= 0 && y <= 2 : y >= 7 && y <= 9)
}

function clearLine(board: Board, from: string, to: string): number | null {
  const a = point(from)
  const b = point(to)
  if (a.x !== b.x && a.y !== b.y) return null
  const dx = Math.sign(b.x - a.x)
  const dy = Math.sign(b.y - a.y)
  let screens = 0
  for (let x = a.x + dx, y = a.y + dy; x !== b.x || y !== b.y; x += dx, y += dy) {
    if (board[square(x, y)]) screens += 1
  }
  return screens
}

function rawDestinations(board: Board, from: string): string[] {
  const piece = board[from]
  if (!piece) return []
  const { x, y } = point(from)
  const forward = piece.side === 'first' ? -1 : 1
  const result: string[] = []
  const offer = (tx: number, ty: number) => {
    if (!inside(SHAPE, tx, ty)) return
    const target = board[square(tx, ty)]
    if (!target || target.side !== piece.side) result.push(square(tx, ty))
  }

  if (piece.kind === 'king') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (palace(piece.side, x + dx, y + dy)) offer(x + dx, y + dy)
    }
    const enemyKing = Object.entries(board).find(([, other]) => other.kind === 'king' && other.side !== piece.side)?.[0]
    if (enemyKing && point(enemyKing).x === x && clearLine(board, from, enemyKing) === 0) result.push(enemyKing)
  } else if (piece.kind === 'advisor') {
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (palace(piece.side, x + dx, y + dy)) offer(x + dx, y + dy)
    }
  } else if (piece.kind === 'elephant') {
    for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
      const ty = y + dy
      const ownHalf = piece.side === 'first' ? ty >= 5 : ty <= 4
      if (ownHalf && !board[square(x + dx / 2, y + dy / 2)]) offer(x + dx, ty)
    }
  } else if (piece.kind === 'knight') {
    const jumps = [
      [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0],
      [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1],
    ]
    for (const [dx, dy, lx, ly] of jumps) if (!board[square(x + lx, y + ly)]) offer(x + dx, y + dy)
  } else if (piece.kind === 'rook' || piece.kind === 'cannon') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let screened = false
      for (let tx = x + dx, ty = y + dy; inside(SHAPE, tx, ty); tx += dx, ty += dy) {
        const target = board[square(tx, ty)]
        if (piece.kind === 'rook') {
          if (!target) offer(tx, ty)
          else {
            offer(tx, ty)
            break
          }
        } else if (!screened) {
          if (!target) offer(tx, ty)
          else screened = true
        } else if (target) {
          if (target.side !== piece.side) result.push(square(tx, ty))
          break
        }
      }
    }
  } else if (piece.kind === 'pawn') {
    offer(x, y + forward)
    const crossed = piece.side === 'first' ? y <= 4 : y >= 5
    if (crossed) {
      offer(x - 1, y)
      offer(x + 1, y)
    }
  }
  return result
}

/**
 * Rule-native capture control, including a friendly occupied endpoint as a
 * defended square. Cannon control begins only beyond exactly one screen; the
 * screen-free squares a cannon may move through belong to mobility, not this
 * attack relation.
 */
export function xiangqiControlTargets(board: Board, from: string): string[] {
  const piece = board[from]
  if (!piece) return []
  const { x, y } = point(from)
  const forward = piece.side === 'first' ? -1 : 1
  const result: string[] = []
  const add = (tx: number, ty: number) => {
    if (inside(SHAPE, tx, ty)) result.push(square(tx, ty))
  }
  const ray = (dx: number, dy: number) => {
    for (let tx = x + dx, ty = y + dy; inside(SHAPE, tx, ty); tx += dx, ty += dy) {
      result.push(square(tx, ty))
      if (board[square(tx, ty)]) break
    }
  }
  const cannonRay = (dx: number, dy: number) => {
    let foundScreen = false
    for (let tx = x + dx, ty = y + dy; inside(SHAPE, tx, ty); tx += dx, ty += dy) {
      const coordinate = square(tx, ty)
      const occupied = Boolean(board[coordinate])
      if (!foundScreen) {
        if (occupied) foundScreen = true
        continue
      }
      result.push(coordinate)
      if (occupied) break
    }
  }

  if (piece.kind === 'king') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (palace(piece.side, x + dx, y + dy)) add(x + dx, y + dy)
    }
    const enemyKing = Object.entries(board).find(([, other]) => other.kind === 'king' && other.side !== piece.side)?.[0]
    if (enemyKing && point(enemyKing).x === x && clearLine(board, from, enemyKing) === 0) result.push(enemyKing)
  } else if (piece.kind === 'advisor') {
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (palace(piece.side, x + dx, y + dy)) add(x + dx, y + dy)
    }
  } else if (piece.kind === 'elephant') {
    for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
      const ty = y + dy
      const ownHalf = piece.side === 'first' ? ty >= 5 : ty <= 4
      if (ownHalf && !board[square(x + dx / 2, y + dy / 2)]) add(x + dx, ty)
    }
  } else if (piece.kind === 'knight') {
    const jumps = [
      [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0],
      [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1],
    ]
    for (const [dx, dy, lx, ly] of jumps) if (!board[square(x + lx, y + ly)]) add(x + dx, y + dy)
  } else if (piece.kind === 'rook') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ray(dx, dy)
  } else if (piece.kind === 'cannon') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cannonRay(dx, dy)
  } else if (piece.kind === 'pawn') {
    add(x, y + forward)
    const crossed = piece.side === 'first' ? y <= 4 : y >= 5
    if (crossed) {
      add(x - 1, y)
      add(x + 1, y)
    }
  }
  return [...new Set(result)].sort()
}

function attacks(board: Board, attacker: Side, target: string): boolean {
  return Object.entries(board).some(([from, piece]) => piece.side === attacker && rawDestinations(board, from).includes(target))
}

function kingSquare(board: Board, side: Side): string | undefined {
  return Object.entries(board).find(([, piece]) => piece.side === side && piece.kind === 'king')?.[0]
}

function applyBoard(board: Board, action: Action): Board {
  if (!action.from) return board
  const next = { ...board, [action.to]: board[action.from] }
  delete next[action.from]
  return next
}

function legalActions(board: Board, side: Side): Action[] {
  const actions: Action[] = []
  for (const [from, piece] of Object.entries(board)) {
    if (piece.side !== side) continue
    for (const to of rawDestinations(board, from)) {
      if (board[to]?.kind === 'king') continue
      const action: Action = { kind: 'move', from, to, piece: piece.kind }
      const next = applyBoard(board, action)
      const king = kingSquare(next, side)
      if (king && !attacks(next, otherSide(side), king)) actions.push(action)
    }
  }
  return actions
}

function statusAfter(board: Board, actor: Side): GameStatus {
  const king = kingSquare(board, actor)
  const inCheck = Boolean(king && attacks(board, otherSide(actor), king))
  if (legalActions(board, actor).length === 0) {
    return { phase: 'complete', winner: otherSide(actor), reason: inCheck ? 'checkmate' : 'stalemate', inCheck }
  }
  return { phase: 'active', inCheck }
}

export function initialXiangqi(options: NewStateOptions = {}): GameState {
  return baseState('xiangqi', 'xiangqi-teaching-core-1', initialBoard(), options)
}

export function xiangqiCandidates(state: GameState): Candidate[] {
  if (state.status.phase === 'complete') return []
  return legalActions(state.board, state.actor).map((action) =>
    candidateFor(state, action, `${action.from}–${action.to}`),
  )
}

export function applyXiangqiAction(state: GameState, action: Action, now: string): GameState {
  const board = applyBoard(state.board, action)
  const actor = otherSide(state.actor)
  return {
    ...state,
    actor,
    board,
    ply: state.ply + 1,
    status: statusAfter(board, actor),
    updatedAt: now,
  }
}

export const xiangqiTesting = { rawDestinations, legalActions, initialBoard }
