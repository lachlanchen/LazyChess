export type Variant = 'chess' | 'xiangqi' | 'shogi'
export type Side = 'first' | 'second'
export const SUPPORTED_LOCALES = [
  'en',
  'ar',
  'es',
  'fr',
  'ja',
  'ko',
  'vi',
  'zh-Hans',
  'zh-Hant',
  'de',
  'ru',
] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export type Evidence = 'exact' | 'calculated' | 'engine' | 'authored' | 'model' | 'analogy'
export type PieceKind =
  | 'king'
  | 'queen'
  | 'rook'
  | 'bishop'
  | 'knight'
  | 'pawn'
  | 'advisor'
  | 'elephant'
  | 'cannon'
  | 'gold'
  | 'silver'
  | 'lance'
  | 'promoted-rook'
  | 'promoted-bishop'
  | 'promoted-silver'
  | 'promoted-knight'
  | 'promoted-lance'
  | 'promoted-pawn'

export interface Piece {
  kind: PieceKind
  side: Side
}

export interface Action {
  kind: 'move' | 'drop'
  from?: string
  to: string
  piece: PieceKind
  promote?: boolean
  promotion?: PieceKind
}

export interface GameStatus {
  phase: 'active' | 'complete'
  winner?: Side
  reason?: 'checkmate' | 'stalemate' | 'draw' | 'king-captured'
  inCheck: boolean
}

export interface MoveRecord {
  action: Action
  actor: Side
  notation: string
  stateTokenBefore: string
}

export interface GameState {
  schemaVersion: 2
  ruleset: string
  sessionId: string
  variant: Variant
  actor: Side
  board: Record<string, Piece>
  hands: Record<Side, Partial<Record<PieceKind, number>>>
  ply: number
  revision: number
  status: GameStatus
  moves: MoveRecord[]
  appliedRequests: Record<string, AppliedRequest>
  createdAt: string
  updatedAt: string
}

export interface AppliedRequest {
  fingerprint: string
  resultingRevision: number
}

export interface Candidate {
  id: string
  stateToken: string
  actor: Side
  action: Action
  notation: string
}

export interface Selection {
  candidateId: string
  stateToken: string
  actor: Side
  clientRequestId: string
}

export type ApplyFailure = 'stale-state' | 'wrong-actor' | 'unknown-candidate' | 'game-over' | 'idempotency-conflict'

export type ApplyResult =
  | { ok: true; state: GameState; replayed: boolean }
  | { ok: false; state: GameState; reason: ApplyFailure }

export interface BoardShape {
  files: number
  ranks: number
}

export interface TeachingClaim {
  evidence: Evidence
  titleKey: string
  bodyKey: string
  params?: Record<string, string | number>
}
