import { createHash } from 'node:crypto'
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { lstat, readFile, realpath, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import type { Plugin } from 'vite'

type Variant = 'chess' | 'xiangqi' | 'shogi'
type Side = 'first' | 'second'
type PieceKind =
  | 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn' | 'advisor' | 'elephant' | 'cannon'
  | 'gold' | 'silver' | 'lance' | 'promoted-rook' | 'promoted-bishop' | 'promoted-silver'
  | 'promoted-knight' | 'promoted-lance' | 'promoted-pawn'

interface WirePiece {
  side: Side
  kind: PieceKind
}

interface WireAction {
  kind: 'move' | 'drop'
  from?: string
  to: string
  piece: string
  promote?: boolean
  promotion?: string
}

interface WireMoveRecord {
  actor: Side
  action: WireAction
}

interface WirePosition {
  board: Record<string, WirePiece>
  hands: Record<Side, Partial<Record<PieceKind, number>>>
}

export interface EngineAnalysisRequest {
  schemaVersion: 1
  variant: Variant
  ruleset: string
  stateToken: string
  actor: Side
  history: WireMoveRecord[]
  position: WirePosition
}

export interface EngineLine {
  rank: number
  depth: number
  selDepth?: number
  nodes: number
  timeMs: number
  score: { kind: 'centipawn'; value: number; bound: 'exact' | 'lower' | 'upper' }
    | { kind: 'mate'; moves: number; bound: 'exact' | 'lower' | 'upper' }
  pv: string[]
}

export interface AvailableEngineAnalysis {
  schemaVersion: 1
  status: 'available'
  stateToken: string
  variant: Variant
  actor: Side
  engine: {
    id: string
    name: string
    version: string
    role: string
    sourceCommit: string
    binarySha256: string
    networkSha256?: string
    limitation: 'specialist' | 'classical-fallback'
  }
  search: {
    perspective: 'root-side-to-move'
    rootActor: Side
    limit: { movetimeMs: number; threads: 1; hashMb: number; multiPv: number }
    completedDepth: number
    nodes: number
    timeMs: number
  }
  lines: EngineLine[]
}

export interface UnavailableEngineAnalysis {
  schemaVersion: 1
  status: 'unavailable'
  stateToken: string
  variant: Variant
  actor: Side
  reason: 'not-installed' | 'verification-failed' | 'invalid-position' | 'search-failed' | 'busy'
}

export type EngineAnalysisResponse = AvailableEngineAnalysis | UnavailableEngineAnalysis

interface EngineReceipt {
  schema_version: number
  engine_id: string
  version: string
  role: string
  source: { commit: string }
  binary: { relative_path: string; sha256: string }
}

interface EngineDefinition {
  selector: 'stockfish' | 'pikafish' | 'fairy-stockfish'
  id: string
  version: string
  role: string
  sourceCommit: string
  expectedName: RegExp
  limitation: 'specialist' | 'classical-fallback'
  movetimeMs: number
  depthFloor: number
  multiPv: number
  configure: (installDir: string) => string[]
  network?: { relativePath: string; size: number; sha256: string }
}

interface VerifiedEngine {
  definition: EngineDefinition
  installDir: string
  binaryPath: string
  binarySha256: string
  networkPath?: string
  networkSha256?: string
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_MODEL_ROOT = resolve(REPO_ROOT, '../.local/models')
const HASH_MB = 32
const MAX_BODY_BYTES = 64 * 1024
const MAX_HISTORY = 512
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
const ENGINE_TIMEOUT_MS = 8_000
const CACHE_LIMIT = 48
const MAX_PENDING_ANALYSES = 3
const execFileAsync = promisify(execFile)

const RULESETS: Record<Variant, string> = {
  chess: 'chess.js-1.4.0-standard',
  xiangqi: 'xiangqi-teaching-core-1',
  shogi: 'shogi-teaching-core-1',
}

const DEFINITIONS: Record<Variant, EngineDefinition> = {
  chess: {
    selector: 'stockfish',
    id: 'stockfish-18-avxvnni',
    version: '18',
    role: 'international-chess',
    sourceCommit: 'cb3d4ee9b47d0c5aae855b12379378ea1439675c',
    expectedName: /Stockfish 18/i,
    limitation: 'specialist',
    movetimeMs: 1_500,
    depthFloor: 1,
    multiPv: 5,
    configure: () => [],
  },
  xiangqi: {
    selector: 'pikafish',
    id: 'pikafish-2026-01-02-avxvnni',
    version: '2026-01-02',
    role: 'xiangqi',
    sourceCommit: 'ce0679e00ee196f7ba17f6ec18941b9a5036f8cf',
    expectedName: /Pikafish/i,
    limitation: 'specialist',
    movetimeMs: 1_500,
    depthFloor: 1,
    multiPv: 5,
    configure: (installDir) => [`setoption name EvalFile value ${resolve(installDir, 'payload/pikafish.nnue')}`],
    network: {
      relativePath: 'payload/pikafish.nnue',
      size: 53_212_941,
      sha256: 'c4026370d7516d9b0f668447f9ca1931241538bdc689cde6fec6a991ac4d5f77',
    },
  },
  shogi: {
    selector: 'fairy-stockfish',
    id: 'fairy-stockfish-14-largeboard',
    version: '14',
    role: 'shogi-fallback',
    sourceCommit: 'f3e6969d11d1bec17eba26e7ae0e629ad4af71dd',
    expectedName: /Fairy-Stockfish 14/i,
    limitation: 'classical-fallback',
    movetimeMs: 1_200,
    depthFloor: 1,
    multiPv: 5,
    configure: () => ['setoption name UCI_Variant value shogi'],
  },
}

const PIECES = new Set([
  'king', 'queen', 'rook', 'bishop', 'knight', 'pawn', 'advisor', 'elephant', 'cannon', 'gold', 'silver',
  'lance', 'promoted-rook', 'promoted-bishop', 'promoted-silver', 'promoted-knight', 'promoted-lance', 'promoted-pawn',
])
const PROMOTIONS = new Set(['queen', 'rook', 'bishop', 'knight'])
const VARIANT_PIECES: Record<Variant, Set<PieceKind>> = {
  chess: new Set(['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']),
  xiangqi: new Set(['king', 'rook', 'knight', 'elephant', 'advisor', 'cannon', 'pawn']),
  shogi: new Set([
    'king', 'rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn', 'promoted-rook', 'promoted-bishop',
    'promoted-silver', 'promoted-knight', 'promoted-lance', 'promoted-pawn',
  ]),
}
const SHOGI_HAND_PIECES = new Set<PieceKind>(['rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn'])

function ownRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}

function validCoordinate(variant: Variant, value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (variant === 'chess') return /^[a-h][1-8]$/.test(value)
  if (variant === 'xiangqi') return /^[a-i](?:10|[1-9])$/.test(value)
  return /^[a-i][1-9]$/.test(value)
}

function validAction(variant: Variant, value: unknown): value is WireAction {
  if (!ownRecord(value) || (value.kind !== 'move' && value.kind !== 'drop')) return false
  if (!validCoordinate(variant, value.to) || typeof value.piece !== 'string' || !PIECES.has(value.piece)) return false
  if (value.kind === 'move') {
    if (!validCoordinate(variant, value.from)) return false
  } else if (variant !== 'shogi' || value.from !== undefined) return false
  if (value.promote !== undefined && (variant !== 'shogi' || typeof value.promote !== 'boolean')) return false
  if (value.promotion !== undefined && (variant !== 'chess' || typeof value.promotion !== 'string' || !PROMOTIONS.has(value.promotion))) return false
  return true
}

function boardSquare(x: number, y: number): string {
  return `${String.fromCharCode(97 + x)}${y + 1}`
}

function validPosition(variant: Variant, value: unknown): WirePosition | null {
  if (!ownRecord(value) || !ownRecord(value.board) || !ownRecord(value.hands)) return null
  if (!ownRecord(value.hands.first) || !ownRecord(value.hands.second)) return null
  const boardEntries = Object.entries(value.board)
  const maximumPieces = variant === 'shogi' ? 40 : 32
  if (boardEntries.length < 2 || boardEntries.length > maximumPieces) return null
  const board: WirePosition['board'] = {}
  const kings: Record<Side, number> = { first: 0, second: 0 }
  for (const [coordinate, piece] of boardEntries) {
    if (!validCoordinate(variant, coordinate) || !ownRecord(piece)) return null
    if ((piece.side !== 'first' && piece.side !== 'second') || typeof piece.kind !== 'string') return null
    const kind = piece.kind as PieceKind
    if (!VARIANT_PIECES[variant].has(kind)) return null
    board[coordinate] = { side: piece.side, kind }
    if (kind === 'king') kings[piece.side] += 1
  }
  if (kings.first !== 1 || kings.second !== 1) return null
  const hands: WirePosition['hands'] = { first: {}, second: {} }
  let totalPieces = boardEntries.length
  for (const side of ['first', 'second'] as const) {
    for (const [rawKind, rawCount] of Object.entries(value.hands[side])) {
      const kind = rawKind as PieceKind
      if (variant !== 'shogi' || !SHOGI_HAND_PIECES.has(kind)) return null
      if (!Number.isSafeInteger(rawCount) || Number(rawCount) < 0 || Number(rawCount) > 18) return null
      if (Number(rawCount) > 0) {
        hands[side][kind] = Number(rawCount)
        totalPieces += Number(rawCount)
      }
    }
  }
  if (totalPieces > maximumPieces || (variant === 'shogi' && totalPieces !== 40)) return null
  return { board, hands }
}

export function validateEngineRequest(value: unknown): EngineAnalysisRequest | null {
  if (!ownRecord(value) || value.schemaVersion !== 1) return null
  if (value.variant !== 'chess' && value.variant !== 'xiangqi' && value.variant !== 'shogi') return null
  const variant = value.variant as Variant
  if (value.ruleset !== RULESETS[variant]) return null
  if (typeof value.stateToken !== 'string' || !/^[a-f0-9]{64}$/.test(value.stateToken)) return null
  if (value.actor !== 'first' && value.actor !== 'second') return null
  if (!Array.isArray(value.history) || value.history.length > MAX_HISTORY) return null
  const history: WireMoveRecord[] = []
  for (let index = 0; index < value.history.length; index += 1) {
    const record = value.history[index]
    if (!ownRecord(record) || !validAction(variant, record.action)) return null
    const actor: Side = index % 2 === 0 ? 'first' : 'second'
    if (record.actor !== actor) return null
    history.push({ actor, action: { ...record.action } })
  }
  const expectedActor: Side = history.length % 2 === 0 ? 'first' : 'second'
  if (value.actor !== expectedActor) return null
  const position = validPosition(variant, value.position)
  if (!position) return null
  const request: EngineAnalysisRequest = {
    schemaVersion: 1,
    variant,
    ruleset: value.ruleset,
    stateToken: value.stateToken,
    actor: value.actor as Side,
    history,
    position,
  }
  return request
}

function engineCoordinate(variant: Variant, coordinate: string): string {
  const rank = Number(coordinate.slice(1))
  return `${coordinate[0]}${variant === 'chess' ? 9 - rank : 10 - rank}`
}

const PIECE_LETTER: Record<string, string> = {
  pawn: 'P', lance: 'L', knight: 'N', silver: 'S', gold: 'G', bishop: 'B', rook: 'R', king: 'K',
}

export function actionToEngineMove(variant: Variant, action: WireAction): string {
  if (action.kind === 'drop') {
    const letter = PIECE_LETTER[action.piece]
    if (!letter) throw new Error('Unsupported drop piece')
    return `${letter}@${engineCoordinate(variant, action.to)}`
  }
  if (!action.from) throw new Error('Move is missing its origin')
  const base = `${engineCoordinate(variant, action.from)}${engineCoordinate(variant, action.to)}`
  if (variant === 'chess' && action.promotion) {
    const suffix: Record<string, string> = { queen: 'q', rook: 'r', bishop: 'b', knight: 'n' }
    return `${base}${suffix[action.promotion]}`
  }
  if (variant === 'shogi' && action.promote) return `${base}+`
  return base
}

function positionCommand(request: EngineAnalysisRequest): string {
  const moves = request.history.map((record) => actionToEngineMove(request.variant, record.action))
  return moves.length ? `position startpos moves ${moves.join(' ')}` : 'position startpos'
}

const FEN_PIECES: Record<Variant, Record<string, PieceKind>> = {
  chess: { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' },
  xiangqi: { k: 'king', a: 'advisor', b: 'elephant', n: 'knight', r: 'rook', c: 'cannon', p: 'pawn' },
  shogi: { k: 'king', r: 'rook', b: 'bishop', g: 'gold', s: 'silver', n: 'knight', l: 'lance', p: 'pawn' },
}

const SHOGI_PROMOTED: Partial<Record<PieceKind, PieceKind>> = {
  rook: 'promoted-rook',
  bishop: 'promoted-bishop',
  silver: 'promoted-silver',
  knight: 'promoted-knight',
  lance: 'promoted-lance',
  pawn: 'promoted-pawn',
}

interface FenPosition {
  actor: Side
  board: Record<string, WirePiece>
  hands: Record<Side, Partial<Record<PieceKind, number>>>
}

export function parseEngineFen(variant: Variant, fen: string): FenPosition | null {
  if (fen.length > 4_096) return null
  const fields = fen.trim().split(/\s+/)
  if (fields.length < 2 || (fields[1] !== 'w' && fields[1] !== 'b')) return null
  const files = variant === 'chess' ? 8 : 9
  const ranks = variant === 'xiangqi' ? 10 : variant === 'chess' ? 8 : 9
  const boardAndHand = fields[0] ?? ''
  const handStart = boardAndHand.indexOf('[')
  if ((variant === 'shogi') !== (handStart >= 0)) return null
  const boardField = handStart >= 0 ? boardAndHand.slice(0, handStart) : boardAndHand
  const handField = handStart >= 0 && boardAndHand.endsWith(']') ? boardAndHand.slice(handStart + 1, -1) : ''
  const rows = boardField.split('/')
  if (rows.length !== ranks) return null
  const board: Record<string, WirePiece> = {}
  for (let y = 0; y < rows.length; y += 1) {
    let x = 0
    for (let index = 0; index < rows[y].length;) {
      const character = rows[y][index]
      if (/\d/.test(character)) {
        let digits = character
        index += 1
        while (index < rows[y].length && /\d/.test(rows[y][index])) digits += rows[y][index++]
        x += Number(digits)
        continue
      }
      const promoted = character === '+'
      const pieceCharacter = promoted ? rows[y][index + 1] : character
      if (!pieceCharacter || x >= files) return null
      const base = FEN_PIECES[variant][pieceCharacter.toLowerCase()]
      const kind = promoted && variant === 'shogi' ? SHOGI_PROMOTED[base] : base
      if (!kind || (promoted && kind === base)) return null
      board[boardSquare(x, y)] = { side: pieceCharacter === pieceCharacter.toUpperCase() ? 'first' : 'second', kind }
      x += 1
      index += promoted ? 2 : 1
    }
    if (x !== files) return null
  }
  const hands: FenPosition['hands'] = { first: {}, second: {} }
  if (variant === 'shogi') {
    for (let index = 0; index < handField.length;) {
      let digits = ''
      while (index < handField.length && /\d/.test(handField[index])) digits += handField[index++]
      const character = handField[index++]
      const kind = character ? FEN_PIECES.shogi[character.toLowerCase()] : undefined
      if (!kind || kind === 'king') return null
      const side: Side = character === character.toUpperCase() ? 'first' : 'second'
      const count = digits ? Number(digits) : 1
      if (!Number.isSafeInteger(count) || count < 1 || count > 18) return null
      const accumulated = (hands[side][kind] ?? 0) + count
      if (accumulated > 18) return null
      hands[side][kind] = accumulated
    }
  } else if (handField) return null
  return { actor: fields[1] === 'w' ? 'first' : 'second', board, hands }
}

function fenMatchesPosition(parsed: FenPosition | null, actor: Side, position: WirePosition): boolean {
  if (!parsed || parsed.actor !== actor) return false
  const expectedCoordinates = Object.keys(position.board)
  if (Object.keys(parsed.board).length !== expectedCoordinates.length) return false
  for (const coordinate of expectedCoordinates) {
    const expected = position.board[coordinate]
    const actual = parsed.board[coordinate]
    if (!actual || actual.side !== expected.side || actual.kind !== expected.kind) return false
  }
  for (const side of ['first', 'second'] as const) {
    const kinds = new Set([...Object.keys(position.hands[side]), ...Object.keys(parsed.hands[side])]) as Set<PieceKind>
    for (const kind of kinds) {
      if ((position.hands[side][kind] ?? 0) !== (parsed.hands[side][kind] ?? 0)) return false
    }
  }
  return true
}

function safeChild(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)
}

const verified = new Map<Variant, Promise<VerifiedEngine>>()

async function sha256File(path: string, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new DOMException('Artifact verification aborted', 'AbortError')
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) {
    if (signal?.aborted) throw new DOMException('Artifact verification aborted', 'AbortError')
    hash.update(chunk)
  }
  return hash.digest('hex')
}

