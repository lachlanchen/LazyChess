import { legalActions, previewCandidate } from './adapter'
import { stateToken } from './authority'
import { chessControlMap } from './chess'
import { inside, point, square } from './coordinates'
import { demote, otherSide } from './state'
import { projectShogiActionForInsight, shogiControlTargets } from './shogi'
import type { Action, BoardShape, Candidate, Evidence, GameState, Piece, PieceKind, Side, Variant } from './types'
import { xiangqiControlTargets } from './xiangqi'

export const INSIGHT_SCHEMA_VERSION = 1 as const

const SIDES = ['first', 'second'] as const
const SHAPES: Record<Variant, BoardShape> = {
  chess: { files: 8, ranks: 8 },
  xiangqi: { files: 9, ranks: 10 },
  shogi: { files: 9, ranks: 9 },
}

const AUTHORED_VALUES: Record<Variant, Partial<Record<PieceKind, number>>> = {
  chess: { queen: 900, rook: 500, bishop: 325, knight: 300, pawn: 100 },
  xiangqi: { rook: 900, cannon: 450, knight: 400, elephant: 200, advisor: 200, pawn: 100 },
  shogi: {
    rook: 1000,
    bishop: 850,
    gold: 600,
    silver: 500,
    knight: 350,
    lance: 300,
    pawn: 100,
    'promoted-rook': 1300,
    'promoted-bishop': 1150,
    'promoted-silver': 600,
    'promoted-knight': 600,
    'promoted-lance': 600,
    'promoted-pawn': 600,
  },
}

export interface InsightBinding {
  schemaVersion: typeof INSIGHT_SCHEMA_VERSION
  stateToken: string
  ruleset: string
  variant: Variant
  actor: Side
  ply: number
}

export interface ControlSources {
  evidence: 'exact'
  count: number
  origins: string[]
}

export type PieceContact =
  | 'king'
  | 'attacked-undefended'
  | 'attacked-defended'
  | 'defended-only'
  | 'uncontacted'

export interface PieceInsight {
  coordinate: string
  piece: Piece
  evidence: 'exact'
  attackedBy: string[]
  defendedBy: string[]
  contact: PieceContact
}

export interface SquareInsight {
  coordinate: string
  control: Record<Side, ControlSources>
  contested: boolean
  occupant?: PieceInsight
}

export interface MobilityInsight {
  evidence: 'exact'
  side: Side
  available: boolean
  unavailableReason?: 'not-active-side' | 'game-complete' | 'not-calculated'
  legalActionCount: number | null
  legalMoveCount: number | null
  legalCaptureCount: number | null
  legalDropCount: number | null
  byOrigin: Record<string, number>
}

export interface MaterialInventory {
  evidence: 'exact'
  board: Partial<Record<PieceKind, number>>
  hand: Partial<Record<PieceKind, number>>
}

export interface AuthoredMaterialValue {
  evidence: 'authored'
  scale: 'authored-centiunit-v1'
  board: number
  hand: number
  total: number
}

export interface SideMaterialInsight {
  inventory: MaterialInventory
  value: AuthoredMaterialValue
}

export interface KingInsight {
  evidence: 'exact'
  side: Side
  square: string | null
  inCheck: boolean
  checkingOrigins: string[]
  ring: string[]
  hostileRingSquares: string[]
  hostileRingCount: number
  legalKingActionIds: string[] | null
  legalKingDestinations: string[] | null
  statusAgreement: boolean | null
}

export type LaneKind = 'orthogonal' | 'diagonal' | 'forward-file' | 'cannon-screen'

export interface LaneInsight {
  evidence: 'calculated'
  side: Side
  piece: PieceKind
  origin: string
  kind: LaneKind
  path: string[]
  controlled: string[]
  contested: string[]
  screen?: string
  blocker?: string
}

export type StrategicConceptId =
  | 'chess.center-occupation'
  | 'chess.center-control'
  | 'chess.minor-development'
  | 'chess.space-control'
  | 'xiangqi.crossed-river-pawns'
  | 'xiangqi.enemy-palace-control'
  | 'xiangqi.central-file-control'
  | 'shogi.promotion-zone-presence'
  | 'shogi.enemy-camp-control'
  | 'shogi.pieces-in-hand'
  | 'shogi.central-file-control'

export interface StrategicConcept {
  evidence: 'authored'
  id: StrategicConceptId
  side: Side
  value: number
  maximum?: number
  squares: string[]
}

export interface PositionInsight {
  binding: InsightBinding
  provenance: {
    squareControl: 'exact'
    pieceContacts: 'exact'
    legalMobility: 'exact'
    materialInventory: 'exact'
    materialValues: 'authored'
    kingSafety: 'exact'
    lanes: 'calculated'
    strategicConcepts: 'authored'
  }
  squares: Record<string, SquareInsight>
  mobility: Record<Side, MobilityInsight>
  material: Record<Side, SideMaterialInsight>
  kings: Record<Side, KingInsight>
  lanes: LaneInsight[]
  concepts: StrategicConcept[]
}

export interface ExactCapture {
  evidence: 'exact'
  coordinate: string
  piece: Piece
  transferredToHand?: PieceKind
}

export interface CandidateFacts {
  evidence: 'exact'
  from: string | null
  to: string
  movedPiece: PieceKind
  drop: boolean
  promotion: PieceKind | true | null
  capture: ExactCapture | null
  givesCheck: boolean
  endsGame: boolean
}

export interface SideControlDelta {
  gained: string[]
  lost: string[]
  strengthened: string[]
  weakened: string[]
}

export interface PieceDeltaRef {
  coordinate: string
  piece: Piece
}

