import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { candidateFor } from './authority'
import { stableJson } from './hash'
import { baseState, type NewStateOptions } from './state'
import type { Action, Candidate, GameState, GameStatus, Piece, PieceKind, Side } from './types'

const kindFromChess: Record<PieceSymbol, PieceKind> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
}

function sideFromColor(color: Color): Side {
  return color === 'w' ? 'first' : 'second'
}

function colorFromSide(side: Side): Color {
  return side === 'first' ? 'w' : 'b'
}

function toInternal(value: string): string {
  return `${value[0]}${9 - Number(value[1])}`
}

function toChess(value: string): Square {
  return `${value[0]}${9 - Number(value.slice(1))}` as Square
}

function normalizedBoard(game: Chess): Record<string, Piece> {
  const board: Record<string, Piece> = {}
  for (const row of game.board()) {
    for (const item of row) {
      if (item) {
        board[toInternal(item.square)] = {
          kind: kindFromChess[item.type],
          side: sideFromColor(item.color),
        }
      }
    }
  }
  return board
}

function chessFor(state: GameState): Chess {
  const game = new Chess()
  for (const record of state.moves) {
    const action = record.action
    if (action.kind !== 'move' || !action.from) throw new Error('Invalid chess history')
    game.move({
      from: toChess(action.from),
      to: toChess(action.to),
      promotion: action.promotion ? ({ queen: 'q', rook: 'r', bishop: 'b', knight: 'n' } as const)[action.promotion as 'queen' | 'rook' | 'bishop' | 'knight'] : undefined,
    })
  }
  if (stableJson(normalizedBoard(game)) !== stableJson(state.board)) {
    throw new Error('Chess state integrity mismatch')
  }
  return game
}

function statusFor(game: Chess): GameStatus {
  if (game.isCheckmate()) {
    return { phase: 'complete', winner: game.turn() === 'w' ? 'second' : 'first', reason: 'checkmate', inCheck: true }
  }
  if (game.isDraw()) return { phase: 'complete', reason: 'draw', inCheck: game.inCheck() }
  return { phase: 'active', inCheck: game.inCheck() }
}

export function initialChess(options: NewStateOptions = {}): GameState {
  const game = new Chess()
  return baseState('chess', 'chess.js-1.4.0-standard', normalizedBoard(game), options)
}

export function chessCandidates(state: GameState): Candidate[] {
  if (state.status.phase === 'complete') return []
  const game = chessFor(state)
  return game.moves({ verbose: true }).map((move) => {
    const action: Action = {
      kind: 'move',
      from: toInternal(move.from),
      to: toInternal(move.to),
      piece: kindFromChess[move.piece],
      ...(move.promotion ? { promotion: kindFromChess[move.promotion] } : {}),
    }
    return candidateFor(state, action, move.san)
  })
}

/**
 * Returns the origins whose pieces control `target` under the standard-chess
 * attack relation. This is deliberately different from legal move mobility:
 * it includes defended friendly pieces and pawn attack diagonals, while a
 * pinned piece can still control a square for king-safety purposes.
 */
export function chessControlOrigins(state: GameState, target: string, side: Side): string[] {
  return chessFor(state)
    .attackers(toChess(target), colorFromSide(side))
    .map(toInternal)
    .sort()
}

export function chessControlMap(state: GameState): Record<Side, Record<string, string[]>> {
  const game = chessFor(state)
  const result: Record<Side, Record<string, string[]>> = { first: {}, second: {} }
  for (const side of ['first', 'second'] as const) {
    for (let rank = 1; rank <= 8; rank += 1) {
      for (let file = 0; file < 8; file += 1) {
        const target = `${String.fromCharCode(97 + file)}${rank}`
        result[side][target] = game
          .attackers(toChess(target), colorFromSide(side))
          .map(toInternal)
          .sort()
      }
    }
  }
  return result
}

export function applyChessAction(state: GameState, action: Action, notation: string, now: string): GameState {
  if (action.kind !== 'move' || !action.from) throw new Error('Chess only accepts moves')
  const game = chessFor(state)
  game.move({
    from: toChess(action.from),
    to: toChess(action.to),
    promotion: action.promotion
      ? ({ queen: 'q', rook: 'r', bishop: 'b', knight: 'n' } as const)[
          action.promotion as 'queen' | 'rook' | 'bishop' | 'knight'
        ]
      : undefined,
  })
  return {
    ...state,
    actor: sideFromColor(game.turn()),
    board: normalizedBoard(game),
    ply: state.ply + 1,
    status: statusFor(game),
    updatedAt: now,
  }
}
