import { describe, expect, it } from 'vitest'
import { applyAction, initialState, legalActions } from './adapter'
import { stateToken } from './authority'
import {
  inspectCandidate,
  inspectPosition,
  primaryPositiveFactor,
  rankCandidateInsights,
  rankCandidatesByInsight,
} from './insight'
import type { Candidate, GameState, Variant } from './types'

const options = { sessionId: 'insight-test', now: '2026-08-11T00:00:00.000Z' }

function candidate(state: GameState, from: string, to: string): Candidate {
  const result = legalActions(state).find((item) => item.action.from === from && item.action.to === to)
  if (!result) throw new Error(`Missing candidate ${from}-${to}`)
  return result
}

function commit(state: GameState, selected: Candidate, request: string): GameState {
  const result = applyAction(state, {
    candidateId: selected.id,
    stateToken: selected.stateToken,
    actor: selected.actor,
    clientRequestId: request,
  }, options.now)
  if (!result.ok) throw new Error(result.reason)
  return result.state
}

describe('position-bound chess-family insight', () => {
  it.each([
    ['chess', 20],
    ['xiangqi', 44],
    ['shogi', 30],
  ] as const)('reports exact active-turn mobility without fabricating inactive %s mobility', (variant, count) => {
    const state = initialState(variant, { ...options, sessionId: `initial-${variant}` })
    const insight = inspectPosition(state)

    expect(insight.binding).toMatchObject({
      schemaVersion: 1,
      stateToken: stateToken(state),
      ruleset: state.ruleset,
      variant,
      actor: 'first',
      ply: 0,
    })
    expect(insight.mobility.first).toMatchObject({
      evidence: 'exact', available: true, legalActionCount: count,
    })
    expect(insight.mobility.second).toMatchObject({
      evidence: 'exact', available: false, unavailableReason: 'not-active-side', legalActionCount: null,
    })
    expect(insight.provenance).toEqual({
      squareControl: 'exact',
      pieceContacts: 'exact',
      legalMobility: 'exact',
      materialInventory: 'exact',
      materialValues: 'authored',
      kingSafety: 'exact',
      lanes: 'calculated',
      strategicConcepts: 'authored',
    })
  })

  it('separates standard-chess pawn attack control from forward mobility and includes defenses', () => {
    const insight = inspectPosition(initialState('chess', options))

    expect(insight.squares.d6.control.first.origins).toContain('e7')
    expect(insight.squares.f6.control.first.origins).toContain('e7')
    expect(insight.squares.e6.control.first.origins).not.toContain('e7')
    expect(insight.squares.e7.occupant).toMatchObject({
      piece: { side: 'first', kind: 'pawn' },
      attackedBy: [],
      contact: 'defended-only',
    })
    expect(insight.squares.e7.occupant?.defendedBy).toEqual(expect.arrayContaining(['d8', 'e8', 'f8', 'g8']))
  })

  it('models Xiangqi cannon pressure only beyond exactly one screen', () => {
    const insight = inspectPosition(initialState('xiangqi', options))

    expect(insight.squares.b7.control.first.origins).not.toContain('b8')
    expect(insight.squares.b6.control.first.origins).not.toContain('b8')
    expect(insight.squares.b2.control.first.origins).toContain('b8')
    expect(insight.squares.b1.control.first.origins).toContain('b8')
    expect(insight.lanes.some((lane) =>
      lane.origin === 'b8' && lane.kind === 'cannon-screen' && lane.screen === 'b3' && lane.controlled.includes('b2'),
    )).toBe(true)
  })

  it('includes Shogi friendly endpoints as defense while keeping drops in legal mobility', () => {
    const state = initialState('shogi', options)
    const insight = inspectPosition(state)

    expect(insight.squares.a6.control.first.origins).toContain('a7')
    expect(insight.squares.h7.control.first.origins).toEqual(expect.arrayContaining(['h8']))
    expect(insight.mobility.first.legalDropCount).toBe(0)

    delete state.board.a7
    state.hands.first.pawn = 1
    const withHand = inspectPosition(state)
    expect(withHand.mobility.first.legalDropCount).toBeGreaterThan(0)
    expect(withHand.material.first.inventory.hand.pawn).toBe(1)
  })

  it('keeps the initial inventory exact and its conventional value visibly authored', () => {
    const chess = inspectPosition(initialState('chess', options))
    expect(chess.material.first.inventory).toMatchObject({
      evidence: 'exact',
      board: { king: 1, queen: 1, rook: 2, bishop: 2, knight: 2, pawn: 8 },
      hand: {},
    })
    expect(chess.material.first.value).toEqual({
      evidence: 'authored', scale: 'authored-centiunit-v1', board: 3950, hand: 0, total: 3950,
    })
  })

  it('binds a non-mutating candidate preview and compares its real before/after control', () => {
    const state = initialState('chess', options)
    const beforeJson = JSON.stringify(state)
    const selected = candidate(state, 'e7', 'e5')
    const result = inspectCandidate(state, selected, { maxReplies: 1 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.stringify(state)).toBe(beforeJson)
    expect(result.insight.binding).toMatchObject({
      stateToken: stateToken(state), candidateId: selected.id, candidateStateToken: selected.stateToken,
    })
    expect(result.insight.facts).toMatchObject({
      evidence: 'exact', from: 'e7', to: 'e5', movedPiece: 'pawn', drop: false, capture: null,
    })
    expect(result.insight.after.binding.stateToken).not.toBe(result.insight.before.binding.stateToken)
    expect(result.insight.after.binding.actor).toBe('second')
    expect(result.insight.delta.actorLegalActionsBefore).toBe(20)
    expect(result.insight.delta.opponentLegalRepliesAfter).toBe(20)
    expect(result.insight.planIds).toContain('chess.plan.contest-center')
    expect(result.insight.forcingReplies).toHaveLength(1)
    expect(result.insight.forcingReplies[0]).toMatchObject({
      evidence: 'calculated', rank: 1, actor: 'second', orderingMethod: 'forcing-features-v1-not-engine-ranking',
    })
  })

  it('uses the canonical legal candidate rather than trusting forged duplicate fields', () => {
    const state = initialState('chess', options)
    const selected = candidate(state, 'e7', 'e5')
    const forged = { ...selected, action: { ...selected.action, to: 'e4' }, notation: 'forged' }
    const result = inspectCandidate(state, forged)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.insight.candidate.action.to).toBe('e5')
      expect(result.insight.candidate.notation).toBe('e4')
    }
  })

  it('fails closed for stale, wrong-actor, and unknown candidate bindings', () => {
    const state = initialState('chess', options)
    const selected = candidate(state, 'e7', 'e5')
    expect(inspectCandidate(state, { ...selected, stateToken: 'stale' })).toEqual({ ok: false, reason: 'stale-candidate' })
    expect(inspectCandidate(state, { ...selected, actor: 'second' })).toEqual({ ok: false, reason: 'wrong-actor' })
    expect(inspectCandidate(state, { ...selected, id: 'cand_unknown' })).toEqual({ ok: false, reason: 'unknown-candidate' })
  })

  it('reports the actual captured piece and authored contact-only exchange basis', () => {
    let state = initialState('chess', options)
    state = commit(state, candidate(state, 'e7', 'e5'), 'e4')
    state = commit(state, candidate(state, 'd2', 'd4'), 'd5')
    const capture = candidate(state, 'e5', 'd4')
    const result = inspectCandidate(state, capture, { maxReplies: 0 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.insight.facts.capture).toEqual({
      evidence: 'exact', coordinate: 'd4', piece: { side: 'second', kind: 'pawn' },
    })
    expect(result.insight.exchange).toMatchObject({
      evidence: 'calculated', authoredScale: 'authored-centiunit-v1', immediateGain: 100,
      movingPieceValue: 100, horizon: 'contact-only-no-search',
    })
  })

  it.each(['chess', 'xiangqi', 'shogi'] as Variant[])('analyzes legal first-action previews for %s', (variant) => {
    const state = initialState(variant, { ...options, sessionId: `preview-${variant}` })
    const selected = legalActions(state)[0]
    const result = inspectCandidate(state, selected, { maxReplies: 2 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.insight.before.binding.variant).toBe(variant)
    expect(result.insight.after.binding.actor).toBe('second')
    expect(result.insight.forcingReplies.length).toBeLessThanOrEqual(2)
    expect(result.insight.after.mobility.second.available).toBe(true)
    expect(result.insight.after.mobility.first.available).toBe(false)
  })
})

describe('variant-native authored teaching order', () => {
  it.each(['chess', 'xiangqi', 'shogi'] as Variant[])('ranks only supplied legal %s candidates with transparent factors', (variant) => {
    const state = initialState(variant, { ...options, sessionId: `ranking-${variant}` })
    const legal = legalActions(state)
    const ranked = rankCandidateInsights(state, legal)

    expect(ranked).toHaveLength(legal.length)
    expect(new Set(ranked.map(({ candidate: item }) => item.id))).toEqual(new Set(legal.map(({ id }) => id)))
    expect(ranked.every((item) => item.evidence === 'authored')).toBe(true)
    expect(ranked.every((item) => item.method === 'variant-native-teaching-order-v1-not-engine-ranking')).toBe(true)
    expect(ranked.map(({ score }) => score)).toEqual([...ranked.map(({ score }) => score)].sort((a, b) => b - a))
    expect(rankCandidatesByInsight(state, legal).map(({ id }) => id)).toEqual(ranked.map(({ candidate: item }) => item.id))
  })

  it('prefers principled central pawn candidates to irrelevant rook-pawn pushes in the initial chess lesson', () => {
    const state = initialState('chess', options)
    const ranked = rankCandidateInsights(state)
    const e4 = ranked.find(({ candidate: item }) => item.action.from === 'e7' && item.action.to === 'e5')
    const a3 = ranked.find(({ candidate: item }) => item.action.from === 'a7' && item.action.to === 'a6')

    expect(e4).toBeDefined()
    expect(a3).toBeDefined()
    expect(e4!.score).toBeGreaterThan(a3!.score)
    expect(e4!.factors).toContainEqual(expect.objectContaining({ id: 'chess.plan.contest-center' }))
  })

  it('ranks the canonical action for a supplied id and rejects unknown ids without inspecting forged payloads', () => {
    const state = initialState('chess', options)
    const selected = candidate(state, 'e7', 'e5')
    const forged = {
      ...selected,
      action: { ...selected.action, from: 'a1', to: 'z99' },
      notation: 'forged',
    }
    const ranked = rankCandidateInsights(state, [forged, { ...forged, id: 'cand_unknown' }])

    expect(ranked).toHaveLength(1)
    expect(ranked[0].candidate).toMatchObject({ id: selected.id, notation: selected.notation, action: selected.action })
  })

  it('never presents a negative ranking factor as a positive teaching rationale', () => {
    expect(primaryPositiveFactor([
      { id: 'net-control', contribution: -21 },
      { id: 'capture-outlook', contribution: -250 },
    ])).toBeNull()
    expect(primaryPositiveFactor([
      { id: 'net-control', contribution: -21 },
      { id: 'chess.plan.develop-minor', contribution: 180 },
      { id: 'chess.plan.contest-center', contribution: 130 },
    ])).toEqual({ id: 'chess.plan.develop-minor', contribution: 180 })
  })

  it('opens the Shogi bishop diagonal before rewarding generic king movement', () => {
    const state = initialState('shogi', options)
    const ranked = rankCandidateInsights(state)

    expect(ranked[0].candidate.action).toMatchObject({ kind: 'move', piece: 'pawn', from: 'c7', to: 'c6' })
    expect(ranked[0].factors).toContainEqual(expect.objectContaining({ id: 'shogi.plan.open-bishop-diagonal' }))
    expect(ranked.find(({ candidate: item }) => item.action.piece === 'king')?.factors)
      .not.toContainEqual(expect.objectContaining({ id: 'plan.improve-control' }))
  })

  it('marks a Xiangqi king step that uncovers the flying-general line as hostile', () => {
    const state = initialState('xiangqi', { ...options, sessionId: 'flying-general-ring' })
    delete state.board.e10
    delete state.board.e7
    delete state.board.e4
    state.board.d10 = { side: 'first', kind: 'king' }

    const insight = inspectPosition(state)

    expect(insight.kings.first.ring).toContain('e10')
    expect(insight.kings.first.hostileRingSquares).toContain('e10')
    expect(insight.kings.first.legalKingDestinations).not.toContain('e10')
  })

  it('keeps high-branching Shogi ranking and hover evidence bounded', () => {
    const state = initialState('shogi', { ...options, sessionId: 'high-branching-shogi' })
    for (const coordinate of ['a1', 'b1', 'c1', 'd1', 'b2', 'h2', 'a3', 'a7']) delete state.board[coordinate]
    state.hands.first = { lance: 1, knight: 1, silver: 1, gold: 1, rook: 1, bishop: 1, pawn: 1 }
    state.hands.second = { pawn: 1 }
    const candidates = legalActions(state)
    expect(candidates.length).toBeGreaterThan(200)

    const rankingStarted = performance.now()
    const ranked = rankCandidateInsights(state, candidates)
    const rankingMs = performance.now() - rankingStarted
    expect(ranked).toHaveLength(candidates.length)
    expect(rankingMs).toBeLessThan(2_500)

    const previewStarted = performance.now()
    const preview = inspectCandidate(state, ranked[0].candidate, { maxReplies: 2 })
    const previewMs = performance.now() - previewStarted
    expect(preview.ok).toBe(true)
    expect(previewMs).toBeLessThan(2_500)
  })
})
