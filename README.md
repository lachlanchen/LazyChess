# Three Boards Teacher

A local-first, multilingual teaching studio for International Chess, Xiangqi,
and Shogi. It shares one learning loop: inspect legal intentions, hover/focus or
tap to preview an immutable hypothetical board, read provenance-labeled teaching
facets, and explicitly confirm before the authoritative state changes.

## Product scope

| Mode | Deterministic authority | Current boundary |
| --- | --- | --- |
| International Chess | `chess.js` 1.4.0 | Standard legality, check, castling, en passant, promotion, mate, and library draw detection |
| Xiangqi | Authored TypeScript adapter | Teaching core: movement, horse legs, cannon screens, river, palace, flying generals, check safety, no-move loss; repetition/chasing adjudication deferred |
| Shogi | Authored TypeScript adapter | Teaching core: movement, drops, captures to hand, promotion, nifu, check safety, no-move loss; repetition, perpetual check, and pawn-drop mate deferred |

The teaching-subset boundaries are visible in English, Simplified Chinese, and
Japanese inside the product. “Teaching cue” ordering is a deterministic authored
heuristic, never an engine score. Exact, calculated, authored, engine, model, and
analogy claims have separate labels. The companion explains only; it cannot move.

## Run

Requires Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm ci
npm run dev
```

Vite binds to loopback by default. The production bundle is created with
`npm run build`.

## Deterministic contract

- `src/domain/adapter.ts` exposes `initialState`, `legalActions`, `applyAction`,
  `publicView`, and `evaluate`.
- SHA-256 candidate IDs bind the complete authoritative state token, actor, and
  canonical action.
- Stale, unknown, wrong-actor, and post-game candidates fail closed.
- Each `clientRequestId` is bound to a SHA-256 fingerprint of its candidate,
  state token, and actor. Exact retries replay; payload reuse fails closed.
- Game revisions protect session updates. Store revisions plus pre-write and
  post-write comparisons reject stale repository instances and observable write
  races.
- Previews create an immutable derived state and never touch storage.
- Local storage resumes the active session. New-session request IDs are bound to
  their requested variant and prevent an exact request from duplicating a lesson.

Browser `localStorage` has no atomic compare-and-swap primitive. The repository
therefore detects stale tabs before writing, verifies its exact write immediately
afterward, and reloads on `storage` events. It rejects a writer when a newer
revision is already visible at the pre-write read and detects an overwrite that
is visible during immediate verification. It cannot exclude every interleaving:
two tabs could both pass the read check, then write and verify one after the
other. Strict multi-writer deployments must put the same revision contract
behind a transactional server or a universally available exclusive-lock service.

This repository contains no server and no hidden-information game. A future
shared framework service can lift these pure adapters behind an API without
changing their authority boundary.

## Optional analysis engines

The quality-first dispatch pins Stockfish 18 for International Chess, Pikafish
2026-01-02 for Xiangqi, and a source-built Fairy-Stockfish 14 fallback for Shogi.
None is installed, bundled, active, or represented as evidence in the UI. See
[the engine provenance and installer contract](references/engines.md). The
opt-in sequential installer uses a shared `GAME_MODEL_ROOT`, verifies official
archive sizes and SHA-256 digests before extraction, writes private receipts,
and runs UCI identity checks.

## Quality gates

```bash
npm run lint
npm test
npm run build
npm audit
bash -n scripts/*.sh
npm run test:scripts
git diff --check
```

The current suite covers representative legal/illegal moves in all modes,
state-bound candidate rejection, payload-bound idempotency, immutable preview,
stale-tab/write-race persistence handling, resume/deduplication, path safety,
catalog parity, locale switching, and explicit UI commit.

## License

The teaching application is MIT licensed. `chess.js` is BSD-2-Clause.
Stockfish, Pikafish, and Fairy-Stockfish are separately installed GPL-3.0
programs and are not distributed in this repository.

## Citation

GitHub reads [`CITATION.cff`](CITATION.cff) to expose **Cite this repository**.

```bibtex
@software{chen_three_boards_teacher_2026,
  author  = {Chen, Lachlan},
  title   = {Three Boards Teacher: International Chess, Xiangqi, and Shogi},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/lachlanchen/LazyChess}
}
```

## Support

Support continued open-source work through [GitHub Sponsors](https://github.com/sponsors/lachlanchen)
or visit [Lazying Art](https://lazying.art). Funding links are declared in
[`.github/FUNDING.yml`](.github/FUNDING.yml).