export interface CandidateDelta {
  evidence: 'calculated'
  control: Record<Side, SideControlDelta>
  newlyContested: string[]
  noLongerContested: string[]
  piecesNewlyAttacked: PieceDeltaRef[]
  piecesRescued: PieceDeltaRef[]
  piecesNewlyAttackedUndefended: PieceDeltaRef[]
  piecesNoLongerAttackedUndefended: PieceDeltaRef[]
  movingPieceControlBefore: number
  movingPieceControlAfter: number
  movingPieceControlDelta: number
  actorLegalActionsBefore: number
  opponentLegalRepliesAfter: number
  kingDangerDelta: Record<Side, number>
}

export type ExchangeOutlookKind =
  | 'quiet'
  | 'unanswered-gain'
  | 'favorable-if-recaptured'
  | 'even-if-recaptured'
  | 'costly-if-recaptured'
  | 'exposed-mover'

export interface ExchangeOutlook {
  evidence: 'calculated'
  kind: ExchangeOutlookKind
  authoredScale: 'authored-centiunit-v1'
  immediateGain: number
  movingPieceValue: number
  netIfMovingPieceLost: number
  destinationAttackers: number
  destinationDefenders: number
  horizon: 'contact-only-no-search'
}

export interface CandidateThreats {
  evidence: 'calculated'
  relation: 'rule-control-not-legal-capture-forecast'
  attackedEnemyPiecesAfter: PieceDeltaRef[]
  newlyAttackedEnemyPieces: PieceDeltaRef[]
  givesCheck: boolean
}

export type ReplyReason = 'check' | 'capture' | 'promotion' | 'drop' | 'legal-sample'

export interface ForcingReplySample {
  evidence: 'calculated'
  rank: number
  candidateId: string
  stateToken: string
  actor: Side
  action: Action
  notation: string
  reasons: ReplyReason[]
  capture: ExactCapture | null
  givesCheck: boolean
  orderingScore: number
  orderingMethod: 'forcing-features-v1-not-engine-ranking'
}

export type PlanId =
  | 'plan.win-material'
  | 'plan.force-king-response'
  | 'plan.improve-control'
  | 'plan.reduce-king-danger'
  | 'chess.plan.develop-minor'
  | 'chess.plan.contest-center'
  | 'xiangqi.plan.cross-river'
  | 'xiangqi.plan.press-palace'
  | 'xiangqi.plan.use-cannon-screen'
  | 'shogi.plan.enter-promotion-zone'
  | 'shogi.plan.open-bishop-diagonal'
  | 'shogi.plan.use-hand'
  | 'shogi.plan.press-camp'

export interface CandidateInsight {
  binding: InsightBinding & { candidateId: string; candidateStateToken: string }
  candidate: Candidate
  before: PositionInsight
  after: PositionInsight
  facts: CandidateFacts
  delta: CandidateDelta
  threats: CandidateThreats
  exchange: ExchangeOutlook
  forcingReplies: ForcingReplySample[]
  planIds: PlanId[]
}

export type CandidateInsightFailure = 'stale-candidate' | 'wrong-actor' | 'unknown-candidate' | 'preview-failed'
export type CandidateInsightResult =
  | { ok: true; insight: CandidateInsight }
  | { ok: false; reason: CandidateInsightFailure }

export interface InspectCandidateOptions {
  maxReplies?: number
}

export type RankingFactorId =
  | 'forcing-check'
  | 'capture-outlook'
  | 'promotion'
  | 'reduce-own-king-ring'
  | 'increase-own-king-ring'
  | 'rescue-piece'
  | 'leave-piece-attacked-undefended'
  | 'create-attacked-undefended-target'
  | 'net-control'
  | PlanId

export interface CandidateRankingFactor {
  id: RankingFactorId
  contribution: number
}

export interface RankedCandidateInsight {
  evidence: 'authored'
  candidate: Candidate
  score: number
  method: 'variant-native-teaching-order-v1-not-engine-ranking'
  factors: CandidateRankingFactor[]
}

/** Selects an honest learner-facing rationale without turning a penalty into
 * positive prose such as “improves control.” */
export function primaryPositiveFactor(factors: CandidateRankingFactor[]): CandidateRankingFactor | null {
  return factors
    .filter(({ contribution }) => contribution > 0)
    .sort((left, right) => right.contribution - left.contribution || left.id.localeCompare(right.id))[0] ?? null
}

function coordinatesFor(variant: Variant): string[] {
  const shape = SHAPES[variant]
  const result: string[] = []
  for (let y = 0; y < shape.ranks; y += 1) {
    for (let x = 0; x < shape.files; x += 1) result.push(square(x, y))
  }
  return result
}

function controlMap(state: GameState): Record<Side, Record<string, string[]>> {
  if (state.variant === 'chess') return chessControlMap(state)
  const result: Record<Side, Record<string, string[]>> = { first: {}, second: {} }
  for (const coordinate of coordinatesFor(state.variant)) {
    result.first[coordinate] = []
    result.second[coordinate] = []
  }
  for (const [origin, piece] of Object.entries(state.board)) {
    const targets = state.variant === 'xiangqi'
      ? xiangqiControlTargets(state.board, origin)
      : shogiControlTargets(state.board, origin)
    for (const target of targets) result[piece.side][target]?.push(origin)
  }
  for (const side of SIDES) {
    for (const coordinate of coordinatesFor(state.variant)) result[side][coordinate].sort()
  }
  return result
}

function isCapture(state: GameState, candidate: Candidate): boolean {
  if (state.board[candidate.action.to]?.side === otherSide(candidate.actor)) return true
  return state.variant === 'chess' && candidate.notation.includes('x')
}

