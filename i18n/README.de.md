[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyChess

*Sieh den Zug, bevor du ihn spielst – in Schach, Xiangqi und Shogi.*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](../docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess ist ein Local-first-Lernstudio für internationales Schach, Xiangqi und Shogi. Lernende untersuchen legale Absichten, sehen ein unveränderliches hypothetisches Brett, lesen Lehraspekte mit Herkunftskennzeichnung und bestätigen ausdrücklich, bevor deterministische Regeln die Partie verändern.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Vorschau

![LazyChess-Lernstudio](../docs/images/app.png)

Die Oberfläche trennt exakte, berechnete, verfasste, Engine-, Modell- und Analogiebelege sichtbar. Elf App-Sprachen halten strikte Katalog- und Platzhalterparität; Arabisch stellt zusätzlich die Dokumentrichtung auf rechts-nach-links.

## Drei Regelbereiche

| Modus | Deterministische Autorität | Aktuelle Grenze |
| --- | --- | --- |
| Internationales Schach | `chess.js` 1.4.0 | Standardlegalität, Schach, Rochade, en passant, Umwandlung, Matt und Remiserkennung der Bibliothek |
| Xiangqi | Eigener TypeScript-Adapter | Lehrkern mit Bewegung, Pferdebein, Kanonenschirmen, Fluss, Palast, gegenüberstehenden Generälen, Schachsicherheit und Verlust ohne Zug; Wiederholungs-/Verfolgungswertung aufgeschoben |
| Shogi | Eigener TypeScript-Adapter | Lehrkern mit Bewegung, Einsetzungen, Figuren auf der Hand, Beförderung, Nifu, Schachsicherheit und Verlust ohne Zug; Wiederholung, Dauerschach und Bauern-Einsetzmatt aufgeschoben |

Der Begleiter erklärt, zieht aber nicht. Optionale Engines liefern nur begrenzte Belege und ändern niemals den maßgeblichen Zustand.

## Repository-Übersicht

| Pfad | Zweck |
| --- | --- |
| `src/domain/` | Deterministische Regeln, Kandidaten, Lehraspekte und Persistenz |
| `src/i18n/` | Elf vollständige App-Kataloge und Paritätstests |
| `references/engines.md` | Herkunft optionaler Engines und verifizierter Installationsvertrag |
| `scripts/` | Sicherheits-, Installations- und Verifikationsprüfungen für Engines |
| `docs/images/app.png` | Aktueller App-Screenshot |

## Schnellstart

Benötigt Node.js `^20.19.0` oder `>=22.12.0`.

```bash
npm ci
npm run dev
```

Vite bindet standardmäßig an Loopback. Die Sprachwahl wird über eine ausdrückliche Zulassungsliste mit 11 Werten gespeichert; unbekannte Werte fallen sicher auf Englisch zurück.

## Deterministischer Lehrvertrag

- Kandidaten-IDs binden vollständigen Zustand, Akteur und kanonische Aktion.
- Vorschauen leiten unveränderlichen Zustand ab und schreiben nie in den Speicher.
- Veraltete, unbekannte, akteursfalsche und nach Spielende gewählte Aktionen werden geschlossen abgelehnt.
- Exakte, berechnete, verfasste, Engine-, Modell- und Analogieaussagen behalten getrennte Herkunftslabels.
- Xiangqi- und Shogi-Grenzen bleiben sichtbar und werden nicht als vollständige Wertung dargestellt.

## Validierung

```bash
npm run check
git diff --check
```

Die Tests umfassen repräsentative Regeln, zustandsgebundene Kandidaten, Idempotenz, unveränderliche Vorschauen, Persistenzrennen, Sitzungsfortsetzung, Engine-Pfadsicherheit, 11-Sprachen-Parität, Sprachspeicherung, RTL-Richtung und ausdrückliche Bestätigung.

## Zitation

Wenn du LazyChess in der Forschung nutzt, zitiere das Repository. GitHub liest [CITATION.cff](../CITATION.cff) und zeigt auf der Projektseite das Feld **Cite this repository**.

```bibtex
@software{chen_three_boards_teacher_2026,
  author  = {Chen, Lachlan},
  title   = {Three Boards Teacher: International Chess, Xiangqi, and Shogi},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/lachlanchen/LazyChess}
}
```

## Status und Lizenz

Die Lernanwendung ist local-first und MIT-lizenziert. `chess.js` nutzt BSD-2-Clause. Stockfish, Pikafish und Fairy-Stockfish bleiben separat installierte GPL-3.0-Programme und werden nicht gebündelt.
