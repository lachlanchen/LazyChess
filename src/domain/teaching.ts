import { displayCoordinate, point } from './coordinates'
import type { Candidate, GameState, TeachingClaim } from './types'

function centreDistance(state: GameState, coordinate: string): number {
  const { x, y } = point(coordinate)
  const files = state.variant === 'chess' ? 8 : 9
  const ranks = state.variant === 'xiangqi' ? 10 : state.variant === 'chess' ? 8 : 9
  return Math.abs(x - (files - 1) / 2) + Math.abs(y - (ranks - 1) / 2)
}

export function authoredScore(state: GameState, candidate: Candidate): number {
  const capture = state.board[candidate.action.to] ? 40 : 0
  const promote = candidate.action.promote || candidate.action.promotion ? 18 : 0
  const drop = candidate.action.kind === 'drop' ? 6 : 0
  return Math.round(100 - centreDistance(state, candidate.action.to) * 5 + capture + promote + drop)
}

export function rankedCandidates(state: GameState, candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => authoredScore(state, b) - authoredScore(state, a) || a.notation.localeCompare(b.notation))
}

export function teachingFacets(before: GameState, after: GameState, candidate: Candidate): TeachingClaim[] {
  // A capture is not always located on the destination square. Standard
  // chess en-passant removes the bypassed pawn, so derive the exact fact from
  // the deterministic before/after boards instead of guessing from `to`.
  const captured = Object.entries(before.board).some(([coordinate, piece]) => {
    if (piece.side === candidate.actor) return false
    const remaining = after.board[coordinate]
    return !remaining || remaining.side !== piece.side || remaining.kind !== piece.kind
  })
  const exactKey = candidate.action.kind === 'drop'
    ? 'teach.exact.drop'
    : captured
      ? 'teach.exact.capture'
      : 'teach.exact.move'
  const purposeKey = captured
    ? 'teach.strategy.capture'
    : candidate.action.promote || candidate.action.promotion
      ? 'teach.strategy.promote'
      : centreDistance(before, candidate.action.to) <= 2
        ? 'teach.strategy.center'
        : 'teach.strategy.develop'
  return [
    {
      evidence: 'exact',
      titleKey: 'teach.exact.title',
      bodyKey: exactKey,
      params: {
        from: candidate.action.from ? displayCoordinate(before.variant, candidate.action.from) : candidate.action.piece,
        to: displayCoordinate(before.variant, candidate.action.to),
        notation: candidate.notation,
      },
    },
    {
      evidence: 'authored',
      titleKey: 'teach.strategy.title',
      bodyKey: purposeKey,
    },
    after.status.phase === 'complete'
      ? {
          evidence: 'exact',
          titleKey: 'teach.reply.terminalTitle',
          bodyKey: 'teach.reply.terminal',
        }
      : {
          evidence: 'calculated',
          titleKey: 'teach.reply.title',
          bodyKey: after.status.inCheck ? 'teach.reply.check' : 'teach.reply.scan',
        },
    {
      evidence: 'analogy',
      titleKey: 'teach.principle.title',
      bodyKey: 'teach.principle.lanes',
    },
  ]
}
