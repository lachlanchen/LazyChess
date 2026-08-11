[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyChess

*在国际象棋、中国象棋和日本将棋中，落子之前先看懂它。*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](../docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess 是面向国际象棋、中国象棋和日本将棋的本地优先教学工作室。学习者检查合法意图，预览不可变的假想棋盘，阅读带来源标签的教学内容，并在确定性规则改变棋局前明确确认。

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## 预览

![LazyChess 教学工作室](../docs/images/app.png)

界面明确区分精确、计算、人工、引擎、模型和类比证据。应用内 11 种语言严格保持目录键和占位符一致；阿拉伯语还会把文档切换为从右到左。

## 三条规则通道

| 模式 | 确定性权威 | 当前边界 |
| --- | --- | --- |
| 国际象棋 | `chess.js` 1.4.0 | 标准合法性、将军、王车易位、吃过路兵、升变、将死及库的和棋检测 |
| 中国象棋 | 自编 TypeScript 适配器 | 教学核心包括走法、蹩马腿、炮架、过河、九宫、将帅照面、将军安全和无子可走判负；重复/长将长捉裁定暂缓 |
| 日本将棋 | 自编 TypeScript 适配器 | 教学核心包括走法、打入、持驹、升变、二步、将军安全和无子可走判负；千日手、连续王手和打步诘暂缓 |

陪练伙伴只解释，不走子。可选引擎仅提供范围受限的证据，绝不修改权威状态。

## 仓库地图

| 路径 | 用途 |
| --- | --- |
| `src/domain/` | 确定性规则、候选、教学内容和持久化 |
| `src/i18n/` | 11 个完整应用目录及一致性测试 |
| `references/engines.md` | 可选引擎来源与已验证安装约定 |
| `scripts/` | 引擎安全、安装和验证检查 |
| `docs/images/app.png` | 当前应用截图 |

## 快速开始

需要 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
npm ci
npm run dev
```

Vite 默认绑定回环地址。语言选择通过明确的 11 值白名单保存；未知值会安全回退到英语。

## 确定性教学约定

- 候选 ID 绑定完整状态、行动方和规范动作。
- 预览派生不可变状态，从不写入存储。
- 旧候选、未知候选、错误行动方和终局后选择均按关闭原则拒绝。
- 精确、计算、人工、引擎、模型和类比结论保留各自的来源标签。
- 中国象棋和日本将棋的限制始终可见，不伪装为完整裁定。

## 验证

```bash
npm run check
git diff --check
```

测试覆盖代表性规则、状态绑定候选、幂等性、不可变预览、持久化竞争、会话续玩、引擎路径安全、11 语言一致性、语言保存、RTL 方向和明确确认。

## 引用

如果在研究中使用 LazyChess，请引用本仓库。GitHub 会读取 [CITATION.cff](../CITATION.cff)，并在项目页显示 **Cite this repository** 面板。

```bibtex
@software{chen_three_boards_teacher_2026,
  author  = {Chen, Lachlan},
  title   = {Three Boards Teacher: International Chess, Xiangqi, and Shogi},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/lachlanchen/LazyChess}
}
```

## 状态与许可

教学应用采用本地优先设计和 MIT 许可。`chess.js` 使用 BSD-2-Clause。Stockfish、Pikafish 和 Fairy-Stockfish 是单独安装的 GPL-3.0 程序，不随仓库打包。
