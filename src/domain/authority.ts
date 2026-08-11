import { digest } from './hash'
import type { Action, Candidate, GameState } from './types'

export function stateToken(state: GameState): string {
  return digest({
    schemaVersion: state.schemaVersion,
    ruleset: state.ruleset,
    sessionId: state.sessionId,
    variant: state.variant,
    actor: state.actor,
    board: state.board,
    hands: state.hands,
    ply: state.ply,
    status: state.status,
    moves: state.moves,
  })
}

export function candidateFor(state: GameState, action: Action, notation: string): Candidate {
  const token = stateToken(state)
  return {
    id: `cand_${digest({ stateToken: token, actor: state.actor, action })}`,
    stateToken: token,
    actor: state.actor,
    action,
    notation,
  }
}

export function sameAction(left: Action, right: Action): boolean {
  return digest(left) === digest(right)
}
