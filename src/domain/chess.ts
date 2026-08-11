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