async function verifyEngine(variant: Variant, signal?: AbortSignal): Promise<VerifiedEngine> {
  if (signal?.aborted) throw new DOMException('Engine verification aborted', 'AbortError')
  const existing = verified.get(variant)
  if (existing) return existing
  const promise = (async () => {
    const definition = DEFINITIONS[variant]
    const modelRoot = process.env.GAME_MODEL_ROOT ? await realpath(process.env.GAME_MODEL_ROOT) : await realpath(DEFAULT_MODEL_ROOT)
    await execFileAsync('bash', [resolve(REPO_ROOT, 'scripts/verify-engine.sh'), '--engine', definition.selector], {
      cwd: REPO_ROOT,
      env: { ...process.env, GAME_MODEL_ROOT: modelRoot },
      timeout: 60_000,
      maxBuffer: 512 * 1024,
      signal,
    })
    const installDir = await realpath(resolve(modelRoot, definition.id))
    if (!safeChild(modelRoot, installDir)) throw new Error('Unsafe engine install path')
    const receiptPath = resolve(installDir, 'receipt.json')
    const receiptStat = await lstat(receiptPath)
    if (!receiptStat.isFile() || receiptStat.isSymbolicLink()) throw new Error('Unsafe engine receipt')
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as EngineReceipt
    if (
      receipt.schema_version !== 1 || receipt.engine_id !== definition.id || receipt.version !== definition.version
      || receipt.role !== definition.role || receipt.source?.commit !== definition.sourceCommit
      || !/^[a-f0-9]{64}$/.test(receipt.binary?.sha256 ?? '')
      || typeof receipt.binary?.relative_path !== 'string'
    ) throw new Error('Engine receipt does not match the reviewed lane')
    const binaryPath = await realpath(resolve(installDir, receipt.binary.relative_path))
    if (!safeChild(installDir, binaryPath)) throw new Error('Unsafe engine binary path')
    const binaryStat = await lstat(binaryPath)
    if (!binaryStat.isFile() || binaryStat.isSymbolicLink() || (binaryStat.mode & 0o111) === 0) throw new Error('Unsafe engine binary')
    let networkPath: string | undefined
    let networkSha256: string | undefined
    if (definition.network) {
      networkPath = await realpath(resolve(installDir, definition.network.relativePath))
      const networkStat = await lstat(networkPath)
      if (!safeChild(installDir, networkPath) || !networkStat.isFile() || networkStat.isSymbolicLink()) throw new Error('Unsafe engine network')
      if ((await stat(networkPath)).size !== definition.network.size) throw new Error('Engine network size mismatch')
      networkSha256 = await sha256File(networkPath, signal)
      if (networkSha256 !== definition.network.sha256) throw new Error('Engine network checksum mismatch')
    }
    return {
      definition,
      installDir,
      binaryPath,
      binarySha256: receipt.binary.sha256,
      ...(networkPath && networkSha256 ? { networkPath, networkSha256 } : {}),
    }
  })()
  verified.set(variant, promise)
  try {
    return await promise
  } catch (error) {
    if (verified.get(variant) === promise) verified.delete(variant)
    throw error
  }
}