function mobilityFor(state: GameState, candidates: Candidate[] | null, side: Side): MobilityInsight {
  if (state.status.phase === 'complete') {
    return {
      evidence: 'exact', side, available: false, unavailableReason: 'game-complete',
      legalActionCount: null, legalMoveCount: null, legalCaptureCount: null, legalDropCount: null, byOrigin: {},
    }
  }
  if (side !== state.actor) {
    return {
      evidence: 'exact', side, available: false, unavailableReason: 'not-active-side',
      legalActionCount: null, legalMoveCount: null, legalCaptureCount: null, legalDropCount: null, byOrigin: {},
    }
  }
  if (candidates === null) {
    return {
      evidence: 'exact', side, available: false, unavailableReason: 'not-calculated',
      legalActionCount: null, legalMoveCount: null, legalCaptureCount: null, legalDropCount: null, byOrigin: {},
    }
  }
  const byOrigin: Record<string, number> = {}
  for (const candidate of candidates) {
    const origin = candidate.action.from ?? `hand:${candidate.action.piece}`
    byOrigin[origin] = (byOrigin[origin] ?? 0) + 1
  }
  return {
    evidence: 'exact',
    side,
    available: true,
    legalActionCount: candidates.length,
    legalMoveCount: candidates.filter(({ action }) => action.kind === 'move').length,
    legalCaptureCount: candidates.filter((candidate) => isCapture(state, candidate)).length,
    legalDropCount: candidates.filter(({ action }) => action.kind === 'drop').length,
    byOrigin,
  }
}

function countKinds(pieces: Piece[]): Partial<Record<PieceKind, number>> {
  const result: Partial<Record<PieceKind, number>> = {}
  for (const piece of pieces) result[piece.kind] = (result[piece.kind] ?? 0) + 1
  return result
}

function authoredInventoryValue(variant: Variant, inventory: Partial<Record<PieceKind, number>>): number {
  return Object.entries(inventory).reduce((sum, [kind, count]) =>
    sum + (AUTHORED_VALUES[variant][kind as PieceKind] ?? 0) * (count ?? 0), 0)
}

function materialFor(state: GameState, side: Side): SideMaterialInsight {
  const board = countKinds(Object.values(state.board).filter((piece) => piece.side === side))
  const hand = { ...state.hands[side] }
  const boardValue = authoredInventoryValue(state.variant, board)
  const handValue = authoredInventoryValue(state.variant, hand)
  return {
    inventory: { evidence: 'exact', board, hand },
    value: {
      evidence: 'authored', scale: 'authored-centiunit-v1',
      board: boardValue, hand: handValue, total: boardValue + handValue,
    },
  }
}

function kingRing(state: GameState, side: Side, coordinate: string): string[] {
  const { x, y } = point(coordinate)
  const result: string[] = []
  if (state.variant === 'xiangqi') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = x + dx
      const ty = y + dy
      const inPalace = tx >= 3 && tx <= 5 && (side === 'first' ? ty >= 7 && ty <= 9 : ty >= 0 && ty <= 2)
      if (inPalace) result.push(square(tx, ty))
    }
  } else {
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
      if ((dx || dy) && inside(SHAPES[state.variant], x + dx, y + dy)) result.push(square(x + dx, y + dy))
    }
  }
  return result.sort()
}

function kingFor(
  state: GameState,
  candidates: Candidate[] | null,
  controls: Record<Side, Record<string, string[]>>,
  side: Side,
): KingInsight {
  const king = Object.entries(state.board).find(([, piece]) => piece.side === side && piece.kind === 'king')?.[0] ?? null
  const enemy = otherSide(side)
  const checkingOrigins = king ? controls[enemy][king] : []
  const ring = king ? kingRing(state, side, king) : []
  const hostileRingSquares = ring.filter((coordinate) => {
    if (state.variant !== 'xiangqi' || !king) return controls[enemy][coordinate].length > 0
    // Xiangqi king safety is position-dependent: moving the king can uncover
    // a flying-general line that does not control the target in the current
    // board. Recompute the enemy relation on that hypothetical king square.
    const board = { ...state.board }
    delete board[king]
    board[coordinate] = { side, kind: 'king' }
    return Object.entries(board).some(([origin, piece]) =>
      piece.side === enemy && xiangqiControlTargets(board, origin).includes(coordinate),
    )
  })
  const available = candidates !== null && state.status.phase === 'active' && state.actor === side
  const kingCandidates = available ? candidates.filter(({ action }) => action.piece === 'king') : []
  return {
    evidence: 'exact',
    side,
    square: king,
    inCheck: checkingOrigins.length > 0,
    checkingOrigins,
    ring,
    hostileRingSquares,
    hostileRingCount: hostileRingSquares.length,
    legalKingActionIds: available ? kingCandidates.map(({ id }) => id) : null,
    legalKingDestinations: available ? [...new Set(kingCandidates.map(({ action }) => action.to))].sort() : null,
    statusAgreement: state.actor === side ? state.status.inCheck === (checkingOrigins.length > 0) : null,
  }
}

function directionRays(state: GameState, origin: string, piece: Piece): Array<{ kind: LaneKind; dx: number; dy: number }> {
  const orthogonal = [
    { kind: 'orthogonal' as const, dx: 1, dy: 0 }, { kind: 'orthogonal' as const, dx: -1, dy: 0 },
    { kind: 'orthogonal' as const, dx: 0, dy: 1 }, { kind: 'orthogonal' as const, dx: 0, dy: -1 },
  ]
  const diagonal = [
    { kind: 'diagonal' as const, dx: 1, dy: 1 }, { kind: 'diagonal' as const, dx: 1, dy: -1 },
    { kind: 'diagonal' as const, dx: -1, dy: 1 }, { kind: 'diagonal' as const, dx: -1, dy: -1 },
  ]
  if (state.variant === 'chess') {
    if (piece.kind === 'queen') return [...orthogonal, ...diagonal]
    if (piece.kind === 'rook') return orthogonal
    if (piece.kind === 'bishop') return diagonal
  }
  if (state.variant === 'xiangqi') {
    if (piece.kind === 'rook') return orthogonal
    if (piece.kind === 'cannon') return orthogonal.map((ray) => ({ ...ray, kind: 'cannon-screen' as const }))
  }
  if (state.variant === 'shogi') {
    if (piece.kind === 'rook' || piece.kind === 'promoted-rook') return orthogonal
    if (piece.kind === 'bishop' || piece.kind === 'promoted-bishop') return diagonal
    if (piece.kind === 'lance') return [{ kind: 'forward-file', dx: 0, dy: piece.side === 'first' ? -1 : 1 }]
  }
  void origin
  return []
}

