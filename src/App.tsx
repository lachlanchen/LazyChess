import { useEffect, useMemo, useState } from 'react'
import { applyAction, legalActions, previewCandidate } from './domain/adapter'
import { variantConfig, variants } from './domain/config'
import { displayCoordinate, point, square } from './domain/coordinates'
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
import { authoredScore, rankedCandidates, teachingFacets } from './domain/teaching'
import type { Candidate, GameState, Locale, Piece, PieceKind, Side, Variant } from './domain/types'
import { localeOptions, sideName, translate } from './i18n'

const LOCALE_KEY = 'three-boards.locale.v1'

function requestId(): string {
  return crypto.randomUUID()
}

function currentLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY)
  return stored === 'zh-Hans' || stored === 'ja' ? stored : 'en'
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
      const labelCoordinate = displayCoordinate(state.variant, coordinate)
      const title = shownPiece ? `${translate(locale, `piece.${shownPiece.kind}`)} · ${labelCoordinate}` : labelCoordinate
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
          aria-label={title}
          aria-pressed={selectedOrigin === coordinate || isPreviewTo}
          onClick={chooseCell}
          data-square={coordinate}
        >
          {shownPiece && (
            <span className={`piece piece-${shownPiece.side} piece-${state.variant}`} aria-hidden="true">
              {glyph(state.variant, shownPiece)}
            </span>
          )}
          {isDestination && !shownPiece && <span className="destination-dot" aria-hidden="true" />}
          {isPreviewTo && <span className="preview-ring" aria-hidden="true" />}
          <span className="coordinate" aria-hidden="true">{labelCoordinate}</span>
        </button>,
      )
    }
  }
  const handEntries = Object.entries(state.hands[state.actor]).filter(([, count]) => Boolean(count)) as [PieceKind, number][]
  return (
    <div className="board-stage" id="lesson-board">
      {preview && <div className="hypothetical">{translate(locale, 'board.hypothetical')}</div>}
      <div
        className={`board board-${state.variant}`}
        style={{ '--files': config.shape.files, '--ranks': config.shape.ranks } as React.CSSProperties}
        onContextMenu={(event) => { event.preventDefault(); clear() }}
      >
        {cells}
        {state.variant === 'xiangqi' && <div className="river-label" aria-hidden="true">{translate(locale, 'board.river')}</div>}
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
  state: GameState
  candidates: Candidate[]
  selected: Candidate | null
  locale: Locale
  onPreview: (candidate: Candidate | null) => void
  onChoose: (candidate: Candidate) => void
}

function CandidateList({ state, candidates, selected, locale, onPreview, onChoose }: CandidateListProps) {
  const visible = rankedCandidates(state, candidates).slice(0, 8)
  return (
    <section className="candidate-panel" aria-labelledby="candidate-title">
      <div className="section-heading">
        <div>
          <span className="kicker">{translate(locale, 'candidate.subtitle')}</span>
          <h2 id="candidate-title">{translate(locale, 'candidate.title')}</h2>
        </div>
        <span className="count-badge">{candidates.length}</span>
      </div>
      <div className="candidate-list">
        {visible.map((candidate, index) => (
          <button
            type="button"
            key={candidate.id}
            className={`candidate ${selected?.id === candidate.id ? 'is-selected' : ''}`}
            onMouseEnter={() => onPreview(candidate)}
            onMouseLeave={() => onPreview(null)}
            onFocus={() => onPreview(candidate)}
            onBlur={() => onPreview(null)}
            onClick={() => onChoose(candidate)}
          >
            <span className="candidate-rank">{String(index + 1).padStart(2, '0')}</span>
            <span className="candidate-main">
              <strong>{candidate.notation}</strong>
              <small>{translate(locale, 'candidate.score', { score: authoredScore(state, candidate) })}</small>
            </span>
            <span className="candidate-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
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
      {candidate && <p className="coach-question">{translate(locale, 'coach.question')}</p>}
    </section>
  )
}

function EngineLane({ locale }: { locale: Locale }) {
  return (
    <section className="engine-lane">
      <div className="engine-orb" aria-hidden="true"><span /></div>
      <div>
        <span className="kicker">{translate(locale, 'engine.title')}</span>
        <h2>{translate(locale, 'engine.offline')}</h2>
        <p>{translate(locale, 'engine.body')}</p>
        <small>{translate(locale, 'engine.setup')}</small>
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
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  useEffect(() => {
    document.documentElement.lang = locale
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
  const relevantCandidates = useMemo(() => {
    if (selectedOrigin) return allCandidates.filter((candidate) => candidate.action.from === selectedOrigin)
    if (selectedDrop) return allCandidates.filter((candidate) => candidate.action.kind === 'drop' && candidate.action.piece === selectedDrop)
    return allCandidates
  }, [allCandidates, selectedDrop, selectedOrigin])
  const shownCandidate = hoverCandidate ?? selectedCandidate
  const hypothetical = shownCandidate ? previewCandidate(state, shownCandidate) : null
  const shownState = hypothetical ?? state
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
    setErrorKey(null)
  }
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
          <div className="locale-switch" aria-label={translate(locale, 'locale.label')}>
            {localeOptions.map((option) => (
              <button type="button" key={option.id} className={locale === option.id ? 'is-active' : ''} onClick={() => changeLocale(option.id)}>{option.label}</button>
            ))}
          </div>
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
            state={state}
            candidates={relevantCandidates}
            selected={selectedCandidate}
            locale={locale}
            onPreview={setHoverCandidate}
            onChoose={(candidate) => { setSelectedCandidate(candidate); setSelectedOrigin(candidate.action.from ?? null); setSelectedDrop(candidate.action.kind === 'drop' ? candidate.action.piece : null) }}
          />
          <Coach state={state} after={hypothetical} candidate={shownCandidate} locale={locale} />
        </aside>

        <aside className="insight-column">
          <EngineLane locale={locale} />
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