async function recheckRuntimeArtifacts(installed: VerifiedEngine, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException('Artifact verification aborted', 'AbortError')
  const binaryStat = await lstat(installed.binaryPath)
  if (!binaryStat.isFile() || binaryStat.isSymbolicLink() || (binaryStat.mode & 0o111) === 0) throw new Error('Unsafe engine binary')
  if (await sha256File(installed.binaryPath, signal) !== installed.binarySha256) throw new Error('Engine binary checksum mismatch')
  if (installed.definition.network) {
    if (!installed.networkPath || !installed.networkSha256) throw new Error('Engine network provenance missing')
    const networkStat = await lstat(installed.networkPath)
    if (!networkStat.isFile() || networkStat.isSymbolicLink() || networkStat.size !== installed.definition.network.size) {
      throw new Error('Unsafe engine network')
    }
    if (await sha256File(installed.networkPath, signal) !== installed.networkSha256) throw new Error('Engine network checksum mismatch')
  }
}

function valueAfter(tokens: string[], key: string): string | undefined {
  const index = tokens.indexOf(key)
  return index >= 0 ? tokens[index + 1] : undefined
}

function parseFiniteInteger(value: string | undefined, minimum = 0): number | undefined {
  if (value === undefined || !/^-?\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : undefined
}

function validEngineMove(variant: Variant, move: string): boolean {
  if (variant === 'chess') return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)
  if (variant === 'xiangqi') return /^[a-i][0-9][a-i][0-9]$/.test(move)
  return /^(?:[a-i][1-9][a-i][1-9][+=]?|[PLNSGBR]@[a-i][1-9])$/.test(move)
}