function lanesFor(
  state: GameState,
  squares: Record<string, SquareInsight>,
): LaneInsight[] {
  const result: LaneInsight[] = []
  for (const [origin, piece] of Object.entries(state.board)) {
    const start = point(origin)
    for (const ray of directionRays(state, origin, piece)) {
      const path: string[] = []
      let occupied = 0
      let screen: string | undefined
      let blocker: string | undefined
      for (
        let x = start.x + ray.dx, y = start.y + ray.dy;
        inside(SHAPES[state.variant], x, y);
        x += ray.dx, y += ray.dy
      ) {
        const coordinate = square(x, y)
        path.push(coordinate)
        if (state.board[coordinate]) {
          occupied += 1
          if (ray.kind === 'cannon-screen' && occupied === 1) screen = coordinate
          else {
            blocker = coordinate
            break
          }
          if (ray.kind !== 'cannon-screen') {
            blocker = coordinate
            break
          }
        }
      }
      const controlled = path.filter((coordinate) => squares[coordinate].control[piece.side].origins.includes(origin))
      if (path.length < 2 || controlled.length === 0) continue
      result.push({
        evidence: 'calculated', side: piece.side, piece: piece.kind, origin, kind: ray.kind,
        path, controlled, contested: controlled.filter((coordinate) => squares[coordinate].contested),
        ...(screen ? { screen } : {}), ...(blocker ? { blocker } : {}),
      })
    }
  }
  return result
}

function controlledSquares(controls: Record<Side, Record<string, string[]>>, side: Side, selection: string[]): string[] {
  return selection.filter((coordinate) => controls[side][coordinate]?.length > 0)
}

function conceptsFor(state: GameState, controls: Record<Side, Record<string, string[]>>): StrategicConcept[] {
  const result: StrategicConcept[] = []
  const all = coordinatesFor(state.variant)
  const center = all.filter((coordinate) => {
    const { x, y } = point(coordinate)
    const shape = SHAPES[state.variant]
    return Math.abs(x - (shape.files - 1) / 2) <= 1 && Math.abs(y - (shape.ranks - 1) / 2) <= 1
  })
  for (const side of SIDES) {
    if (state.variant === 'chess') {
      const core = ['d4', 'e4', 'd5', 'e5']
      const occupied = core.filter((coordinate) => state.board[coordinate]?.side === side)
      const controlled = controlledSquares(controls, side, core)
      const startingMinors = side === 'first' ? ['b8', 'c8', 'f8', 'g8'] : ['b1', 'c1', 'f1', 'g1']
      const undeveloped = startingMinors.filter((coordinate) => {
        const piece = state.board[coordinate]
        return piece?.side === side && (piece.kind === 'bishop' || piece.kind === 'knight')
      })
      const enemyHalf = all.filter((coordinate) => side === 'first' ? point(coordinate).y <= 3 : point(coordinate).y >= 4)
      result.push(
        { evidence: 'authored', id: 'chess.center-occupation', side, value: occupied.length, maximum: 4, squares: occupied },
        { evidence: 'authored', id: 'chess.center-control', side, value: controlled.length, maximum: 4, squares: controlled },
        { evidence: 'authored', id: 'chess.minor-development', side, value: 4 - undeveloped.length, maximum: 4, squares: startingMinors.filter((item) => !undeveloped.includes(item)) },
        { evidence: 'authored', id: 'chess.space-control', side, value: controlledSquares(controls, side, enemyHalf).length, maximum: enemyHalf.length, squares: controlledSquares(controls, side, enemyHalf) },
      )
    } else if (state.variant === 'xiangqi') {
      const crossed = Object.entries(state.board).filter(([coordinate, piece]) =>
        piece.side === side && piece.kind === 'pawn' && (side === 'first' ? point(coordinate).y <= 4 : point(coordinate).y >= 5),
      ).map(([coordinate]) => coordinate)
      const enemyPalace = all.filter((coordinate) => {
        const { x, y } = point(coordinate)
        return x >= 3 && x <= 5 && (side === 'first' ? y <= 2 : y >= 7)
      })
      const centralFile = all.filter((coordinate) => point(coordinate).x === 4)
      result.push(
        { evidence: 'authored', id: 'xiangqi.crossed-river-pawns', side, value: crossed.length, maximum: 5, squares: crossed },
        { evidence: 'authored', id: 'xiangqi.enemy-palace-control', side, value: controlledSquares(controls, side, enemyPalace).length, maximum: enemyPalace.length, squares: controlledSquares(controls, side, enemyPalace) },
        { evidence: 'authored', id: 'xiangqi.central-file-control', side, value: controlledSquares(controls, side, centralFile).length, maximum: centralFile.length, squares: controlledSquares(controls, side, centralFile) },
      )
    } else {
      const promotionZone = all.filter((coordinate) => side === 'first' ? point(coordinate).y <= 2 : point(coordinate).y >= 6)
      const present = promotionZone.filter((coordinate) => state.board[coordinate]?.side === side)
      const centralFiles = all.filter((coordinate) => Math.abs(point(coordinate).x - 4) <= 1)
      const handSquares = Object.entries(state.hands[side]).flatMap(([kind, count]) =>
        Array.from({ length: count ?? 0 }, (_, index) => `hand:${kind}:${index + 1}`),
      )
      result.push(
        { evidence: 'authored', id: 'shogi.promotion-zone-presence', side, value: present.length, maximum: 20, squares: present },
        { evidence: 'authored', id: 'shogi.enemy-camp-control', side, value: controlledSquares(controls, side, promotionZone).length, maximum: promotionZone.length, squares: controlledSquares(controls, side, promotionZone) },
        { evidence: 'authored', id: 'shogi.pieces-in-hand', side, value: handSquares.length, squares: handSquares },
        { evidence: 'authored', id: 'shogi.central-file-control', side, value: controlledSquares(controls, side, centralFiles).length, maximum: centralFiles.length, squares: controlledSquares(controls, side, centralFiles) },
      )
    }
  }
  void center
  return result
}

