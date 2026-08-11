[English](README.md) · [العربية](i18n/README.ar.md) · [Español](i18n/README.es.md) · [Français](i18n/README.fr.md) · [日本語](i18n/README.ja.md) · [한국어](i18n/README.ko.md) · [Tiếng Việt](i18n/README.vi.md) · [中文 (简体)](i18n/README.zh-Hans.md) · [中文（繁體）](i18n/README.zh-Hant.md) · [Deutsch](i18n/README.de.md) · [Русский](i18n/README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyChess

*See the move before you make it—across Chess, Xiangqi, and Shogi.*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess is a local-first teaching studio for International Chess, Xiangqi, and Shogi. Learners inspect legal intentions, preview an immutable hypothetical board, read provenance-labeled teaching facets, and explicitly confirm before deterministic rules change the game.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Preview

![LazyChess teaching studio](docs/images/app.png)

The interface keeps exact, calculated, authored, engine, model, and analogy evidence visibly distinct. Eleven in-app languages share strict catalog and placeholder parity; Arabic also switches the document to right-to-left layout.

## Three rule lanes

| Mode | Deterministic authority | Current boundary |
| --- | --- | --- |
| International Chess | `chess.js` 1.4.0 | Standard legality, check, castling, en passant, promotion, mate, and library draw detection |
| Xiangqi | Authored TypeScript adapter | Teaching core with movement, horse legs, cannon screens, river, palace, flying generals, check safety, and no-move loss; repetition/chasing adjudication is deferred |
| Shogi | Authored TypeScript adapter | Teaching core with movement, drops, captures to hand, promotion, nifu, check safety, and no-move loss; repetition, perpetual check, and pawn-drop mate are deferred |

The companion explains but cannot move. Optional engines provide bounded evidence only and never mutate authoritative state.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/domain/` | Deterministic rules, candidates, teaching facets, and persistence |
| `src/i18n/` | Eleven complete application catalogs and parity tests |
| `references/engines.md` | Optional engine provenance and verified setup contract |
| `scripts/` | Engine safety, setup, and verification checks |
| `docs/images/app.png` | Current application screenshot |

## Quick start

Requires Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm ci
npm run dev
```

Vite binds to loopback by default. Locale choices are persisted through an explicit 11-value allowlist; unknown stored values fail safely to English.

## Deterministic teaching contract

- Candidate IDs bind the complete state, actor, and canonical action.
- Previews derive immutable state and never write storage.
- Stale, unknown, wrong-actor, and post-game selections fail closed.
- Exact, calculated, authored, engine, model, and analogy claims retain separate provenance labels.
- Xiangqi and Shogi limits remain visible instead of being presented as complete adjudication.

## Validation

```bash
npm run check
git diff --check
```

The suite covers representative rules, state-bound candidates, idempotency, immutable previews, persistence races, session resume, engine-path safety, 11-language catalog parity, locale persistence, RTL direction, and explicit confirmation.

## Citation

If you use LazyChess in research, cite the repository. GitHub reads [CITATION.cff](CITATION.cff) and shows a **Cite this repository** panel on the project page.

```bibtex
@software{chen_three_boards_teacher_2026,
  author  = {Chen, Lachlan},
  title   = {Three Boards Teacher: International Chess, Xiangqi, and Shogi},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/lachlanchen/LazyChess}
}
```

## Status and license

The teaching application is MIT licensed and local-first. `chess.js` is BSD-2-Clause. Stockfish, Pikafish, and Fairy-Stockfish remain separately installed GPL-3.0 programs and are not bundled.