export function parseInfoLine(variant: Variant, line: string): EngineLine | null {
  if (!line.startsWith('info ') || line.length > 32_768) return null
  const tokens = line.trim().split(/\s+/)
  const rank = parseFiniteInteger(valueAfter(tokens, 'multipv'), 1) ?? 1
  const depth = parseFiniteInteger(valueAfter(tokens, 'depth'), 1)
  const nodes = parseFiniteInteger(valueAfter(tokens, 'nodes'), 0)
  const timeMs = parseFiniteInteger(valueAfter(tokens, 'time'), 0)
  const scoreIndex = tokens.indexOf('score')
  const pvIndex = tokens.indexOf('pv')
  if (depth === undefined || nodes === undefined || timeMs === undefined || scoreIndex < 0 || pvIndex < 0 || pvIndex <= scoreIndex + 2) return null
  const scoreKind = tokens[scoreIndex + 1]
  const scoreValue = parseFiniteInteger(tokens[scoreIndex + 2], scoreKind === 'mate' ? -100_000 : -100_000_000)
  if ((scoreKind !== 'cp' && scoreKind !== 'mate') || scoreValue === undefined) return null
  const bound = tokens.includes('lowerbound') ? 'lower' : tokens.includes('upperbound') ? 'upper' : 'exact'
  const pv = tokens.slice(pvIndex + 1)
  if (pv.length === 0 || pv.length > 64 || pv.some((move) => !validEngineMove(variant, move))) return null
  const selDepth = parseFiniteInteger(valueAfter(tokens, 'seldepth'), 1)
  return {
    rank,
    depth,
    ...(selDepth === undefined ? {} : { selDepth }),
    nodes,
    timeMs,
    score: scoreKind === 'cp'
      ? { kind: 'centipawn', value: scoreValue, bound }
      : { kind: 'mate', moves: scoreValue, bound },
    pv,
  }
}

