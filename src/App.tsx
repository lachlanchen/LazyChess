import { useEffect, useMemo, useState } from 'react'
import { applyAction, legalActions, previewCandidate } from './domain/adapter'
import { variantConfig, variants } from './domain/config'
import { displayCoordinate, point, square } from './domain/coordinates'
import {
  inspectCandidate,
  inspectPosition,
  primaryPositiveFactor,
  rankCandidateInsights,
  type CandidateInsight,
  type PositionInsight,
  type RankedCandidateInsight,
} from './domain/insight'
import {
  createSession,
  commitStore,
  loadStore,
  readStore,
  STORAGE_KEY,
  selectSession,
  updateSession,
  type SessionStore,
} from './domain/persistence'
import { teachingFacets } from './domain/teaching'
import type { Candidate, GameState, Locale, Piece, PieceKind, Side, Variant } from './domain/types'
import {
  engineLineForCandidate,
  requestEngineAnalysis,
  type EngineAnalysis,
  type EnginePrincipalVariation,
} from './engine/analysis'
import { isSupportedLocale, localeOptions, sideName, translate } from './i18n'

const LOCALE_KEY = 'three-boards.locale.v1'

function requestId(): string {
  return crypto.randomUUID()
}

function currentLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY)
  return isSupportedLocale(stored) ? stored : 'en'
}

const chessGlyphs: Record<Side, Partial<Record<PieceKind, string>>> = {
  first: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  second: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
}

const xiangqiGlyphs: Record<Side, Partial<Record<PieceKind, string>>> = {
  first: { king: '帥', advisor: '仕', elephant: '相', knight: '傌', rook: '俥', cannon: '炮', pawn: '兵' },
  second: { king: '將', advisor: '士', elephant: '象', knight: '馬', rook: '車', cannon: '砲', pawn: '卒' },
}

const shogiGlyphs: Partial<Record<PieceKind, string>> = {
  king: '玉', rook: '飛', bishop: '角', gold: '金', silver: '銀', knight: '桂', lance: '香', pawn: '歩',
  'promoted-rook': '竜', 'promoted-bishop': '馬', 'promoted-silver': '全', 'promoted-knight': '圭',
  'promoted-lance': '杏', 'promoted-pawn': 'と',
}

function glyph(variant: Variant, piece: Piece): string {
  if (variant === 'chess') return chessGlyphs[piece.side][piece.kind] ?? '?'
  if (variant === 'xiangqi') return xiangqiGlyphs[piece.side][piece.kind] ?? '?'
  return shogiGlyphs[piece.kind] ?? '?'
}

type VisualLayer = 'control' | 'safety' | 'lanes' | 'king'

const visualLayers: Array<{ id: VisualLayer; icon: string }> = [
  { id: 'control', icon: '◉' },
  { id: 'safety', icon: '◇' },
  { id: 'lanes', icon: '↗' },
  { id: 'king', icon: '♔' },
]

function opposite(side: Side): Side {
  return side === 'first' ? 'second' : 'first'
}

