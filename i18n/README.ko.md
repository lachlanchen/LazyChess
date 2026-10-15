[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner — apps and four buddies](https://lazying.art/media/brand/lazyingart-intro.gif)](https://lazying.art)

# LazyChess

*체스, 샹치, 쇼기에서 두기 전에 수를 확인하세요.*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](../docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess는 국제 체스, 샹치, 쇼기를 위한 로컬 우선 교육 스튜디오입니다. 학습자는 합법적 의도를 살피고, 변경되지 않는 가상 보드를 미리 보고, 출처가 표시된 교육 설명을 읽은 뒤 결정론적 규칙이 게임을 바꾸기 전에 명시적으로 확정합니다.

<!-- support:start -->
[![GitHub Sponsors](https://img.shields.io/badge/GitHub-Sponsors-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/lachlanchen)
[![LazyingArt Support](https://img.shields.io/badge/LazyingArt-Support-0EA5E9?style=for-the-badge)](https://chat.lazying.art/donate)
[![PayPal Support](https://img.shields.io/badge/PayPal-Support-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen)
[![Stripe Support](https://img.shields.io/badge/Stripe-Support-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400)
<!-- support:end -->

## 미리보기

![LazyChess 교육 스튜디오](../docs/images/app.png)

각 게임에 맞춘 포지션 맵은 정확한 칸 장악과 기물 접촉, 계산된 경로와 접촉만으로 계산한 교환 전망, 저자가 정한 계획, 범위가 제한된 엔진 변화를 나누어 보여 줍니다. 호버하거나 포커스하면 수를 두지 않고 같은 근거를 미리 볼 수 있으며, 명시적으로 확정해야만 게임이 바뀝니다. 앱의 11개 언어는 엄격한 카탈로그와 자리표시자 동등성을 공유하며, 아랍어는 문서 방향도 오른쪽에서 왼쪽으로 바꿉니다.

## 세 가지 규칙 범위

| 모드 | 결정론적 권한 | 현재 경계 |
| --- | --- | --- |
| 국제 체스 | `chess.js` 1.4.0 | 표준 합법성, 체크, 캐슬링, 앙파상, 승격, 체크메이트, 라이브러리 무승부 판정 |
| 샹치 | 자체 TypeScript 어댑터 | 이동, 마각, 포가, 강, 궁성, 장군 대면, 체크 안전, 합법 수 없음 패배를 포함한 교육 핵심. 반복/추격 판정은 보류 |
| 쇼기 | 자체 TypeScript 어댑터 | 이동, 투입, 잡은 말, 승격, 이보, 체크 안전, 합법 수 없음 패배를 포함한 교육 핵심. 반복, 연속 체크, 보병 투입 메이트는 보류 |

동반자는 설명만 하고 수를 두지 않습니다. 선택적 엔진은 범위가 제한된 근거만 제공하며 권위 있는 상태를 변경하지 않습니다.

## 포지션 맵과 분석

- **장악**은 폰의 공격, 샹치의 포가(砲架)와 마각, 쇼기의 말 투입을 합법적 이동성과 따로 구분하여 각 게임의 규칙에 맞는 공격과 방어를 보여 줍니다.
- **안전**은 방어되는 말, 공격받는 말, 무방비 말, 구출된 말, 새로 노출된 말을 표시하며, 단순한 접촉만으로 잡기가 확정된다고 가정하지 않습니다.
- **라인**은 게임별 장거리 기물의 경로, 열린 라인, 포가, 승격 구역을 그립니다. 바둑식 영역 구름을 옮겨 놓은 것이 아닙니다.
- **킹 존**은 체크되는 칸, 적이 장악한 인접 칸, 킹이 정확히 이동할 수 있는 합법 목적지를 비교하며, 샹치의 장군 대면 제약도 포함합니다.
- 새 보드는 명백히 가상적임을 밝힌 교육 제안 하나를 보여 줍니다. 호버·포커스·탭 미리보기는 전후를 비교하고, 오른쪽 클릭이나 Escape로 지울 수 있으며, **확정**만이 상태를 변경합니다.
- Stockfish와 Pikafish는 전문 엔진의 점수와 주요 변화(PV) 근거를 제한된 범위로 더할 수 있습니다. Fairy-Stockfish는 쇼기용 고전적 대체 엔진으로 명확히 표시됩니다. 각 엔진 레인은 루트 측 관점, 탐색 제한, 깊이, 노드 수, 시간, 소스·바이너리 출처, 그리고 게임 변형간 비교할 수 없는 엔진 고유의 점수 척도를 밝힙니다.

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
- 후보 수에 대한 응수는 대응을 강제하는 특징의 범위 제한 표본이지, 엔진 변화나 반드시 이어질 것이라는 예측이 아닙니다. 기물 교환 전망은 저자가 정의한 척도임을 명시한 말값을 사용합니다.
- 분석은 전체 상태 토큰과 행위자에 결합됩니다. 오래된 엔진 또는 후보 근거는 더 최근 포지션 위에 다시 그리지 않고 거부합니다.
- 샹치와 쇼기의 한계는 완전한 판정처럼 제시하지 않고 계속 표시합니다.

## 검증

```bash
npm run check
git diff --check
```

테스트는 대표 규칙, 분기가 많은 쇼기 분석, 상태 결합 후보, 불변 미리보기, 앙파상·포·장군 대면·말 투입 근거, 멱등성, 영속성 경쟁, 세션 재개, 범위가 제한된 엔진 프로토콜과 경로 안전, 11개 언어 동등성, 언어 저장, RTL 방향, 명시적 확정을 다룹니다.

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