function waitForLine(
  lines: AsyncIterable<string>,
  predicate: (line: string) => boolean,
  signal: AbortSignal,
): Promise<string> {
  return (async () => {
    for await (const line of lines) {
      if (signal.aborted) throw new Error('Engine operation aborted')
      if (predicate(line)) return line
    }
    throw new Error('Engine exited before the expected response')
  })()
}

function lineStream(child: ChildProcessWithoutNullStreams, signal: AbortSignal): AsyncIterable<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  let seenBytes = 0
  const iterator = child.stdout[Symbol.asyncIterator]()
  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<string>> {
          while (true) {
            const newline = buffer.indexOf('\n')
            if (newline >= 0) {
              const value = buffer.slice(0, newline).replace(/\r$/, '')
              buffer = buffer.slice(newline + 1)
              return { value, done: false }
            }
            if (signal.aborted) throw new Error('Engine operation aborted')
            const next = await iterator.next()
            if (next.done) {
              if (buffer) {
                const value = buffer
                buffer = ''
                return { value, done: false }
              }
              return { value: undefined, done: true }
            }
            seenBytes += next.value.length
            if (seenBytes > MAX_OUTPUT_BYTES) throw new Error('Engine output exceeded the limit')
            buffer += decoder.decode(next.value, { stream: true })
          }
        },
      }
    },
  }
}