function inspectPositionWithCandidates(state: GameState, candidates: Candidate[] | null): PositionInsight {
  const token = stateToken(state)
  const controls = controlMap(state)
  const squares: Record<string, SquareInsight> = {}
  for (const coordinate of coordinatesFor(state.variant)) {
    const first = controls.first[coordinate] ?? []
    const second = controls.second[coordinate] ?? []
    const piece = state.board[coordinate]
    let occupant: PieceInsight | undefined
    if (piece) {
      const attackedBy = controls[otherSide(piece.side)][coordinate] ?? []
      const defendedBy = controls[piece.side][coordinate] ?? []
      const contact: PieceContact = piece.kind === 'king'
        ? 'king'
        : attackedBy.length > 0
          ? defendedBy.length > 0 ? 'attacked-defended' : 'attacked-undefended'
          : defendedBy.length > 0 ? 'defended-only' : 'uncontacted'
      occupant = { coordinate, piece: { ...piece }, evidence: 'exact', attackedBy, defendedBy, contact }
    }
    squares[coordinate] = {
      coordinate,
      control: {
        first: { evidence: 'exact', count: first.length, origins: first },
        second: { evidence: 'exact', count: second.length, origins: second },
      },
      contested: first.length > 0 && second.length > 0,
      ...(occupant ? { occupant } : {}),
    }
  }
  return {
    binding: {
      schemaVersion: INSIGHT_SCHEMA_VERSION, stateToken: token, ruleset: state.ruleset,
      variant: state.variant, actor: state.actor, ply: state.ply,
    },
    provenance: {
      squareControl: 'exact', pieceContacts: 'exact', legalMobility: 'exact', materialInventory: 'exact',
      materialValues: 'authored', kingSafety: 'exact', lanes: 'calculated', strategicConcepts: 'authored',
    },
    squares,
    mobility: {
      first: mobilityFor(state, candidates, 'first'),
      second: mobilityFor(state, candidates, 'second'),
    },
    material: { first: materialFor(state, 'first'), second: materialFor(state, 'second') },
    kings: {
      first: kingFor(state, candidates, controls, 'first'),
      second: kingFor(state, candidates, controls, 'second'),
    },
    lanes: lanesFor(state, squares),
    concepts: conceptsFor(state, controls),
  }
}

export function inspectPosition(state: GameState): PositionInsight {
  return inspectPositionWithCandidates(state, legalActions(state))
}

function inspectPositionForRanking(state: GameState): PositionInsight {
  return inspectPositionWithCandidates(state, null)
}

function capturedPiece(before: GameState, after: GameState, mover: Side): ExactCapture | null {
  const enemy = otherSide(mover)
  for (const [coordinate, piece] of Object.entries(before.board)) {
    if (piece.side !== enemy) continue
    const remaining = after.board[coordinate]
    if (!remaining || remaining.side !== enemy || remaining.kind !== piece.kind) {
      return {
        evidence: 'exact', coordinate, piece: { ...piece },
        ...(before.variant === 'shogi' ? { transferredToHand: demote(piece.kind) } : {}),
      }
    }
  }
  return null
}

function originsReach(squares: Record<string, SquareInsight>, side: Side, origin: string): number {
  return Object.values(squares).filter((item) => item.control[side].origins.includes(origin)).length
}

function sideControlDelta(before: PositionInsight, after: PositionInsight, side: Side): SideControlDelta {
  const coordinates = Object.keys(before.squares)
  return {
    gained: coordinates.filter((item) => before.squares[item].control[side].count === 0 && after.squares[item].control[side].count > 0),
    lost: coordinates.filter((item) => before.squares[item].control[side].count > 0 && after.squares[item].control[side].count === 0),
    strengthened: coordinates.filter((item) => after.squares[item].control[side].count > before.squares[item].control[side].count),
    weakened: coordinates.filter((item) => after.squares[item].control[side].count < before.squares[item].control[side].count),
  }
}

function samePiece(left: PieceInsight | undefined, right: PieceInsight | undefined): boolean {
  return Boolean(left && right && left.piece.side === right.piece.side && left.piece.kind === right.piece.kind)
}

function stationaryPieceChanges(before: PositionInsight, after: PositionInsight): Array<{ before: PieceInsight; after: PieceInsight }> {
  const result: Array<{ before: PieceInsight; after: PieceInsight }> = []
  for (const coordinate of Object.keys(before.squares)) {
    const left = before.squares[coordinate].occupant
    const right = after.squares[coordinate].occupant
    if (samePiece(left, right)) result.push({ before: left!, after: right! })
  }
  return result
}

function pieceRef(piece: PieceInsight): PieceDeltaRef {
  return { coordinate: piece.coordinate, piece: { ...piece.piece } }
}

function attacked(piece: PieceInsight): boolean {
  return piece.attackedBy.length > 0
}

function loose(piece: PieceInsight): boolean {
  return piece.contact === 'attacked-undefended'
}

