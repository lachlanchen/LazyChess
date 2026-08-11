import { stateToken } from './authority'
import { digest } from './hash'
import { applyChessAction, chessCandidates, initialChess } from './chess'
import { applyShogiAction, initialShogi, shogiCandidates } from './shogi'
import { applyXiangqiAction, initialXiangqi, xiangqiCandidates } from './xiangqi'
import type { NewStateOptions } from './state'
import type { ApplyResult, Candidate, GameState, Selection, Variant } from './types'

export function initialState(variant: Variant, options: NewStateOptions = {}): GameState {
  if (variant === 'chess') return initialChess(options)
  if (variant === 'xiangqi') return initialXiangqi(options)
  return initialShogi(options)
}

export function legalActions(state: GameState, actor = state.actor): Candidate[] {
  if (actor !== state.actor) return []
  if (state.variant === 'chess') return chessCandidates(state)
  if (state.variant === 'xiangqi') return xiangqiCandidates(state)
  return shogiCandidates(state)
}

function transition(state: GameState, candidate: Candidate, now: string): GameState {
  if (state.variant === 'chess') return applyChessAction(state, candidate.action, candidate.notation, now)
  if (state.variant === 'xiangqi') return applyXiangqiAction(state, candidate.action, now)
  return applyShogiAction(state, candidate.action, now)
}

function validate(state: GameState, selection: Omit<Selection, 'clientRequestId'>): Candidate | string {
  if (state.status.phase === 'complete') return 'game-over'
  const token = stateToken(state)
  if (selection.stateToken !== token) return 'stale-state'
  if (selection.actor !== state.actor) return 'wrong-actor'
  const candidate = legalActions(state).find((item) => item.id === selection.candidateId)
  return candidate ?? 'unknown-candidate'
}

export function previewCandidate(state: GameState, candidate: Candidate): GameState | null {
  const validated = validate(state, {
    candidateId: candidate.id,
    stateToken: candidate.stateToken,
    actor: candidate.actor,
  })
  if (typeof validated === 'string') return null
  const preview = transition(state, validated, state.updatedAt)
  return {
    ...preview,
    moves: [
      ...state.moves,
      {
        action: validated.action,
        actor: state.actor,
        notation: validated.notation,
        stateTokenBefore: validated.stateToken,
      },
    ],
  }
}

export function applyAction(state: GameState, selection: Selection, now = new Date().toISOString()): ApplyResult {
  const requestFingerprint = digest({
    candidateId: selection.candidateId,
    stateToken: selection.stateToken,
    actor: selection.actor,
  })
  const previousRequest = state.appliedRequests[selection.clientRequestId]
  if (previousRequest) {
    if (previousRequest.fingerprint !== requestFingerprint) {
      return { ok: false, state, reason: 'idempotency-conflict' }
    }
    return { ok: true, state, replayed: true }
  }
  const validated = validate(state, selection)
  if (typeof validated === 'string') {
    return { ok: false, state, reason: validated as 'stale-state' | 'wrong-actor' | 'unknown-candidate' | 'game-over' }
  }
  const transitioned = transition(state, validated, now)
  return {
    ok: true,
    replayed: false,
    state: {
      ...transitioned,
      revision: state.revision + 1,
      moves: [
        ...state.moves,
        {
          action: validated.action,
          actor: state.actor,
          notation: validated.notation,
          stateTokenBefore: validated.stateToken,
        },
      ],
      appliedRequests: {
        ...state.appliedRequests,
        [selection.clientRequestId]: {
          fingerprint: requestFingerprint,
          resultingRevision: state.revision + 1,
        },
      },
    },
  }
}

export function publicView(state: GameState): GameState {
  return structuredClone(state)
}

export function evaluate(state: GameState): GameState['status'] {
  return { ...state.status }
}