async function runEngine(request: EngineAnalysisRequest, signal?: AbortSignal): Promise<AvailableEngineAnalysis> {
  if (signal?.aborted) throw new Error('Engine operation aborted')
  const installed = await verifyEngine(request.variant, signal)
  if (signal?.aborted) throw new Error('Engine operation aborted')
  await recheckRuntimeArtifacts(installed, signal)
  if (signal?.aborted) throw new Error('Engine operation aborted')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS)
  const relayAbort = () => controller.abort()
  signal?.addEventListener('abort', relayAbort, { once: true })
  let child: ChildProcessWithoutNullStreams | undefined
  try {
    child = spawn(installed.binaryPath, [], { cwd: dirname(installed.binaryPath), stdio: ['pipe', 'pipe', 'pipe'] })
    const abortChild = () => {
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    }
    controller.signal.addEventListener('abort', abortChild, { once: true })
    child.stderr.resume()
    const lines = lineStream(child, controller.signal)
    child.stdin.write('uci\n')
    const names: string[] = []
    await waitForLine(lines, (line) => {
      if (line.startsWith('id name ')) names.push(line.slice('id name '.length).trim())
      return line === 'uciok'
    }, controller.signal)
    const engineName = names.at(-1) ?? ''
    if (!installed.definition.expectedName.test(engineName)) throw new Error('Unexpected engine identity')
    for (const command of installed.definition.configure(installed.installDir)) {
      if (/[\r\n\0]/.test(command)) throw new Error('Unsafe engine option value')
      child.stdin.write(`${command}\n`)
    }
    child.stdin.write('setoption name Threads value 1\n')
    child.stdin.write(`setoption name Hash value ${HASH_MB}\n`)
    child.stdin.write(`setoption name MultiPV value ${installed.definition.multiPv}\n`)
    child.stdin.write('isready\n')
    await waitForLine(lines, (line) => line === 'readyok', controller.signal)
    child.stdin.write(`${positionCommand(request)}\n`)
    child.stdin.write('d\n')
    const fenLine = await waitForLine(lines, (line) => line.startsWith('Fen: '), controller.signal)
    if (!fenMatchesPosition(parseEngineFen(request.variant, fenLine.slice('Fen: '.length)), request.actor, request.position)) {
      throw new Error('Engine position does not match deterministic history')
    }
    child.stdin.write(`go movetime ${installed.definition.movetimeMs}\n`)
    const latestExact = new Map<number, EngineLine>()
    const latestBound = new Map<number, EngineLine>()
    await waitForLine(lines, (line) => {
      const parsed = parseInfoLine(request.variant, line)
      if (parsed && parsed.rank <= installed.definition.multiPv && parsed.depth >= installed.definition.depthFloor) {
        if (parsed.score.bound === 'exact') latestExact.set(parsed.rank, parsed)
        else latestBound.set(parsed.rank, parsed)
      }
      return line.startsWith('bestmove ')
    }, controller.signal)
    child.stdin.write('quit\n')
    const ranks = new Set([...latestExact.keys(), ...latestBound.keys()])
    const result = [...ranks]
      .map((rank) => latestExact.get(rank) ?? latestBound.get(rank))
      .filter((line): line is EngineLine => Boolean(line))
      .sort((left, right) => left.rank - right.rank)
    if (result.length === 0 || result[0]?.rank !== 1) throw new Error('Engine returned no complete principal variation')
    return {
      schemaVersion: 1,
      status: 'available',
      stateToken: request.stateToken,
      variant: request.variant,
      actor: request.actor,
      engine: {
        id: installed.definition.id,
        name: engineName,
        version: installed.definition.version,
        role: installed.definition.role,
        sourceCommit: installed.definition.sourceCommit,
        binarySha256: installed.binarySha256,
        ...(installed.networkSha256 ? { networkSha256: installed.networkSha256 } : {}),
        limitation: installed.definition.limitation,
      },
      search: {
        perspective: 'root-side-to-move',
        rootActor: request.actor,
        limit: { movetimeMs: installed.definition.movetimeMs, threads: 1, hashMb: HASH_MB, multiPv: installed.definition.multiPv },
        completedDepth: Math.min(...result.map((line) => line.depth)),
        nodes: Math.max(...result.map((line) => line.nodes)),
        timeMs: Math.max(...result.map((line) => line.timeMs)),
      },
      lines: result,
    }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', relayAbort)
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
}

