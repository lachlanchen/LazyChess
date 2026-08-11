[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyChess

*Увидьте ход до того, как сделаете его — в шахматах, сянци и сёги.*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](../docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess — локальная учебная студия для международных шахмат, сянци и сёги. Ученик изучает допустимые замыслы, просматривает неизменяемую гипотетическую доску, читает учебные пояснения с метками происхождения и явно подтверждает ход до того, как детерминированные правила изменят партию.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Предпросмотр

![Учебная студия LazyChess](../docs/images/app.png)

Интерфейс визуально разделяет точные, рассчитанные, авторские, движковые, модельные доказательства и аналогии. Все 11 языков приложения строго совпадают по ключам каталога и параметрам; арабский также переключает документ справа налево.

## Три набора правил

| Режим | Детерминированная власть | Текущая граница |
| --- | --- | --- |
| Международные шахматы | `chess.js` 1.4.0 | Стандартная легальность, шах, рокировка, взятие на проходе, превращение, мат и определение ничьей библиотекой |
| Сянци | Авторский адаптер TypeScript | Учебное ядро: движение, блок ноги коня, экраны пушки, река, дворец, встреча генералов, безопасность при шахе и поражение без ходов; решения по повторению/преследованию отложены |
| Сёги | Авторский адаптер TypeScript | Учебное ядро: движение, сбросы, фигуры в руке, превращение, нифу, безопасность при шахе и поражение без ходов; повторение, вечный шах и мат сбросом пешки отложены |

Помощник объясняет, но не ходит. Необязательные движки дают только ограниченные доказательства и никогда не меняют авторитетное состояние.

## Карта репозитория

| Путь | Назначение |
| --- | --- |
| `src/domain/` | Детерминированные правила, варианты, учебные аспекты и сохранение |
| `src/i18n/` | Одиннадцать полных каталогов приложения и тесты равенства |
| `references/engines.md` | Происхождение необязательных движков и проверенный договор установки |
| `scripts/` | Проверки безопасности, установки и верификации движков |
| `docs/images/app.png` | Текущий снимок приложения |

## Быстрый старт

Требуется Node.js `^20.19.0` или `>=22.12.0`.

```bash
npm ci
npm run dev
```

Vite по умолчанию привязывается к loopback. Выбор языка хранится через явный список из 11 разрешённых значений; неизвестные значения безопасно возвращаются к английскому.

## Детерминированный учебный договор

- ID варианта связывает полное состояние, действующего игрока и каноническое действие.
- Просмотр выводит неизменяемое состояние и никогда не пишет в хранилище.
- Устаревший, неизвестный, принадлежащий не тому игроку или выбранный после завершения вариант закрыто отклоняется.
- Точные, рассчитанные, авторские, движковые, модельные утверждения и аналогии сохраняют отдельные метки происхождения.
- Ограничения сянци и сёги остаются видимыми и не выдаются за полное судейство.

## Проверка

```bash
npm run check
git diff --check
```

Тесты охватывают характерные правила, связанные с состоянием варианты, идемпотентность, неизменяемый просмотр, гонки сохранения, продолжение сессии, безопасность путей движка, равенство 11 языков, сохранение языка, направление RTL и явное подтверждение.

## Цитирование

Если вы используете LazyChess в исследовании, процитируйте репозиторий. GitHub читает [CITATION.cff](../CITATION.cff) и показывает панель **Cite this repository** на странице проекта.

```bibtex
@software{chen_three_boards_teacher_2026,
  author  = {Chen, Lachlan},
  title   = {Three Boards Teacher: International Chess, Xiangqi, and Shogi},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/lachlanchen/LazyChess}
}
```

## Статус и лицензия

Учебное приложение локальное и лицензировано по MIT. `chess.js` использует BSD-2-Clause. Stockfish, Pikafish и Fairy-Stockfish остаются отдельно устанавливаемыми программами GPL-3.0 и не входят в комплект.
