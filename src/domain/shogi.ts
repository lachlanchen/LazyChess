import { candidateFor } from './authority'
import { inside, point, square } from './coordinates'
import { baseState, demote, otherSide, type NewStateOptions } from './state'
import type { Action, Candidate, GameState, GameStatus, Piece, PieceKind, Side } from './types'

const SHAPE = { files: 9, ranks: 9 }
type Board = Record<string, Piece>

const promoted: Partial<Record<PieceKind, PieceKind>> = {
  rook: 'promoted-rook',
  bishop: 'promoted-bishop',
  silver: 'promoted-silver',
  knight: 'promoted-knight',
  lance: 'promoted-lance',
  pawn: 'promoted-pawn',
}

function put(board: Board, side: Side, kind: PieceKind, coordinates: string[]): void {
  for (const coordinate of coordinates) board[coordinate] = { side, kind }
}

function initialBoard(): Board {
  const board: Board = {}
  put(board, 'second', 'lance', ['a1', 'i1'])
  put(board, 'second', 'knight', ['b1', 'h1'])
  put(board, 'second', 'silver', ['c1', 'g1'])
  put(board, 'second', 'gold', ['d1', 'f1'])
  put(board, 'second', 'king', ['e1'])
  put(board, 'second', 'rook', ['b2'])
  put(board, 'second', 'bishop', ['h2'])
  put(board, 'second', 'pawn', ['a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3', 'i3'])
  put(board, 'first', 'lance', ['a9', 'i9'])
  put(board, 'first', 'knight', ['b9', 'h9'])
  put(board, 'first', 'silver', ['c9', 'g9'])
  put(board, 'first', 'gold', ['d9', 'f9'])
  put(board, 'first', 'king', ['e9'])
  put(board, 'first', 'bishop', ['b8'])
  put(board, 'first', 'rook', ['h8'])
  put(board, 'first', 'pawn', ['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7', 'i7'])
  return board
}

function rawDestinations(board: Board, from: string): string[] {
  const piece = board[from]
  if (!piece) return []
  const { x, y } = point(from)
  const forward = piece.side === 'first' ? -1 : 1
  const result: string[] = []
  const step = (dx: number, dy: number) => {
    const tx = x + dx
    const ty = y + dy
    if (!inside(SHAPE, tx, ty)) return
    const target = board[square(tx, ty)]
    if (!target || target.side !== piece.side) result.push(square(tx, ty))
  }
  const slide = (directions: number[][]) => {
    for (const [dx, dy] of directions) {
      for (let tx = x + dx, ty = y + dy; inside(SHAPE, tx, ty); tx += dx, ty += dy) {
        const target = board[square(tx, ty)]
        if (!target) result.push(square(tx, ty))
        else {
          if (target.side !== piece.side) result.push(square(tx, ty))
          break
        }
      }
    }
  }

  if (piece.kind === 'king') {
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (dx || dy) step(dx, dy)
  } else if (piece.kind === 'gold' || ['promoted-silver', 'promoted-knight', 'promoted-lance', 'promoted-pawn'].includes(piece.kind)) {
    for (const [dx, dy] of [[0, forward], [-1, forward], [1, forward], [-1, 0], [1, 0], [0, -forward]]) step(dx, dy)
  } else if (piece.kind === 'silver') {
    for (const [dx, dy] of [[0, forward], [-1, forward], [1, forward], [-1, -forward], [1, -forward]]) step(dx, dy)
  } else if (piece.kind === 'knight') {
    step(-1, 2 * forward)
    step(1, 2 * forward)
  } else if (piece.kind === 'lance') {
    slide([[0, forward]])
  } else if (piece.kind === 'pawn') {
    step(0, forward)
  } else if (piece.kind === 'rook' || piece.kind === 'promoted-rook') {
    slide([[1, 0], [-1, 0], [0, 1], [0, -1]])
    if (piece.kind === 'promoted-rook') for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) step(dx, dy)
  } else if (piece.kind === 'bishop' || piece.kind === 'promoted-bishop') {
    slide([[1, 1], [1, -1], [-1, 1], [-1, -1]])
    if (piece.kind === 'promoted-bishop') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) step(dx, dy)
  }
  return result
}

function inZone(side: Side, coordinate: string): boolean {
  const { y } = point(coordinate)
  return side === 'first' ? y <= 2 : y >= 6
}

function mandatoryPromotion(side: Side, kind: PieceKind, to: string): boolean {
  const { y } = point(to)
  const last = side === 'first' ? y === 0 : y === 8
  const lastTwo = side === 'first' ? y <= 1 : y >= 7
  return ((kind === 'pawn' || kind === 'lance') && last) || (kind === 'knight' && lastTwo)
}