const cache = new Map<string, AvailableEngineAnalysis>()
interface InFlightAnalysis {
  controller: AbortController
  promise: Promise<AvailableEngineAnalysis>
  waiters: number
}

const inFlight = new Map<string, InFlightAnalysis>()
let exclusiveTail: Promise<void> = Promise.resolve()

function cacheKey(request: EngineAnalysisRequest): string {
  return createHash('sha256').update(JSON.stringify(request)).digest('hex')
}

function remember(key: string, value: AvailableEngineAnalysis): void {
  cache.delete(key)
  cache.set(key, value)
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
}

function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = exclusiveTail.then(operation, operation)
  exclusiveTail = result.then(() => undefined, () => undefined)
  return result
}

export function analyzeEnginePosition(request: EngineAnalysisRequest, signal?: AbortSignal): Promise<AvailableEngineAnalysis> {
  if (signal?.aborted) return Promise.reject(new DOMException('Engine analysis aborted', 'AbortError'))
  const key = cacheKey(request)
  const cached = cache.get(key)
  if (cached) {
    cache.delete(key)
    cache.set(key, cached)
    return Promise.resolve(cached)
  }
  let pending = inFlight.get(key)
  if (pending?.controller.signal.aborted) {
    inFlight.delete(key)
    pending = undefined
  }
  if (!pending) {
    if (inFlight.size >= MAX_PENDING_ANALYSES) return Promise.reject(new Error('Engine analysis queue is full'))
    const controller = new AbortController()
    const promise = runExclusive(() => controller.signal.aborted
      ? Promise.reject(new DOMException('Engine analysis aborted', 'AbortError'))
      : runEngine(request, controller.signal))
    pending = { controller, promise, waiters: 0 }
    inFlight.set(key, pending)
    void promise.then(
      (value) => remember(key, value),
      () => undefined,
    ).finally(() => {
      if (inFlight.get(key) === pending) inFlight.delete(key)
    })
  }
  const operation = pending
  operation.waiters += 1
  return new Promise<AvailableEngineAnalysis>((resolvePromise, rejectPromise) => {
    let settled = false
    const finish = () => {
      if (settled) return false
      settled = true
      signal?.removeEventListener('abort', abort)
      operation.waiters -= 1
      if (operation.waiters === 0 && inFlight.get(key) === operation) {
        inFlight.delete(key)
        operation.controller.abort()
      }
      return true
    }
    const abort = () => {
      if (finish()) rejectPromise(new DOMException('Engine analysis aborted', 'AbortError'))
    }
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    void operation.promise.then(
      (value) => {
        if (finish()) resolvePromise(value)
      },
      (error: unknown) => {
        if (finish()) rejectPromise(error)
      },
    )
  })
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > MAX_BODY_BYTES) throw new Error('Request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function isLoopback(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const encoded = JSON.stringify(body)
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(encoded),
    'x-content-type-options': 'nosniff',
  })
  response.end(encoded)
}