function candidateDelta(
  state: GameState,
  candidate: Candidate,
  before: PositionInsight,
  after: PositionInsight,
): CandidateDelta {
  const coordinates = Object.keys(before.squares)
  const changes = stationaryPieceChanges(before, after)
  const movedBefore = candidate.action.from ? before.squares[candidate.action.from]?.occupant : undefined
  const movedAfter = after.squares[candidate.action.to]?.occupant
  if (movedBefore && movedAfter && movedBefore.piece.side === movedAfter.piece.side) changes.push({ before: movedBefore, after: movedAfter })
  const unique = (items: PieceDeltaRef[]) => [...new Map(items.map((item) => [`${item.piece.side}:${item.coordinate}:${item.piece.kind}`, item])).values()]
  const piecesNewlyAttacked = unique(changes.filter((item) => !attacked(item.before) && attacked(item.after)).map((item) => pieceRef(item.after)))
  const piecesRescued = unique(changes.filter((item) => attacked(item.before) && !attacked(item.after)).map((item) => pieceRef(item.after)))
  const piecesNewlyLoose = unique(changes.filter((item) => !loose(item.before) && loose(item.after)).map((item) => pieceRef(item.after)))
  const piecesNoLongerLoose = unique(changes.filter((item) => loose(item.before) && !loose(item.after)).map((item) => pieceRef(item.after)))
  const beforeReach = candidate.action.from ? originsReach(before.squares, state.actor, candidate.action.from) : 0
  const afterReach = originsReach(after.squares, state.actor, candidate.action.to)
  return {
    evidence: 'calculated',
    control: { first: sideControlDelta(before, after, 'first'), second: sideControlDelta(before, after, 'second') },
    newlyContested: coordinates.filter((item) => !before.squares[item].contested && after.squares[item].contested),
    noLongerContested: coordinates.filter((item) => before.squares[item].contested && !after.squares[item].contested),
    piecesNewlyAttacked,
    piecesRescued,
    piecesNewlyAttackedUndefended: piecesNewlyLoose,
    piecesNoLongerAttackedUndefended: piecesNoLongerLoose,
    movingPieceControlBefore: beforeReach,
    movingPieceControlAfter: afterReach,
    movingPieceControlDelta: afterReach - beforeReach,
    actorLegalActionsBefore: before.mobility[state.actor].legalActionCount ?? 0,
    opponentLegalRepliesAfter: after.mobility[otherSide(state.actor)].legalActionCount ?? 0,
    kingDangerDelta: {
      first: after.kings.first.hostileRingCount - before.kings.first.hostileRingCount,
      second: after.kings.second.hostileRingCount - before.kings.second.hostileRingCount,
    },
  }
}

function authoredPieceValue(variant: Variant, kind: PieceKind): number {
  return AUTHORED_VALUES[variant][kind] ?? 0
}

function exchangeFor(state: GameState, candidate: Candidate, after: PositionInsight, capture: ExactCapture | null): ExchangeOutlook {
  const actor = state.actor
  const destination = after.squares[candidate.action.to]
  const immediateGain = capture ? authoredPieceValue(state.variant, capture.piece.kind) : 0
  const movingPieceValue = authoredPieceValue(state.variant, after.squares[candidate.action.to]?.occupant?.piece.kind ?? candidate.action.piece)
  const destinationAttackers = destination?.control[otherSide(actor)].count ?? 0
  const destinationDefenders = destination?.control[actor].count ?? 0
  const netIfMovingPieceLost = immediateGain - movingPieceValue
  let kind: ExchangeOutlookKind = 'quiet'
  if (capture && destinationAttackers === 0) kind = 'unanswered-gain'
  else if (capture && netIfMovingPieceLost > 75) kind = 'favorable-if-recaptured'
  else if (capture && netIfMovingPieceLost >= -75) kind = 'even-if-recaptured'
  else if (capture) kind = 'costly-if-recaptured'
  else if (destinationAttackers > 0 && destinationDefenders === 0) kind = 'exposed-mover'
  return {
    evidence: 'calculated', kind, authoredScale: 'authored-centiunit-v1', immediateGain, movingPieceValue,
    netIfMovingPieceLost, destinationAttackers, destinationDefenders, horizon: 'contact-only-no-search',
  }
}

function threatsFor(state: GameState, before: PositionInsight, after: PositionInsight, givesCheck: boolean): CandidateThreats {
  const enemy = otherSide(state.actor)
  const attackedAfter = Object.values(after.squares)
    .flatMap(({ occupant }) => occupant && occupant.piece.side === enemy && occupant.attackedBy.length > 0 ? [pieceRef(occupant)] : [])
  const attackedBefore = new Set(Object.values(before.squares)
    .flatMap(({ occupant }) => occupant && occupant.piece.side === enemy && occupant.attackedBy.length > 0
      ? [`${occupant.coordinate}:${occupant.piece.kind}`]
      : []))
  return {
    evidence: 'calculated',
    relation: 'rule-control-not-legal-capture-forecast',
    attackedEnemyPiecesAfter: attackedAfter,
    newlyAttackedEnemyPieces: attackedAfter.filter((item) => !attackedBefore.has(`${item.coordinate}:${item.piece.kind}`)),
    givesCheck,
  }
}