function kingSquare(board: Board, side: Side): string | undefined {
  return Object.entries(board).find(([, piece]) => piece.side === side && piece.kind === 'king')?.[0]
}

function attacks(board: Board, side: Side, target: string): boolean {
  return Object.entries(board).some(([from, piece]) => piece.side === side && rawDestinations(board, from).includes(target))
}

function simulate(board: Board, action: Action, side: Side): Board {
  const next = { ...board }
  if (action.kind === 'drop') {
    next[action.to] = { side, kind: action.piece }
    return next
  }
  if (!action.from) return next
  const moving = next[action.from]
  delete next[action.from]
  next[action.to] = { ...moving, kind: action.promote ? (promoted[moving.kind] ?? moving.kind) : moving.kind }
  return next
}

function dropAllowed(board: Board, side: Side, kind: PieceKind, to: string): boolean {
  const { x, y } = point(to)
  const last = side === 'first' ? y === 0 : y === 8
  const lastTwo = side === 'first' ? y <= 1 : y >= 7
  if ((kind === 'pawn' || kind === 'lance') && last) return false
  if (kind === 'knight' && lastTwo) return false
  if (kind === 'pawn') {
    const duplicate = Object.entries(board).some(([coordinate, piece]) =>
      point(coordinate).x === x && piece.side === side && piece.kind === 'pawn',
    )
    if (duplicate) return false
  }
  return true
}

function allActions(state: GameState, side: Side): Action[] {
  const actions: Action[] = []
  for (const [from, piece] of Object.entries(state.board)) {
    if (piece.side !== side) continue
    for (const to of rawDestinations(state.board, from)) {
      if (state.board[to]?.kind === 'king') continue
      const canPromote = Boolean(promoted[piece.kind]) && (inZone(side, from) || inZone(side, to))
      const choices = mandatoryPromotion(side, piece.kind, to) ? [true] : canPromote ? [false, true] : [false]
      for (const promote of choices) actions.push({ kind: 'move', from, to, piece: piece.kind, ...(promote ? { promote } : {}) })
    }
  }
  for (const [kind, count] of Object.entries(state.hands[side]) as [PieceKind, number][]) {
    if (!count) continue
    for (let y = 0; y < SHAPE.ranks; y += 1) {
      for (let x = 0; x < SHAPE.files; x += 1) {
        const to = square(x, y)
        if (!state.board[to] && dropAllowed(state.board, side, kind, to)) actions.push({ kind: 'drop', to, piece: kind })
      }
    }
  }
  return actions.filter((action) => {
    const next = simulate(state.board, action, side)
    const king = kingSquare(next, side)
    return Boolean(king && !attacks(next, otherSide(side), king))
  })
}

function statusAfter(state: GameState, actor: Side): GameStatus {
  const king = kingSquare(state.board, actor)
  const inCheck = Boolean(king && attacks(state.board, otherSide(actor), king))
  if (allActions(state, actor).length === 0) {
    return { phase: 'complete', winner: otherSide(actor), reason: inCheck ? 'checkmate' : 'stalemate', inCheck }
  }
  return { phase: 'active', inCheck }
}

export function initialShogi(options: NewStateOptions = {}): GameState {
  return baseState('shogi', 'shogi-teaching-core-1', initialBoard(), options)
}

export function shogiCandidates(state: GameState): Candidate[] {
  if (state.status.phase === 'complete') return []
  return allActions(state, state.actor).map((action) => {
    const notation = action.kind === 'drop'
      ? `${action.piece}*${action.to}`
      : `${action.from}–${action.to}${action.promote ? '+' : ''}`
    return candidateFor(state, action, notation)
  })
}

export function applyShogiAction(state: GameState, action: Action, now: string): GameState {
  const board = simulate(state.board, action, state.actor)
  const hands = {
    first: { ...state.hands.first },
    second: { ...state.hands.second },
  }
  if (action.kind === 'move') {
    const captured = state.board[action.to]
    if (captured) {
      const capturedKind = demote(captured.kind)
      hands[state.actor][capturedKind] = (hands[state.actor][capturedKind] ?? 0) + 1
    }
  } else {
    hands[state.actor][action.piece] = (hands[state.actor][action.piece] ?? 0) - 1
  }
  const actor = otherSide(state.actor)
  const interim = { ...state, board, hands, actor }
  return {
    ...interim,
    ply: state.ply + 1,
    status: statusAfter(interim, actor),
    updatedAt: now,
  }
}

export const shogiTesting = { rawDestinations, allActions, dropAllowed, initialBoard }