export async function engineAnalysisHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!isLoopback(request)) {
    sendJson(response, 403, { error: 'loopback-only' })
    return
  }
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    sendJson(response, 405, { error: 'method-not-allowed' })
    return
  }
  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    sendJson(response, 415, { error: 'application-json-required' })
    return
  }
  let parsed: unknown
  try {
    parsed = await readJsonBody(request)
  } catch {
    sendJson(response, 400, { error: 'invalid-json' })
    return
  }
  const validated = validateEngineRequest(parsed)
  if (!validated) {
    sendJson(response, 400, { error: 'invalid-analysis-request' })
    return
  }
  const controller = new AbortController()
  const disconnected = () => controller.abort()
  request.once('aborted', disconnected)
  response.once('close', () => {
    if (!response.writableEnded) controller.abort()
  })
  try {
    const analysis = await analyzeEnginePosition(validated, controller.signal)
    if (!response.writableEnded && !response.destroyed) sendJson(response, 200, analysis)
  } catch (error) {
    if (controller.signal.aborted || response.destroyed) return
    const message = error instanceof Error ? error.message : ''
    const reason: UnavailableEngineAnalysis['reason'] = /queue is full/i.test(message)
      ? 'busy'
      : /not safely installed|ENOENT|not installed/i.test(message)
      ? 'not-installed'
      : /receipt|checksum|identity|Unsafe|verify/i.test(message)
        ? 'verification-failed'
        : /position|illegal|Unknown command/i.test(message)
          ? 'invalid-position'
          : 'search-failed'
    sendJson(response, 200, {
      schemaVersion: 1,
      status: 'unavailable',
      stateToken: validated.stateToken,
      variant: validated.variant,
      actor: validated.actor,
      reason,
    } satisfies UnavailableEngineAnalysis)
  } finally {
    request.removeListener('aborted', disconnected)
  }
}

export function engineAnalysisPlugin(): Plugin {
  const attach = (middlewares: {
    use: (route: string, handler: (request: IncomingMessage, response: ServerResponse) => void) => void
  }) => {
    middlewares.use('/api/engine-analysis', (request, response) => {
      void engineAnalysisHandler(request, response)
    })
  }
  return {
    name: 'lazy-chess-bounded-engine-analysis',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}
