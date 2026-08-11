[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyChess

*체스, 샹치, 쇼기에서 두기 전에 수를 확인하세요.*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](../docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess는 국제 체스, 샹치, 쇼기를 위한 로컬 우선 교육 스튜디오입니다. 학습자는 합법적 의도를 살피고, 변경되지 않는 가상 보드를 미리 보고, 출처가 표시된 교육 설명을 읽은 뒤 결정론적 규칙이 게임을 바꾸기 전에 명시적으로 확정합니다.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## 미리보기

![LazyChess 교육 스튜디오](../docs/images/app.png)

인터페이스는 정확, 계산, 저자, 엔진, 모델, 비유 근거를 시각적으로 구분합니다. 앱의 11개 언어는 엄격한 카탈로그와 자리표시자 동등성을 공유하며, 아랍어는 문서 방향도 오른쪽에서 왼쪽으로 바꿉니다.

## 세 가지 규칙 범위

| 모드 | 결정론적 권한 | 현재 경계 |
| --- | --- | --- |
| 국제 체스 | `chess.js` 1.4.0 | 표준 합법성, 체크, 캐슬링, 앙파상, 승격, 체크메이트, 라이브러리 무승부 판정 |
| 샹치 | 자체 TypeScript 어댑터 | 이동, 마각, 포가, 강, 궁성, 장군 대면, 체크 안전, 합법 수 없음 패배를 포함한 교육 핵심. 반복/추격 판정은 보류 |
| 쇼기 | 자체 TypeScript 어댑터 | 이동, 투입, 잡은 말, 승격, 이보, 체크 안전, 합법 수 없음 패배를 포함한 교육 핵심. 반복, 연속 체크, 보병 투입 메이트는 보류 |

동반자는 설명만 하고 수를 두지 않습니다. 선택적 엔진은 범위가 제한된 근거만 제공하며 권위 있는 상태를 변경하지 않습니다.

## 저장소 지도

| 경로 | 목적 |
| --- | --- |
| `src/domain/` | 결정론적 규칙, 후보, 교육 요소, 영속성 |
| `src/i18n/` | 11개의 완전한 앱 카탈로그와 동등성 테스트 |
| `references/engines.md` | 선택적 엔진 출처와 검증된 설치 계약 |
| `scripts/` | 엔진 안전, 설치, 검증 검사 |
| `docs/images/app.png` | 현재 앱 스크린샷 |

## 빠른 시작

Node.js `^20.19.0` 또는 `>=22.12.0`이 필요합니다.

```bash
npm ci
npm run dev
```

Vite는 기본적으로 루프백에 바인딩됩니다. 언어 선택은 명시적인 11개 값 허용 목록으로 저장되며 알 수 없는 값은 안전하게 영어로 돌아갑니다.

## 결정론적 교육 계약

- 후보 ID는 전체 상태, 행위자, 정규 행동을 결합합니다.
- 미리보기는 불변 상태를 파생하며 저장소에 쓰지 않습니다.
- 오래되거나 알 수 없거나 행위자가 다르거나 게임 종료 뒤의 선택은 닫힌 방식으로 거부됩니다.
- 정확, 계산, 저자, 엔진, 모델, 비유 주장은 각각의 출처 라벨을 유지합니다.
- 샹치와 쇼기의 한계는 완전한 판정처럼 제시하지 않고 계속 표시합니다.

## 검증

```bash
npm run check
git diff --check
```

테스트는 대표 규칙, 상태 결합 후보, 멱등성, 불변 미리보기, 영속성 경쟁, 세션 재개, 엔진 경로 안전, 11개 언어 동등성, 언어 저장, RTL 방향, 명시적 확정을 다룹니다.

## 인용

연구에서 LazyChess를 사용한다면 이 저장소를 인용해 주세요. GitHub는 [CITATION.cff](../CITATION.cff)를 읽어 프로젝트 페이지에 **Cite this repository** 패널을 표시합니다.

```bibtex
@software{chen_three_boards_teacher_2026,
  author  = {Chen, Lachlan},
  title   = {Three Boards Teacher: International Chess, Xiangqi, and Shogi},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/lachlanchen/LazyChess}
}
```

## 상태와 라이선스

교육 앱은 로컬 우선이며 MIT 라이선스입니다. `chess.js`는 BSD-2-Clause입니다. Stockfish, Pikafish, Fairy-Stockfish는 별도로 설치하는 GPL-3.0 프로그램이며 번들에 포함되지 않습니다.