function replySamples(state: GameState, maximum: number): ForcingReplySample[] {
  if (maximum === 0 || state.status.phase === 'complete') return []
  const replies = legalActions(state).flatMap((candidate) => {
    // Shogi can expose hundreds of legal drops. These candidates are already
    // canonical, so avoid re-enumerating all legality for every reply merely
    // to calculate exact capture/check ordering.
    const after = state.variant === 'shogi'
      ? projectShogiActionForInsight(state, candidate.action)
      : previewCandidate(state, candidate)
    if (!after) return []
    const capture = capturedPiece(state, after, candidate.actor)
    const givesCheck = after.status.inCheck
    const reasons: ReplyReason[] = []
    if (givesCheck) reasons.push('check')
    if (capture) reasons.push('capture')
    if (candidate.action.promote || candidate.action.promotion) reasons.push('promotion')
    if (candidate.action.kind === 'drop') reasons.push('drop')
    if (reasons.length === 0) reasons.push('legal-sample')
    const orderingScore = (givesCheck ? 100_000 : 0)
      + (capture ? authoredPieceValue(state.variant, capture.piece.kind) * 10 : 0)
      + (candidate.action.promote || candidate.action.promotion ? 1_000 : 0)
      + (candidate.action.kind === 'drop' ? 10 : 0)
    return [{ candidate, capture, givesCheck, reasons, orderingScore }]
  })
  replies.sort((left, right) => right.orderingScore - left.orderingScore || left.candidate.notation.localeCompare(right.candidate.notation) || left.candidate.id.localeCompare(right.candidate.id))
  return replies.slice(0, maximum).map((item, index) => ({
    evidence: 'calculated', rank: index + 1, candidateId: item.candidate.id,
    stateToken: item.candidate.stateToken, actor: item.candidate.actor, action: { ...item.candidate.action },
    notation: item.candidate.notation, reasons: item.reasons, capture: item.capture, givesCheck: item.givesCheck,
    orderingScore: item.orderingScore, orderingMethod: 'forcing-features-v1-not-engine-ranking',
  }))
}

function planIdsFor(state: GameState, candidate: Candidate, facts: CandidateFacts, delta: CandidateDelta): PlanId[] {
  const plans: PlanId[] = []
  if (facts.capture) plans.push('plan.win-material')
  if (facts.givesCheck) plans.push('plan.force-king-response')
  if (candidate.action.piece !== 'king' && delta.movingPieceControlDelta > 1) plans.push('plan.improve-control')
  if (delta.kingDangerDelta[state.actor] < 0) plans.push('plan.reduce-king-danger')
  const to = point(candidate.action.to)
  if (state.variant === 'chess') {
    const firstMinorStarts = ['b8', 'c8', 'f8', 'g8']
    const secondMinorStarts = ['b1', 'c1', 'f1', 'g1']
    const starts = state.actor === 'first' ? firstMinorStarts : secondMinorStarts
    if (candidate.action.from && starts.includes(candidate.action.from) && ['bishop', 'knight'].includes(candidate.action.piece)) plans.push('chess.plan.develop-minor')
    if (['d4', 'e4', 'd5', 'e5'].includes(candidate.action.to)) plans.push('chess.plan.contest-center')
  } else if (state.variant === 'xiangqi') {
    const fromY = candidate.action.from ? point(candidate.action.from).y : to.y
    const crossed = state.actor === 'first' ? fromY >= 5 && to.y <= 4 : fromY <= 4 && to.y >= 5
    if (candidate.action.piece === 'pawn' && crossed) plans.push('xiangqi.plan.cross-river')
    if (candidate.action.piece === 'cannon') plans.push('xiangqi.plan.use-cannon-screen')
    const inEnemyPalace = to.x >= 3 && to.x <= 5 && (state.actor === 'first' ? to.y <= 2 : to.y >= 7)
    if (inEnemyPalace || facts.givesCheck) plans.push('xiangqi.plan.press-palace')
  } else {
    const bishop = state.actor === 'first' ? 'b8' : 'h2'
    const diagonalPawn = state.actor === 'first' ? 'c7' : 'g3'
    if (
      state.ply <= 1
      && candidate.action.piece === 'pawn'
      && candidate.action.from === diagonalPawn
      && state.board[bishop]?.side === state.actor
      && state.board[bishop]?.kind === 'bishop'
    ) plans.push('shogi.plan.open-bishop-diagonal')
    if (candidate.action.kind === 'drop') plans.push('shogi.plan.use-hand')
    const enters = state.actor === 'first' ? to.y <= 2 : to.y >= 6
    if (enters || facts.promotion) plans.push('shogi.plan.enter-promotion-zone')
    if (facts.givesCheck || enters) plans.push('shogi.plan.press-camp')
  }
  return [...new Set(plans)]
}

export function inspectCandidate(
  state: GameState,
  supplied: Candidate,
  options: InspectCandidateOptions = {},
): CandidateInsightResult {
  const token = stateToken(state)
  if (supplied.stateToken !== token) return { ok: false, reason: 'stale-candidate' }
  if (supplied.actor !== state.actor) return { ok: false, reason: 'wrong-actor' }
  const candidate = legalActions(state).find(({ id }) => id === supplied.id)
  if (!candidate) return { ok: false, reason: 'unknown-candidate' }
  const before = inspectPosition(state)
  const maximum = Math.max(0, Math.min(5, Math.trunc(options.maxReplies ?? 3)))
  const insight = candidateInsightFromCanonical(state, candidate, before, maximum)
  return insight ? { ok: true, insight } : { ok: false, reason: 'preview-failed' }
}

