# Quality-first engine lanes

Repository status: **reviewed and pinned; no archive, binary, source checkout,
or model is committed or auto-loaded**. Setup installs privately under the
ignored shared model root. An installed engine remains outside game authority
until a bounded adapter validates its receipt and legal candidate mapping.

The product dispatch plan uses a specialist engine for each mature analysis
lane. The UI continues to say “offline” until a future adapter verifies a local
receipt and starts a bounded process.

| Product mode | Engine lane | Reviewed artifact | Integrity |
| --- | --- | --- | --- |
| International Chess | Stockfish 18 | `stockfish-ubuntu-x86-64-avxvnni.tar`, 114,391,040 bytes | SHA-256 `57fb4139ea786c5cb606099cd901bf363d57e0e00c5a3dc7cd98269a6baf041a` |
| Xiangqi | Pikafish 2026-01-02 | `Pikafish.2026-01-02.7z`, 55,332,846 bytes | SHA-256 `84257063905615919fb4ee6a70273a94843bb6ec04c45e3ac706098838bc1a49` |
| Shogi | Fairy-Stockfish 14 fallback | locally built large-board source at the pinned Git object | exact Git object plus local binary SHA-256 receipt |

## Primary-source pins

### Stockfish 18

- Official release: <https://github.com/official-stockfish/Stockfish/releases/tag/sf_18>
- Tag and commit: `sf_18`, `cb3d4ee9b47d0c5aae855b12379378ea1439675c`
- Official AVX-VNNI asset URL: <https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-ubuntu-x86-64-avxvnni.tar>
- License: GPL-3.0, included by upstream in the distribution

The GitHub release API publishes the exact archive size and digest above. The
release includes Stockfish’s neural evaluation networks. AVX-VNNI is deliberately
quality/performance-first and the installer fails clearly on an incompatible
CPU; it never silently substitutes an unreviewed artifact.

### Pikafish 2026-01-02

- Official release: <https://github.com/official-pikafish/Pikafish/releases/tag/Pikafish-2026-01-02>
- Tag and signed commit: `Pikafish-2026-01-02`, `ce0679e00ee196f7ba17f6ec18941b9a5036f8cf`
- Official archive URL: <https://github.com/official-pikafish/Pikafish/releases/download/Pikafish-2026-01-02/Pikafish.2026-01-02.7z>
- License: GPL-3.0, included by upstream in the distribution

Upstream describes Pikafish as a UCI Xiangqi engine and reports improved VNNI
performance in this release. The archive is verified before extraction and only
an ELF AVX-VNNI executable inside that verified archive may be selected.

### Fairy-Stockfish 14 Shogi fallback

- Official repository: <https://github.com/fairy-stockfish/Fairy-Stockfish>
- Official release: <https://github.com/fairy-stockfish/Fairy-Stockfish/releases/tag/fairy_sf_14>
- Tag and commit: `fairy_sf_14`, `f3e6969d11d1bec17eba26e7ae0e629ad4af71dd`
- Build: `ARCH=x86-64 largeboards=yes nnue=no`
- License: GPL-3.0; upstream `Copying.txt`

Fairy-Stockfish supports Shogi and large boards, but this classical build is
explicitly a fallback—not a claim that it equals a current specialist Shogi
engine or neural model. A future specialist Shogi lane must receive an equally
reviewed source, license, size, and SHA-256 pin before replacement.

## Shared, sequential installation

The default shared root is `../.local/models` relative to this repository (the
Game workspace’s ignored model store). Override it only with a canonical
absolute path:

```bash
export GAME_MODEL_ROOT=/absolute/private/model/root
CONFIRM_ENGINE_DOWNLOAD=yes bash scripts/setup-engine.sh --engine all
bash scripts/verify-engine.sh --engine all
```

Individual selectors are `stockfish`, `pikafish`, and `fairy-stockfish`.
`all` runs them sequentially under one filesystem lock; it never launches
parallel downloads or builds.

The installer:

1. rejects `/`, the user home, source roots, non-canonical paths, symlink roots,
   symlink targets, and paths escaping `GAME_MODEL_ROOT`;
2. holds `${GAME_MODEL_ROOT}/.install.lock` for the full sequence;
3. downloads into an owner-only `mktemp` directory inside the same root;
4. verifies the reviewed byte count and SHA-256 before archive extraction;
5. rejects absolute/parent-traversing paths, links, and special archive entries
   before extraction, then rechecks for extracted symlinks;
6. requires UCI readiness and identity before moving a completed package into
   place; and
7. records source, archive, selected binary, install time, and binary SHA-256 in
   a private `receipt.json`.

Verification checks the receipt against `config/engines.env`, re-hashes the
selected binary, rechecks Fairy-Stockfish’s source Git object, validates CPU
support, and requires a successful UCI identity/readiness exchange.

The receipt is an owner-local installation record, not a cryptographic
signature. It detects accidental drift against the recorded binary hash; if the
model root itself is not trusted, delete that one reviewed engine directory and
reinstall from the pinned upstream artifact rather than trusting its receipt.

The archive is not retained after successful extraction. Installed artifacts,
receipts, sources, model weights, and locks remain outside Git. Distribution of
any GPL binary must satisfy the corresponding upstream source and license terms.

## Runtime authority boundary

An eventual adapter may provide a public position and bounded search budget.
Engine output must be intersected with deterministic `legalActions` and mapped
to a candidate ID issued for the same state token. It never mutates a game,
bypasses explicit confirmation, or becomes an “exact” teaching fact. Every
engine claim must carry engine ID, artifact/source pin, position, perspective,
depth, nodes, principal variation, and limit settings.
