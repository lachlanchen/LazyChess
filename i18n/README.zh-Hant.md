[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyChess

*在國際象棋、中國象棋和日本將棋中，落子之前先看懂它。*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](../docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess 是面向國際象棋、中國象棋和日本將棋的本機優先教學工作室。學習者檢查合法意圖，預覽不可變的假想棋盤，閱讀帶來源標籤的教學內容，並在確定性規則改變棋局前明確確認。

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## 預覽

![LazyChess 教學工作室](../docs/images/app.png)

介面明確區分精確、計算、人工、引擎、模型和類比證據。應用程式內 11 種語言嚴格保持目錄鍵和預留位置一致；阿拉伯語還會把文件切換為由右至左。

## 三條規則通道

| 模式 | 確定性權威 | 目前邊界 |
| --- | --- | --- |
| 國際象棋 | `chess.js` 1.4.0 | 標準合法性、將軍、王車易位、吃過路兵、升變、將死及函式庫的和棋偵測 |
| 中國象棋 | 自編 TypeScript 適配器 | 教學核心包括走法、蹩馬腿、炮架、過河、九宮、將帥照面、將軍安全和無子可走判負；重複/長將長捉裁定暫緩 |
| 日本將棋 | 自編 TypeScript 適配器 | 教學核心包括走法、打入、持駒、升變、二步、將軍安全和無子可走判負；千日手、連續王手和打步詰暫緩 |

陪練夥伴只解釋，不走子。可選引擎僅提供範圍受限的證據，絕不修改權威狀態。

## 儲存庫地圖

| 路徑 | 用途 |
| --- | --- |
| `src/domain/` | 確定性規則、候選、教學內容和持久化 |
| `src/i18n/` | 11 個完整應用程式目錄及一致性測試 |
| `references/engines.md` | 可選引擎來源與已驗證安裝約定 |
| `scripts/` | 引擎安全、安裝和驗證檢查 |
| `docs/images/app.png` | 目前應用程式截圖 |

## 快速開始

需要 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
npm ci
npm run dev
```

Vite 預設綁定迴環位址。語言選擇透過明確的 11 值允許清單儲存；未知值會安全回退至英語。

## 確定性教學約定

- 候選 ID 綁定完整狀態、行動方和規範動作。
- 預覽衍生不可變狀態，從不寫入儲存。
- 舊候選、未知候選、錯誤行動方和終局後選擇均按關閉原則拒絕。
- 精確、計算、人工、引擎、模型和類比結論保留各自的來源標籤。
- 中國象棋和日本將棋的限制始終可見，不偽裝為完整裁定。

## 驗證

```bash
npm run check
git diff --check
```

測試涵蓋代表性規則、狀態綁定候選、冪等性、不可變預覽、持久化競爭、工作階段續玩、引擎路徑安全、11 語言一致性、語言儲存、RTL 方向和明確確認。

## 引用

如果在研究中使用 LazyChess，請引用本儲存庫。GitHub 會讀取 [CITATION.cff](../CITATION.cff)，並在專案頁顯示 **Cite this repository** 面板。

```bibtex
@software{chen_three_boards_teacher_2026,
  author  = {Chen, Lachlan},
  title   = {Three Boards Teacher: International Chess, Xiangqi, and Shogi},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/lachlanchen/LazyChess}
}
```

## 狀態與授權

教學應用程式採用本機優先設計和 MIT 授權。`chess.js` 使用 BSD-2-Clause。Stockfish、Pikafish 和 Fairy-Stockfish 是單獨安裝的 GPL-3.0 程式，不隨儲存庫打包。
