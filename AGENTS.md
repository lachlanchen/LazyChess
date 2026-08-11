# Chess product guidance

This repository implements the Game Teaching Contract for three chess-family
games. Read `../AGENTS.md` and `../docs/framework-contract.md` before changing
authority or persistence code.

- Keep `src/domain/` deterministic and free of learner-facing prose.
- Never let an engine, model, companion, or UI fabricate or apply an action.
- Preserve non-mutating preview and explicit confirmation.
- Keep the Xiangqi and Shogi subset labels accurate until every deferred
  adjudication rule has deterministic tests.
- Add every learner-facing string to all three catalogs and keep catalog-parity
  tests green.
- Do not commit `.local`, sessions, browser data, engine binaries, model weights,
  caches, or generated build output.
- Do not launch a second Game workspace noVNC stack. Follow the shared runtime
  policy before GUI or heavyweight engine work.

Run `npm run check`, full `npm audit`, `bash -n scripts/*.sh`, and
`git diff --check` before handoff. Browser-facing changes also require the shared
loopback noVNC/CDP review owned by the root workspace session.