function candidateInsightFromCanonical(
  state: GameState,
  candidate: Candidate,
  before: PositionInsight,
  maximumReplies: number,
  mode: 'full' | 'ranking' = 'full',
): CandidateInsight | null {
  const next = mode === 'ranking' && state.variant === 'shogi'
    ? projectShogiActionForInsight(state, candidate.action)
    : previewCandidate(state, candidate)
  if (!next) return null
  const after = mode === 'ranking' ? inspectPositionForRanking(next) : inspectPosition(next)
  const capture = capturedPiece(state, next, state.actor)
  const facts: CandidateFacts = {
    evidence: 'exact', from: candidate.action.from ?? null, to: candidate.action.to,
    movedPiece: candidate.action.piece, drop: candidate.action.kind === 'drop',
    promotion: candidate.action.promotion ?? (candidate.action.promote ? true : null), capture,
    givesCheck: next.status.inCheck, endsGame: mode === 'full' && next.status.phase === 'complete',
  }
  const delta = candidateDelta(state, candidate, before, after)
  return {
    binding: { ...before.binding, candidateId: candidate.id, candidateStateToken: candidate.stateToken },
    candidate,
    before,
    after,
    facts,
    delta,
    threats: threatsFor(state, before, after, facts.givesCheck),
    exchange: exchangeFor(state, candidate, after, capture),
    forcingReplies: mode === 'full' ? replySamples(next, maximumReplies) : [],
    planIds: planIdsFor(state, candidate, facts, delta),
  }
}

const PLAN_WEIGHTS: Partial<Record<PlanId, number>> = {
  'plan.win-material': 100,
  'plan.force-king-response': 400,
  'plan.improve-control': 90,
  'plan.reduce-king-danger': 350,
  'chess.plan.develop-minor': 180,
  'chess.plan.contest-center': 130,
  'xiangqi.plan.cross-river': 140,
  'xiangqi.plan.press-palace': 180,
  'xiangqi.plan.use-cannon-screen': 80,
  'shogi.plan.enter-promotion-zone': 170,
  'shogi.plan.open-bishop-diagonal': 260,
  'shogi.plan.use-hand': 80,
  'shogi.plan.press-camp': 140,
}

function rankingFor(
  state: GameState,
  candidate: Candidate,
  before: PositionInsight,
): RankedCandidateInsight | null {
  const insight = candidateInsightFromCanonical(state, candidate, before, 0, 'ranking')
  if (!insight) return null
  const actor = state.actor
  const enemy = otherSide(actor)
  const factors: CandidateRankingFactor[] = []
  const add = (id: RankingFactorId, contribution: number) => {
    if (contribution) factors.push({ id, contribution })
  }
  add('forcing-check', insight.facts.givesCheck ? 800 : 0)
  const exchangeWeight: Record<ExchangeOutlookKind, number> = {
    quiet: 0,
    'unanswered-gain': insight.exchange.immediateGain,
    'favorable-if-recaptured': Math.max(100, insight.exchange.netIfMovingPieceLost),
    'even-if-recaptured': 30,
    'costly-if-recaptured': Math.min(-100, insight.exchange.netIfMovingPieceLost),
    'exposed-mover': -Math.max(100, Math.round(insight.exchange.movingPieceValue / 2)),
  }
  add('capture-outlook', exchangeWeight[insight.exchange.kind])
  add('promotion', insight.facts.promotion ? 220 : 0)
  const ownRingDelta = insight.delta.kingDangerDelta[actor]
  add('reduce-own-king-ring', ownRingDelta < 0 ? -ownRingDelta * 160 : 0)
  add('increase-own-king-ring', ownRingDelta > 0 ? -ownRingDelta * 200 : 0)
  const rescuedValue = insight.delta.piecesRescued
    .filter((item) => item.piece.side === actor)
    .reduce((sum, item) => sum + authoredPieceValue(state.variant, item.piece.kind), 0)
  add('rescue-piece', Math.round(rescuedValue / 3))
  const exposedValue = insight.delta.piecesNewlyAttackedUndefended
    .filter((item) => item.piece.side === actor)
    .reduce((sum, item) => sum + authoredPieceValue(state.variant, item.piece.kind), 0)
  add('leave-piece-attacked-undefended', -Math.round(exposedValue / 2))
  const targetsValue = insight.delta.piecesNewlyAttackedUndefended
    .filter((item) => item.piece.side === enemy)
    .reduce((sum, item) => sum + authoredPieceValue(state.variant, item.piece.kind), 0)
  add('create-attacked-undefended-target', Math.round(targetsValue / 4))
  const actorControl = insight.delta.control[actor]
  add('net-control', candidate.action.piece === 'king'
    ? 0
    : (actorControl.gained.length - actorControl.lost.length) * 12 + insight.delta.movingPieceControlDelta * 5)
  for (const planId of insight.planIds) add(planId, PLAN_WEIGHTS[planId] ?? 0)
  return {
    evidence: 'authored', candidate: insight.candidate,
    score: factors.reduce((sum, factor) => sum + factor.contribution, 0),
    method: 'variant-native-teaching-order-v1-not-engine-ranking', factors,
  }
}

/**
 * A transparent teaching order built from the bounded evidence above. It is
 * intentionally authored—not an engine evaluation and never called a best
 * move. Legal candidates remain the authority and deterministic notation/id
 * order resolves equal teaching scores.
 */
export function rankCandidateInsights(state: GameState, candidates = legalActions(state)): RankedCandidateInsight[] {
  const token = stateToken(state)
  const canonical = new Map(legalActions(state).map((candidate) => [candidate.id, candidate]))
  const before = inspectPosition(state)
  return candidates
    .map((supplied) => {
      if (supplied.stateToken !== token || supplied.actor !== state.actor) return null
      const candidate = canonical.get(supplied.id)
      return candidate ? rankingFor(state, candidate, before) : null
    })
    .filter((item): item is RankedCandidateInsight => Boolean(item))
    .sort((left, right) => right.score - left.score
      || left.candidate.notation.localeCompare(right.candidate.notation)
      || left.candidate.id.localeCompare(right.candidate.id))
}

export function rankCandidatesByInsight(state: GameState, candidates = legalActions(state)): Candidate[] {
  return rankCandidateInsights(state, candidates).map(({ candidate }) => candidate)
}

export const insightEvidenceKinds = {
  exact: 'exact',
  calculated: 'calculated',
  authored: 'authored',
} as const satisfies Partial<Record<Evidence, Evidence>>