function countControlled(position: PositionInsight, side: Side): number {
  return Object.values(position.squares).filter((item) => item.control[side].count > 0).length
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function engineEvaluation(locale: Locale, line: EnginePrincipalVariation): string {
  const value = line.score.kind === 'mate'
    ? translate(locale, 'engine.mate', { moves: signed(line.score.moves) })
    : translate(locale, 'engine.evaluation', {
        score: new Intl.NumberFormat(locale, {
          signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(line.score.value / 100),
      })
  return line.score.bound === 'exact'
    ? value
    : `${value} · ${translate(locale, `engine.bound.${line.score.bound}`)}`
}

function rankingFactorKey(id: string): string {
  return id === 'plan.win-material' || id === 'plan.force-king-response'
    || id === 'plan.improve-control' || id === 'plan.reduce-king-danger'
    || id.startsWith('chess.plan.') || id.startsWith('xiangqi.plan.') || id.startsWith('shogi.plan.')
    ? id
    : `rank.${id}`
}

interface PositionMapProps {
  state: GameState
  position: PositionInsight
  candidate: CandidateInsight | null
  engineLine: EnginePrincipalVariation | null
  previewSource: 'suggested' | 'hover' | 'selected' | null
  layer: VisualLayer
  locale: Locale
  onLayer: (layer: VisualLayer) => void
  onClear: () => void
}

function PositionMap({ state, position, candidate, engineLine, previewSource, layer, locale, onLayer, onClear }: PositionMapProps) {
  const actor = state.actor
  const opponent = opposite(actor)
  const shown = candidate?.after ?? position
  const actorControl = countControlled(shown, actor)
  const opponentControl = countControlled(shown, opponent)
  const loosePieces = Object.values(shown.squares).filter((item) =>
    item.occupant?.piece.side === actor && item.occupant.contact === 'attacked-undefended',
  ).length
  const controlValue = candidate
    ? `+${candidate.delta.control[actor].gained.length} / −${candidate.delta.control[actor].lost.length}`
    : `${actorControl} / ${opponentControl}`
  const mobilityValue = candidate
    ? String(candidate.delta.opponentLegalRepliesAfter)
    : String(position.mobility[actor].legalActionCount ?? '—')
  const kingDangerChange = candidate?.delta.kingDangerDelta[actor] ?? 0
  const kingValue = candidate
    ? translate(locale, kingDangerChange < 0
        ? 'map.kingDelta.safer'
        : kingDangerChange > 0
          ? 'map.kingDelta.exposed'
          : 'map.kingDelta.same', { count: Math.abs(kingDangerChange) })
    : String(position.kings[actor].hostileRingCount)
  const exchangeValue = candidate
    ? translate(locale, `map.exchange.${candidate.exchange.kind}`)
    : String(loosePieces)
  const mode = previewSource ?? 'current'
  const evidenceForDelta = candidate ? 'calculated' : 'exact'
  const legendKeys = layer === 'control'
    ? ['actorControl', 'opponentControl', 'contested']
    : layer === 'safety'
      ? ['defended', 'attackedDefended', 'loose']
      : layer === 'lanes'
        ? ['actorLane', 'opponentLane', ...(state.variant === 'xiangqi' ? ['cannonScreen'] : [])]
        : ['actorKing', 'opponentKing', 'hostileRing']
  const newThreats = candidate?.threats.newlyAttackedEnemyPieces.length ?? 0
  const isMate = Boolean(candidate?.facts.endsGame && candidate.threats.givesCheck)
  const visiblePlanIds = candidate?.planIds.filter((id) => !isMate || id !== 'plan.force-king-response') ?? []
  return (
    <section
      className="position-map"
      data-testid="position-map"
      data-mode={mode}
      data-ply={state.ply}
      aria-labelledby="position-map-title"
    >
      <div className="position-map-head">
        <div>
          <span className="kicker">{translate(locale, `map.mode.${mode}`)}</span>
          <h2 id="position-map-title">{translate(locale, 'map.title')}</h2>
        </div>
        {engineLine && (
          <span className="map-engine-chip" data-testid="candidate-engine-evidence">
            {translate(locale, 'engine.rank', { rank: engineLine.rank })} · {engineEvaluation(locale, engineLine)} · {translate(locale, 'engine.depth', { depth: engineLine.depth })}
          </span>
        )}
        {previewSource && (
          <button type="button" className="map-clear" data-testid="clear-position-map" onClick={onClear}>
            <span aria-hidden="true">×</span>{translate(locale, 'action.clear')}
          </button>
        )}
        <div className="map-layers" role="toolbar" aria-label={translate(locale, 'map.layers')}>
          {visualLayers.map((item) => (
            <button
              type="button"
              key={item.id}
              className={layer === item.id ? 'is-active' : ''}
              aria-pressed={layer === item.id}
              aria-label={translate(locale, `map.layer.${item.id}`)}
              data-testid={`layer-${item.id}`}
              onClick={() => onLayer(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <small>{translate(locale, `map.layer.${item.id}`)}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="map-legend" data-testid={`legend-${layer}`}>
        {legendKeys.map((key, index) => (
          <span key={key}>
            <i className={`legend-swatch legend-${layer}-${index}`} aria-hidden="true" />
            {translate(locale, `map.legend.${key}`)}
          </span>
        ))}
      </div>
      <div className="map-metrics" data-testid="preview-summary" data-candidate-id={candidate?.candidate.id}>
        <article data-testid="metric-control">
          <span>{translate(locale, candidate ? 'map.metric.controlDelta' : 'map.metric.controlCurrent')}</span>
          <strong>{controlValue}</strong>
          <small>{translate(locale, `evidence.${evidenceForDelta}`)}</small>
        </article>
        <article data-testid="metric-mobility">
          <span>{translate(locale, candidate ? 'map.metric.replies' : 'map.metric.mobility')}</span>
          <strong>{mobilityValue}</strong>
          <small>{translate(locale, 'evidence.exact')}</small>
        </article>
        <article data-testid="metric-king">
          <span>{translate(locale, candidate ? 'map.metric.kingDelta' : 'map.metric.kingCurrent')}</span>
          <strong>{kingValue}</strong>
          <small>{translate(locale, `evidence.${evidenceForDelta}`)}</small>
        </article>
        <article data-testid="metric-exchange">
          <span>{translate(locale, candidate ? 'map.metric.exchange' : 'map.metric.loose')}</span>
          <strong>{exchangeValue}</strong>
          <small>{translate(locale, candidate ? 'map.exchange.basis' : 'evidence.exact')}</small>
        </article>
      </div>
      {candidate && (
        <div className="map-teaching" data-testid="analysis-provenance">
          {(!isMate || visiblePlanIds.length > 0) && (
            <div className="plan-strip">
              <span>{translate(locale, 'map.plan')}</span>
              {visiblePlanIds.length > 0
                ? visiblePlanIds.map((id) => <strong key={id}>{translate(locale, id)}</strong>)
                : <strong>{translate(locale, 'map.plan.scan')}</strong>}
              <small>{translate(locale, 'evidence.authored')}</small>
            </div>
          )}
          <div className="reply-strip">
            <span>{translate(locale, 'map.replies')}</span>
            {candidate.forcingReplies.length > 0
              ? candidate.forcingReplies.slice(0, 2).map((reply) => <strong key={reply.candidateId}>{reply.notation}</strong>)
              : <strong>—</strong>}
            <small>{translate(locale, 'evidence.calculated')}</small>
          </div>
          <div className="threat-strip">
            <span>{translate(locale, 'map.threats')}</span>
            <strong>{isMate
              ? translate(locale, 'map.threat.mate')
              : candidate.threats.givesCheck
                ? translate(locale, 'map.threat.check')
                : newThreats > 0
                  ? translate(locale, 'map.threat.count', { count: newThreats })
                  : translate(locale, 'map.threat.none')}</strong>
            <small>{translate(locale, 'map.threat.caveat')}</small>
          </div>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {candidate ? `${candidate.candidate.notation}. ` : ''}
        {translate(locale, candidate ? 'map.metric.controlDelta' : 'map.metric.controlCurrent')}: {controlValue}. {translate(locale, candidate ? 'map.metric.kingDelta' : 'map.metric.kingCurrent')}: {kingValue}.
      </p>
    </section>
  )
}

interface BoardProps {
  state: GameState
  shownState: GameState
  candidates: Candidate[]
  preview: Candidate | null
  selectedOrigin: string | null
  selectedDrop: PieceKind | null
  locale: Locale
  onOrigin: (origin: string | null) => void
  onDrop: (kind: PieceKind | null) => void
  onChoose: (candidate: Candidate) => void
  clear: () => void
  previewSource: 'suggested' | 'hover' | 'selected' | null
  positionInsight: PositionInsight
  candidateInsight: CandidateInsight | null
  visualLayer: VisualLayer
}

function Board({
  state,
  shownState,
  candidates,
  preview,
  selectedOrigin,
  selectedDrop,
  locale,
  onOrigin,
  onDrop,
  onChoose,
  clear,
  previewSource,
  positionInsight,
  candidateInsight,
  visualLayer,
}: BoardProps) {
  const config = variantConfig(state.variant)
  const destinationIds = new Set(
    candidates
      .filter((candidate) => candidate.action.from === selectedOrigin || (selectedDrop && candidate.action.kind === 'drop' && candidate.action.piece === selectedDrop))
      .map((candidate) => candidate.action.to),
  )
  const cells = []
  for (let y = 0; y < config.shape.ranks; y += 1) {
    for (let x = 0; x < config.shape.files; x += 1) {
      const coordinate = square(x, y)
      const authoritativePiece = state.board[coordinate]
      const shownPiece = shownState.board[coordinate]
      const isDestination = destinationIds.has(coordinate)
      const isPreviewFrom = preview?.action.from === coordinate
      const isPreviewTo = preview?.action.to === coordinate
      const movedAway = isPreviewFrom && !shownPiece
      const insight = positionInsight.squares[coordinate]
      const actorControl = insight.control[state.actor].count
      const opponentControl = insight.control[opposite(state.actor)].count
      const actorDelta = candidateInsight?.delta.control[state.actor]
      const controlDelta = actorDelta?.gained.includes(coordinate)
        ? 'gained'
        : actorDelta?.lost.includes(coordinate)
          ? 'lost'
          : actorDelta?.strengthened.includes(coordinate)
            ? 'strengthened'
            : actorDelta?.weakened.includes(coordinate)
              ? 'weakened'
              : null
      const occupantContact = insight.occupant?.contact ?? null
      const pieceDelta = candidateInsight?.delta.piecesNewlyAttackedUndefended.some((item) => item.coordinate === coordinate)
        ? 'newly-loose'
        : candidateInsight?.delta.piecesRescued.some((item) => item.coordinate === coordinate)
          ? 'rescued'
          : candidateInsight?.delta.piecesNewlyAttacked.some((item) => item.coordinate === coordinate)
            ? 'newly-attacked'
            : null
      const actorKing = positionInsight.kings[state.actor]
      const opponentKing = positionInsight.kings[opposite(state.actor)]
      const actorKingZone = actorKing.square === coordinate || actorKing.ring.includes(coordinate)
      const opponentKingZone = opponentKing.square === coordinate || opponentKing.ring.includes(coordinate)
      const hostileKingSquare = actorKing.hostileRingSquares.includes(coordinate) || opponentKing.hostileRingSquares.includes(coordinate)
      const kingEscape = actorKing.legalKingDestinations?.includes(coordinate) || opponentKing.legalKingDestinations?.includes(coordinate)
      const laneScreen = positionInsight.lanes.some((lane) => lane.screen === coordinate)
      const lanesHere = positionInsight.lanes.filter((lane) =>
        lane.origin === coordinate || lane.path.includes(coordinate),
      )
      const actorLanes = lanesHere.filter((lane) => lane.side === state.actor).length
      const opponentLanes = lanesHere.length - actorLanes
      const captureTarget = candidateInsight?.facts.capture?.coordinate === coordinate
      const shogiZone = state.variant === 'shogi'
        ? point(coordinate).y <= 2 ? 'first-camp' : point(coordinate).y >= 6 ? 'second-camp' : null
        : null
      const labelCoordinate = displayCoordinate(state.variant, coordinate)
      const title = shownPiece
        ? `${sideName(locale, state.variant, shownPiece.side)} ${translate(locale, `piece.${shownPiece.kind}`)} · ${labelCoordinate}`
        : labelCoordinate
      const layerDescriptions: string[] = []
      if (visualLayer === 'control' && (actorControl > 0 || opponentControl > 0)) {
        layerDescriptions.push(translate(locale, 'map.a11y.control', {
          actor: sideName(locale, state.variant, state.actor),
          actorCount: actorControl,
          opponent: sideName(locale, state.variant, opposite(state.actor)),
          opponentCount: opponentControl,
        }))
        if (insight.contested) layerDescriptions.push(translate(locale, 'map.legend.contested'))
        if (controlDelta) layerDescriptions.push(translate(locale, `map.a11y.change.${controlDelta}`))
      }
      if (visualLayer === 'safety') {
        const contactKey = occupantContact === 'defended-only'
          ? 'map.legend.defended'
          : occupantContact === 'attacked-defended'
            ? 'map.legend.attackedDefended'
            : occupantContact === 'attacked-undefended'
              ? 'map.legend.loose'
              : occupantContact === 'king'
                ? 'map.a11y.safety.king'
                : null
        if (contactKey) layerDescriptions.push(translate(locale, contactKey))
        if (pieceDelta) layerDescriptions.push(translate(locale, `map.a11y.change.${pieceDelta}`))
      }
      if (visualLayer === 'lanes') {
        if (lanesHere.length > 0) {
          layerDescriptions.push(translate(locale, 'map.a11y.lanes', {
            actor: sideName(locale, state.variant, state.actor),
            actorCount: actorLanes,
            opponent: sideName(locale, state.variant, opposite(state.actor)),
            opponentCount: opponentLanes,
          }))
        }
        if (laneScreen) layerDescriptions.push(translate(locale, 'map.legend.cannonScreen'))
      }
      if (visualLayer === 'king') {
        if (actorKingZone) {
          layerDescriptions.push(translate(locale, 'map.a11y.kingZone', {
            side: sideName(locale, state.variant, state.actor),
          }))
        }
        if (opponentKingZone) {
          layerDescriptions.push(translate(locale, 'map.a11y.kingZone', {
            side: sideName(locale, state.variant, opposite(state.actor)),
          }))
        }
        if (hostileKingSquare) layerDescriptions.push(translate(locale, 'map.legend.hostileRing'))
        if (kingEscape) layerDescriptions.push(translate(locale, 'map.a11y.kingEscape'))
      }
      const layerDescription = layerDescriptions.join(' ')
      const chooseCell = () => {
        if (authoritativePiece?.side === state.actor) {
          onDrop(null)
          onOrigin(coordinate)
          return
        }
        const matches = candidates.filter((candidate) =>
          candidate.action.to === coordinate &&
          (candidate.action.from === selectedOrigin || (selectedDrop && candidate.action.kind === 'drop' && candidate.action.piece === selectedDrop)),
        )
        if (matches.length) onChoose(matches.find((candidate) => !candidate.action.promote && !candidate.action.promotion) ?? matches[0])
      }
      cells.push(
        <button
          type="button"
          className={[
            'board-cell',
            (x + y) % 2 ? 'tone-b' : 'tone-a',
            selectedOrigin === coordinate ? 'is-origin' : '',
            isDestination ? 'is-destination' : '',
            isPreviewFrom ? 'is-preview-from' : '',
            isPreviewTo ? 'is-preview-to' : '',
            movedAway ? 'is-vacated' : '',
          ].filter(Boolean).join(' ')}
          key={coordinate}
          aria-label={layerDescription ? `${title}. ${layerDescription}` : title}
          aria-pressed={selectedOrigin === coordinate || (previewSource === 'selected' && isPreviewTo)}
          onClick={chooseCell}
          data-square={coordinate}
          data-visual-layer={visualLayer}
          data-layer-description={layerDescription || undefined}
          data-control-first={insight.control.first.count}
          data-control-second={insight.control.second.count}
          data-control-delta={controlDelta ?? undefined}
          data-piece-contact={occupantContact ?? undefined}
          data-piece-delta={pieceDelta ?? undefined}
          data-king-zone={actorKingZone ? 'actor' : opponentKingZone ? 'opponent' : undefined}
          data-king-escape={kingEscape || undefined}
          data-lane-screen={laneScreen || undefined}
          data-promotion-camp={shogiZone ?? undefined}
        >
          {visualLayer === 'control' && (actorControl > 0 || opponentControl > 0) && (
            <span
              className={`control-field ${insight.contested ? 'is-contested' : ''} ${controlDelta ? `delta-${controlDelta}` : ''}`}
              style={{
                '--actor-control': Math.min(0.42, 0.1 + actorControl * 0.08),
                '--opponent-control': Math.min(0.42, 0.1 + opponentControl * 0.08),
              } as React.CSSProperties}
              aria-hidden="true"
            />
          )}
          {visualLayer === 'king' && (actorKingZone || opponentKingZone) && (
            <span className={`king-zone ${actorKingZone ? 'zone-actor' : 'zone-opponent'} ${hostileKingSquare ? 'is-hostile' : ''} ${kingEscape ? 'is-escape' : ''}`} aria-hidden="true" />
          )}
          {visualLayer === 'lanes' && shogiZone && <span className={`promotion-camp camp-${shogiZone}`} aria-hidden="true" />}
          {shownPiece && (
            <span className={`piece piece-${shownPiece.side} piece-${state.variant} ${visualLayer === 'safety' && occupantContact ? `contact-${occupantContact}` : ''} ${visualLayer === 'safety' && pieceDelta ? `delta-${pieceDelta}` : ''}`} aria-hidden="true">
              {glyph(state.variant, shownPiece)}
            </span>
          )}
          {visualLayer === 'lanes' && laneScreen && <span className="lane-screen-marker" aria-hidden="true">●</span>}
          {captureTarget && <span className="capture-marker" aria-hidden="true">×</span>}
          {preview?.action.kind === 'drop' && isPreviewTo && <span className="drop-marker" aria-hidden="true">↓</span>}
          {isDestination && !shownPiece && <span className="destination-dot" aria-hidden="true" />}
          {isPreviewTo && <span className="preview-ring" aria-hidden="true" />}
          <span className="coordinate" aria-hidden="true">{labelCoordinate}</span>
        </button>,
      )
    }
  }
  const handEntries = Object.entries(state.hands[state.actor]).filter(([, count]) => Boolean(count)) as [PieceKind, number][]
  return (
    <div className="board-stage" id="lesson-board" data-preview-source={previewSource ?? 'current'}>
      {preview && <div className="hypothetical">{translate(locale, 'board.hypothetical')}</div>}
      <div
        className={`board board-${state.variant}`}
        style={{ '--files': config.shape.files, '--ranks': config.shape.ranks } as React.CSSProperties}
        onContextMenu={(event) => {
          if (!previewSource) return
          event.preventDefault()
          clear()
        }}
        onKeyDown={(event) => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) clear() }}
      >
        {cells}
        {state.variant === 'xiangqi' && <div className="river-label" aria-hidden="true">{translate(locale, 'board.river')}</div>}
        {visualLayer === 'lanes' && positionInsight.lanes.length > 0 && (
          <svg className="lane-map" data-testid="mobility-lanes" viewBox={`0 0 ${config.shape.files} ${config.shape.ranks}`} preserveAspectRatio="none" aria-hidden="true">
            {positionInsight.lanes.map((lane, index) => {
              const end = lane.controlled.at(-1) ?? lane.path.at(-1)
              if (!end) return null
              return (
                <line
                  key={`${lane.origin}-${lane.kind}-${index}`}
                  className={`${lane.side === state.actor ? 'lane-actor' : 'lane-opponent'} lane-${lane.kind}`}
                  x1={point(lane.origin).x + 0.5}
                  y1={point(lane.origin).y + 0.5}
                  x2={point(end).x + 0.5}
                  y2={point(end).y + 0.5}
                />
              )
            })}
          </svg>
        )}
        {preview?.action.from && (
          <svg className="move-arrow" viewBox={`0 0 ${config.shape.files} ${config.shape.ranks}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker id="arrow-head" markerWidth="0.42" markerHeight="0.42" refX="0.3" refY="0.21" orient="auto">
                <path d="M0,0 L0.34,0.21 L0,0.42 Z" fill="currentColor" />
              </marker>
            </defs>
            <line
              x1={point(preview.action.from).x + 0.5}
              y1={point(preview.action.from).y + 0.5}
              x2={point(preview.action.to).x + 0.5}
              y2={point(preview.action.to).y + 0.5}
              markerEnd="url(#arrow-head)"
            />
          </svg>
        )}
      </div>
      {state.variant === 'shogi' && (
        <div className="hands" aria-label={translate(locale, 'hands.title')}>
          <strong>{translate(locale, 'hands.title')}</strong>
          {handEntries.length === 0 && <span>{translate(locale, 'hands.empty')}</span>}
          {handEntries.map(([kind, count]) => (
            <button
              type="button"
              key={kind}
              className={selectedDrop === kind ? 'is-selected' : ''}
              onClick={() => { onOrigin(null); onDrop(selectedDrop === kind ? null : kind) }}
            >
              {shogiGlyphs[kind]} × {count}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface CandidateListProps {
  candidates: Candidate[]
  ranking: RankedCandidateInsight[]
  selected: Candidate | null
  suggested: Candidate | null
  engineAnalysis: EngineAnalysis | null
  locale: Locale
  onPreview: (candidate: Candidate | null) => void
  onChoose: (candidate: Candidate) => void
  onClear: () => void
}

function CandidateList({ candidates, ranking, selected, suggested, engineAnalysis, locale, onPreview, onChoose, onClear }: CandidateListProps) {
  const visible = [...ranking].sort((left, right) => {
    const leftLine = engineLineForCandidate(engineAnalysis, left.candidate)
    const rightLine = engineLineForCandidate(engineAnalysis, right.candidate)
    return (leftLine?.rank ?? Number.MAX_SAFE_INTEGER) - (rightLine?.rank ?? Number.MAX_SAFE_INTEGER)
      || ranking.indexOf(left) - ranking.indexOf(right)
  }).slice(0, 8)
  return (
    <section className="candidate-panel" aria-labelledby="candidate-title">
      <div className="section-heading">
        <div>
          <span className="kicker">{translate(locale, engineAnalysis?.status === 'available' ? 'candidate.engineSubtitle' : 'candidate.subtitle')}</span>
          <h2 id="candidate-title">{translate(locale, 'candidate.title')}</h2>
        </div>
        <span className="count-badge">{candidates.length}</span>
      </div>
      <div className="candidate-list" onKeyDown={(event) => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) onClear() }}>
        {visible.map(({ candidate, factors }, index) => {
          const line = engineLineForCandidate(engineAnalysis, candidate)
          const rationale = primaryPositiveFactor(factors)
          return (
          <button
            type="button"
            key={candidate.id}
            className={`candidate ${selected?.id === candidate.id ? 'is-selected' : ''}`}
            data-candidate-id={candidate.id}
            data-testid={suggested?.id === candidate.id ? 'suggested-candidate' : undefined}
            data-engine-rank={line?.rank}
            data-rationale-contribution={rationale?.contribution}
            aria-pressed={selected?.id === candidate.id}
            onMouseEnter={() => onPreview(candidate)}
            onMouseLeave={() => onPreview(null)}
            onFocus={() => onPreview(candidate)}
            onBlur={() => onPreview(null)}
            onClick={() => onChoose(candidate)}
          >
            <span className="candidate-rank">{line ? `E${line.rank}` : String(index + 1).padStart(2, '0')}</span>
            <span className="candidate-main">
              <strong>
                {suggested?.id === candidate.id && <><span className="suggestion-mark" aria-hidden="true">✦</span><span className="sr-only">{translate(locale, 'map.mode.suggested')}: </span></>}
                {candidate.notation}
              </strong>
              <small>{line
                ? `${translate(locale, 'evidence.engine')} · ${engineEvaluation(locale, line)}`
                : translate(locale, rationale ? rankingFactorKey(rationale.id) : 'rank.legal')}</small>
            </span>
            <span className="candidate-arrow" aria-hidden="true">↗</span>
          </button>
          )
        })}
        {visible.length === 0 && <p className="empty-copy">{translate(locale, 'candidate.none')}</p>}
      </div>
      {candidates.length > visible.length && (
        <p className="more-copy">{translate(locale, 'candidate.more', { count: candidates.length - visible.length })}</p>
      )}
    </section>
  )
}

function Coach({ state, after, candidate, locale }: { state: GameState; after: GameState | null; candidate: Candidate | null; locale: Locale }) {
  const claims = after && candidate ? teachingFacets(state, after, candidate) : []
  return (
    <section className="coach-panel" aria-labelledby="coach-title">
      <div className="section-heading">
        <div>
          <span className="kicker">{translate(locale, 'companion.label')}</span>
          <h2 id="coach-title">{translate(locale, 'coach.title')}</h2>
        </div>
      </div>
      {!candidate && <p className="empty-copy coach-empty">{translate(locale, 'coach.empty')}</p>}
      <div className="claims">
        {claims.map((claim) => (
          <article className={`claim claim-${claim.evidence}`} key={`${claim.evidence}-${claim.titleKey}`}>
            <span className="evidence">{translate(locale, `evidence.${claim.evidence}`)}</span>
            <h3>{translate(locale, claim.titleKey)}</h3>
            <p>{translate(locale, claim.bodyKey, claim.params)}</p>
          </article>
        ))}
      </div>
      {candidate && after?.status.phase !== 'complete' && <p className="coach-question">{translate(locale, 'coach.question')}</p>}
    </section>
  )
}

function EngineLane({ locale, analysis, pending }: { locale: Locale; analysis: EngineAnalysis | null; pending: boolean }) {
  const available = analysis?.status === 'available' ? analysis : null
  const principal = available?.lines[0] ?? null
  const engineHeading = available
    ? available.engine.name.includes(available.engine.version)
      ? available.engine.name
      : `${available.engine.name} ${available.engine.version}`
    : null
  const heading = pending
    ? translate(locale, 'engine.searching')
    : available
      ? engineHeading!
      : translate(locale, 'engine.offline')
  return (
    <section className="engine-lane" data-testid="engine-lane" data-status={pending ? 'searching' : analysis?.status ?? 'idle'}>
      <div className={`engine-orb ${available ? 'is-live' : ''}`} aria-hidden="true"><span /></div>
      <div>
        <span className="kicker">{translate(locale, 'engine.title')}</span>
        <h2>{heading}</h2>
        {available && principal ? (
          <>
            <div className="engine-facts">
              <strong>{engineEvaluation(locale, principal)}</strong>
              <span>{translate(locale, 'engine.depth', { depth: available.search.completedDepth })}</span>
              <span>{translate(locale, 'engine.nodes', {
                nodes: new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(available.search.nodes),
              })}</span>
              <span>{translate(locale, 'engine.seconds', {
                seconds: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(available.search.timeMs / 1000),
              })}</span>
            </div>
            <p>{translate(locale, 'engine.rootPerspective', {
              side: sideName(locale, available.variant, available.search.rootActor),
            })}</p>
            <p className="engine-pv">
              <strong>{translate(locale, 'engine.principalVariation')}</strong>
              <code>{principal.pv.slice(0, 6).join(' ')}</code>
            </p>
            <small>{translate(locale, `engine.limitation.${available.engine.limitation}`)} · {translate(locale, 'engine.searchLimit', {
              milliseconds: available.search.limit.movetimeMs,
              lines: available.search.limit.multiPv,
            })}</small>
            <details className="engine-provenance">
              <summary>{translate(locale, 'engine.provenance')}</summary>
              <code>{available.engine.id} · {available.engine.role} · {available.engine.sourceCommit.slice(0, 10)} · {available.engine.binarySha256.slice(0, 10)}{available.engine.networkSha256 ? ` · NNUE ${available.engine.networkSha256.slice(0, 10)}` : ''}</code>
            </details>
          </>
        ) : (
          <>
            <p>{pending ? translate(locale, 'engine.searchingBody') : translate(locale, 'engine.body')}</p>
            <small>{analysis?.status === 'unavailable'
              ? `${translate(locale, `engine.reason.${analysis.reason}`)} · ${translate(locale, 'engine.setup')}`
              : translate(locale, 'engine.setup')}</small>
          </>
        )}
      </div>
    </section>
  )
}

function Chronicle({ state, locale }: { state: GameState; locale: Locale }) {
  return (
    <section className="chronicle">
      <div className="section-heading">
        <h2>{translate(locale, 'history.title')}</h2>
        <span className="count-badge">{state.moves.length}</span>
      </div>
      {state.moves.length === 0 ? <p className="empty-copy">{translate(locale, 'history.empty')}</p> : (
        <ol>
          {[...state.moves].reverse().map((record, reverseIndex) => {
            const number = state.moves.length - reverseIndex
            return (
              <li key={`${number}-${record.stateTokenBefore}`}>
                {translate(locale, 'history.ply', {
                  number,
                  side: sideName(locale, state.variant, record.actor),
                  notation: record.notation,
                })}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function Sessions({ store, locale, close, choose }: { store: SessionStore; locale: Locale; close: () => void; choose: (id: string) => void }) {
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <aside className="sessions-drawer" role="dialog" aria-modal="true" aria-labelledby="sessions-title">
        <div className="section-heading">
          <h2 id="sessions-title">{translate(locale, 'sessions.title')}</h2>
          <button type="button" className="icon-button" onClick={close} aria-label={translate(locale, 'action.close')}>×</button>
        </div>
        <div className="session-list">
          {store.order.map((id) => {
            const state = store.sessions[id]
            const config = variantConfig(state.variant)
            return (
              <button type="button" key={id} onClick={() => choose(id)} className={id === store.activeSessionId ? 'is-current' : ''}>
                <strong>{translate(locale, config.nameKey)}</strong>
                <span>{translate(locale, 'sessions.moves', { count: state.moves.length })} · {new Date(state.updatedAt).toLocaleDateString(locale)}</span>
                {id === store.activeSessionId && <em>{translate(locale, 'sessions.current')}</em>}
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(currentLocale)
  const [store, setStore] = useState<SessionStore>(() => loadStore(localStorage))
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null)
  const [selectedDrop, setSelectedDrop] = useState<PieceKind | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [hoverCandidate, setHoverCandidate] = useState<Candidate | null>(null)
  const [dismissedSuggestionToken, setDismissedSuggestionToken] = useState<string | null>(null)
  const [visualLayer, setVisualLayer] = useState<VisualLayer>('control')
  const [engineAnalysis, setEngineAnalysis] = useState<EngineAnalysis | null>(null)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    document.title = translate(locale, 'app.title')
    let descriptionElement = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!descriptionElement) {
      descriptionElement = document.createElement('meta')
      descriptionElement.name = 'description'
      document.head.append(descriptionElement)
    }
    descriptionElement.content = translate(locale, 'app.subtitle')
  }, [locale])
  useEffect(() => {
    const receiveExternalStore = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const current = readStore(localStorage)
      if (!current) return
      setStore(current)
      setSelectedOrigin(null)
      setSelectedDrop(null)
      setSelectedCandidate(null)
      setHoverCandidate(null)
      setErrorKey('error.save')
    }
    window.addEventListener('storage', receiveExternalStore)
    return () => window.removeEventListener('storage', receiveExternalStore)
  }, [])
  const state = store.sessions[store.activeSessionId]
  const allCandidates = useMemo(() => legalActions(state), [state])
  const currentInsight = useMemo(() => inspectPosition(state), [state])
  const candidateRanking = useMemo(() => rankCandidateInsights(state, allCandidates), [allCandidates, state])
  useEffect(() => {
    if (state.status.phase === 'complete') return
    const controller = new AbortController()
    void requestEngineAnalysis(state, currentInsight.binding.stateToken, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setEngineAnalysis(result)
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) void error
      })
    return () => controller.abort()
  }, [currentInsight.binding.stateToken, state])
  const liveEngineAnalysis = engineAnalysis?.stateToken === currentInsight.binding.stateToken ? engineAnalysis : null
  const enginePending = state.status.phase === 'active' && liveEngineAnalysis === null
  const relevantCandidates = useMemo(() => {
    if (selectedOrigin) return allCandidates.filter((candidate) => candidate.action.from === selectedOrigin)
    if (selectedDrop) return allCandidates.filter((candidate) => candidate.action.kind === 'drop' && candidate.action.piece === selectedDrop)
    return allCandidates
  }, [allCandidates, selectedDrop, selectedOrigin])
  const relevantRanking = useMemo(() => {
    const ids = new Set(relevantCandidates.map(({ id }) => id))
    return candidateRanking.filter(({ candidate }) => ids.has(candidate.id))
  }, [candidateRanking, relevantCandidates])
  const currentStateToken = currentInsight.binding.stateToken
  const engineSuggestedCandidate = useMemo(() => allCandidates.find((candidate) =>
    engineLineForCandidate(liveEngineAnalysis, candidate)?.rank === 1,
  ) ?? null, [allCandidates, liveEngineAnalysis])
  const suggestedCandidate = useMemo(
    () => state.ply === 0 && state.status.phase === 'active'
      ? engineSuggestedCandidate ?? candidateRanking[0]?.candidate ?? null
      : null,
    [candidateRanking, engineSuggestedCandidate, state.ply, state.status.phase],
  )
  const visibleSuggestion = dismissedSuggestionToken !== currentStateToken && !selectedOrigin && !selectedDrop
    ? suggestedCandidate
    : null
  const shownCandidate = selectedCandidate ?? hoverCandidate ?? visibleSuggestion
  const previewSource = selectedCandidate
    ? 'selected'
    : hoverCandidate
      ? 'hover'
      : visibleSuggestion
        ? 'suggested'
        : null
  const hypothetical = shownCandidate ? previewCandidate(state, shownCandidate) : null
  const shownState = hypothetical ?? state
  const candidateInsight = useMemo(() => {
    if (!shownCandidate) return null
    const result = inspectCandidate(state, shownCandidate, { maxReplies: 2 })
    return result.ok ? result.insight : null
  }, [shownCandidate, state])
  const shownInsight = candidateInsight?.after ?? currentInsight
  const shownEngineLine = shownCandidate ? engineLineForCandidate(liveEngineAnalysis, shownCandidate) : null
  const config = variantConfig(state.variant)

  const persist = (next: SessionStore, mutationId: string): boolean => {
    const committed = commitStore(localStorage, store, next, mutationId)
    if (committed.ok) {
      setStore(committed.store)
      return true
    }
    setStore(committed.current ?? loadStore(localStorage))
    return false
  }
  const clear = () => {
    setSelectedOrigin(null)
    setSelectedDrop(null)
    setSelectedCandidate(null)
    setHoverCandidate(null)
    setDismissedSuggestionToken(currentStateToken)
    setErrorKey(null)
  }
  useEffect(() => {
    if (!previewSource) return
    const dismissWithEscape = (event: KeyboardEvent) => {
      const target = event.target
      if (
        event.key !== 'Escape' || event.defaultPrevented || event.isComposing
        || (target instanceof HTMLElement && (
          target.isContentEditable || target.matches('input, select, textarea')
        ))
      ) return
      setSelectedOrigin(null)
      setSelectedDrop(null)
      setSelectedCandidate(null)
      setHoverCandidate(null)
      setDismissedSuggestionToken(currentStateToken)
      setErrorKey(null)
    }
    window.addEventListener('keydown', dismissWithEscape)
    return () => window.removeEventListener('keydown', dismissWithEscape)
  }, [currentStateToken, previewSource])
  const switchVariant = (variant: Variant) => {
    const mutationId = requestId()
    const existing = store.order.find((id) => store.sessions[id].variant === variant)
    const next = existing
      ? selectSession(store, existing)
      : createSession(store, variant, mutationId)
    clear()
    if (!next) {
      setErrorKey('error.save')
      return
    }
    if (!persist(next, mutationId)) setErrorKey('error.save')
  }
  const newLesson = () => {
    const mutationId = requestId()
    const next = createSession(store, state.variant, mutationId)
    clear()
    if (!next) {
      setErrorKey('error.save')
      return
    }
    if (!persist(next, mutationId)) setErrorKey('error.save')
  }
  const commit = () => {
    if (!selectedCandidate) return
    const mutationId = requestId()
    const result = applyAction(state, {
      candidateId: selectedCandidate.id,
      stateToken: selectedCandidate.stateToken,
      actor: selectedCandidate.actor,
      clientRequestId: mutationId,
    })
    if (!result.ok) {
      clear()
      setErrorKey('error.stale')
      return
    }
    const next = updateSession(store, state.revision, result.state)
    if (!next) {
      setErrorKey('error.save')
      return
    }
    clear()
    if (!persist(next, mutationId)) setErrorKey('error.save')
  }
  const changeLocale = (next: Locale) => {
    localStorage.setItem(LOCALE_KEY, next)
    setLocale(next)
  }
  const statusText = state.status.phase === 'complete'
    ? state.status.winner
      ? translate(locale, 'status.winner', {
          side: sideName(locale, state.variant, state.status.winner),
          reason: translate(locale, `status.${state.status.reason ?? 'checkmate'}`),
        })
      : translate(locale, 'status.draw', { reason: translate(locale, 'status.drawReason') })
    : translate(locale, 'board.turn', { side: sideName(locale, state.variant, state.actor) })

  return (
    <div className="app-shell" data-variant={state.variant}>
      <a className="skip-link" href="#lesson-board">{translate(locale, 'app.skip')}</a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <span className="kicker">{translate(locale, 'app.eyebrow')}</span>
            <strong>{translate(locale, 'app.title')}</strong>
          </div>
        </div>
        <div className="top-actions">
          <label className="locale-switch">
            <span className="sr-only">{translate(locale, 'locale.label')}</span>
            <select
              aria-label={translate(locale, 'locale.label')}
              value={locale}
              onChange={(event) => {
                const next = event.target.value
                if (isSupportedLocale(next)) changeLocale(next)
              }}
            >
              {localeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" className="quiet-button" onClick={() => setSessionsOpen(true)}>{translate(locale, 'action.sessions')}</button>
          <button type="button" className="primary-button" onClick={newLesson}><span aria-hidden="true">＋</span>{translate(locale, 'action.new')}</button>
        </div>
      </header>

      <nav className="variant-nav" aria-label={translate(locale, 'nav.games')}>
        {variants.map((item) => (
          <button type="button" key={item.id} onClick={() => switchVariant(item.id)} className={state.variant === item.id ? 'is-active' : ''}>
            <span className="variant-icon" aria-hidden="true">{item.id === 'chess' ? '♘' : item.id === 'xiangqi' ? '帥' : '王'}</span>
            <span><strong>{translate(locale, item.nameKey)}</strong><small>{translate(locale, item.subtitleKey)}</small></span>
            <i aria-hidden="true" />
          </button>
        ))}
      </nav>

      <main className="workspace">
        <section className="board-column">
          <div className="lesson-heading">
            <div>
              <span className={`scope-badge scope-${config.scopeTone}`}>{translate(locale, `scope.${config.scopeTone}`)}</span>
              <h1>{translate(locale, config.nameKey)}</h1>
              <p>{translate(locale, config.subtitleKey)}</p>
            </div>
            <div className="turn-card">
              <span>{translate(locale, 'board.move', { move: Math.floor(state.ply / 2) + 1 })}</span>
              <strong>{statusText}</strong>
              {state.status.inCheck && <em>{translate(locale, 'board.check')}</em>}
            </div>
          </div>
          <Board
            state={state}
            shownState={shownState}
            candidates={allCandidates}
            preview={shownCandidate}
            selectedOrigin={selectedOrigin}
            selectedDrop={selectedDrop}
            locale={locale}
            onOrigin={(origin) => { setSelectedOrigin(origin); setSelectedCandidate(null) }}
            onDrop={(kind) => { setSelectedDrop(kind); setSelectedCandidate(null) }}
            onChoose={(candidate) => { setSelectedCandidate(candidate); setHoverCandidate(null) }}
            clear={clear}
            previewSource={previewSource}
            positionInsight={shownInsight}
            candidateInsight={candidateInsight}
            visualLayer={visualLayer}
          />
          <PositionMap
            state={state}
            position={currentInsight}
            candidate={candidateInsight}
            engineLine={shownEngineLine}
            previewSource={previewSource}
            layer={visualLayer}
            locale={locale}
            onLayer={setVisualLayer}
            onClear={clear}
          />
          <div className="board-guidance">
            <span aria-hidden="true">◎</span>
            <p>{selectedOrigin || selectedDrop
              ? translate(locale, 'board.chooseTarget', { count: relevantCandidates.length })
              : translate(locale, 'board.choosePiece')}</p>
            <small>{translate(locale, 'board.rightClick')}</small>
          </div>
          {selectedCandidate && (
            <div className="commit-bar">
              <div><span>{translate(locale, 'board.hypothetical')}</span><strong>{selectedCandidate.notation}</strong></div>
              <button type="button" className="quiet-button" onClick={clear}>{translate(locale, 'action.clear')}</button>
              <button type="button" className="confirm-button" onClick={commit}>{translate(locale, 'action.confirm')} <span aria-hidden="true">→</span></button>
            </div>
          )}
          {errorKey && <div className="error-banner" role="alert">{translate(locale, errorKey)}</div>}
          <details className="scope-note">
            <summary>{translate(locale, 'scope.summary')}</summary>
            <p>{translate(locale, config.scopeKey)}</p>
          </details>
        </section>

        <aside className="teaching-column">
          <CandidateList
            candidates={relevantCandidates}
            ranking={relevantRanking}
            selected={selectedCandidate}
            suggested={suggestedCandidate}
            engineAnalysis={liveEngineAnalysis}
            locale={locale}
            onPreview={setHoverCandidate}
            onChoose={(candidate) => { setSelectedCandidate(candidate); setSelectedOrigin(candidate.action.from ?? null); setSelectedDrop(candidate.action.kind === 'drop' ? candidate.action.piece : null) }}
            onClear={clear}
          />
          <Coach state={state} after={hypothetical} candidate={shownCandidate} locale={locale} />
        </aside>

        <aside className="insight-column">
          <EngineLane locale={locale} analysis={liveEngineAnalysis} pending={enginePending} />
          <Chronicle state={state} locale={locale} />
        </aside>
      </main>
      {sessionsOpen && (
        <Sessions
          store={store}
          locale={locale}
          close={() => setSessionsOpen(false)}
          choose={(id) => {
            const mutationId = requestId()
            clear()
            if (!persist(selectSession(store, id), mutationId)) setErrorKey('error.save')
            setSessionsOpen(false)
          }}
        />
      )}
    </div>
  )
}
