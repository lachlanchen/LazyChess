import type { GameState, Piece, PieceKind, Side, Variant } from './types'

export interface NewStateOptions {
  sessionId?: string
  now?: string
}

export function otherSide(side: Side): Side {
  return side === 'first' ? 'second' : 'first'
}

export function makeSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function baseState(
  variant: Variant,
  ruleset: string,
  board: Record<string, Piece>,
  options: NewStateOptions = {},
): GameState {
  const now = options.now ?? new Date().toISOString()
  return {
    schemaVersion: 2,
    ruleset,
    sessionId: options.sessionId ?? makeSessionId(),
    variant,
    actor: 'first',
    board,
    hands: { first: {}, second: {} },
    ply: 0,
    revision: 0,
    status: { phase: 'active', inCheck: false },
    moves: [],
    appliedRequests: {},
    createdAt: now,
    updatedAt: now,
  }
}

export function demote(kind: PieceKind): PieceKind {
  const base: Partial<Record<PieceKind, PieceKind>> = {
    'promoted-rook': 'rook',
    'promoted-bishop': 'bishop',
    'promoted-silver': 'silver',
    'promoted-knight': 'knight',
    'promoted-lance': 'lance',
    'promoted-pawn': 'pawn',
  }
  return base[kind] ?? kind
}
