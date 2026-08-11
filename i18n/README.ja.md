[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyChess

*チェス、シャンチー、将棋で、指す前にその一手を見る。*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](../docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess は、国際チェス、シャンチー、将棋のためのローカルファーストな学習スタジオです。学習者は合法な意図を調べ、変更されない仮想盤面をプレビューし、出典ラベル付きの説明を読み、決定論的ルールが局面を変える前に明示的に確定します。

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## プレビュー

![LazyChess 学習スタジオ](../docs/images/app.png)

画面は、正確・計算・著者・エンジン・モデル・たとえの根拠を明確に分離します。アプリ内の11言語は厳密なカタログとプレースホルダーの同一性を保ち、アラビア語では文書も右から左になります。

## 3つのルール系統

| モード | 決定論的な権限 | 現在の範囲 |
| --- | --- | --- |
| 国際チェス | `chess.js` 1.4.0 | 標準合法手、チェック、キャスリング、アンパッサン、昇格、メイト、ライブラリによる引き分け検出 |
| シャンチー | TypeScript 製アダプター | 動き、馬の脚、砲台、河、宮、王の対面、王手安全、合法手なしの敗北を含む教育コア。反復・長将長捉の裁定は保留 |
| 将棋 | TypeScript 製アダプター | 動き、打ち、持ち駒、成り、二歩、王手安全、合法手なしの敗北を含む教育コア。千日手、連続王手、打ち歩詰めは保留 |

コンパニオンは説明するだけで着手しません。任意のエンジンは範囲を限定した根拠だけを提供し、権威ある状態を変更しません。

## リポジトリ構成

| パス | 目的 |
| --- | --- |
| `src/domain/` | 決定論的ルール、候補、教育ファセット、永続化 |
| `src/i18n/` | 11個の完全なアプリカタログと同一性テスト |
| `references/engines.md` | 任意エンジンの来歴と検証済み導入契約 |
| `scripts/` | エンジンの安全性・導入・検証チェック |
| `docs/images/app.png` | 現在のアプリ画面 |

## クイックスタート

Node.js `^20.19.0` または `>=22.12.0` が必要です。

```bash
npm ci
npm run dev
```

Vite は既定でループバックにバインドします。言語選択は明示的な11値の許可リストを通して保存され、不明な保存値は安全に英語へ戻ります。

## 決定論的な学習契約

- 候補 ID は完全な状態、手番、正規アクションを結びます。
- プレビューは不変状態を派生し、ストレージへ書き込みません。
- 古い、不明、手番違い、終局後の選択は閉じた形で拒否されます。
- 正確・計算・著者・エンジン・モデル・たとえの主張は別々の来歴ラベルを保ちます。
- シャンチーと将棋の制限は、完全裁定のように扱わず表示し続けます。

## 検証

```bash
npm run check
git diff --check
```

テストは代表的ルール、状態に結合した候補、冪等性、不変プレビュー、永続化競合、セッション再開、エンジンパス安全性、11言語同一性、言語保存、RTL 方向、明示的確定を網羅します。

## 引用

研究で LazyChess を利用する場合は、このリポジトリを引用してください。GitHub は [CITATION.cff](../CITATION.cff) を読み、プロジェクトページに **Cite this repository** パネルを表示します。

```bibtex
@software{chen_three_boards_teacher_2026,
  author  = {Chen, Lachlan},
  title   = {Three Boards Teacher: International Chess, Xiangqi, and Shogi},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/lachlanchen/LazyChess}
}
```

## 状態とライセンス

学習アプリはローカルファーストで MIT ライセンスです。`chess.js` は BSD-2-Clause です。Stockfish、Pikafish、Fairy-Stockfish は個別導入する GPL-3.0 プログラムで、同梱されません。
