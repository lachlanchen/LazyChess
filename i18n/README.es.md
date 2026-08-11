[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyChess

*Mira la jugada antes de hacerla, en Ajedrez, Xiangqi y Shogi.*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](../docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess es un estudio didáctico local-first para Ajedrez internacional, Xiangqi y Shogi. El alumnado inspecciona intenciones legales, previsualiza un tablero hipotético inmutable, lee explicaciones con procedencia visible y confirma de forma explícita antes de que las reglas deterministas cambien la partida.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Vista previa

![Estudio didáctico LazyChess](../docs/images/app.png)

La interfaz mantiene separadas las evidencias exactas, calculadas, redactadas, de motor, de modelo y por analogía. Los once idiomas de la aplicación comparten paridad estricta de catálogos y variables; el árabe también activa la dirección de derecha a izquierda.

## Tres líneas de reglas

| Modo | Autoridad determinista | Límite actual |
| --- | --- | --- |
| Ajedrez internacional | `chess.js` 1.4.0 | Legalidad estándar, jaque, enroque, captura al paso, promoción, mate y detección de tablas de la biblioteca |
| Xiangqi | Adaptador TypeScript propio | Núcleo didáctico con movimiento, bloqueo del caballo, pantallas del cañón, río, palacio, generales enfrentados, seguridad ante jaque y derrota sin jugadas; se difiere la adjudicación por repetición/persecución |
| Shogi | Adaptador TypeScript propio | Núcleo didáctico con movimiento, colocaciones, capturas a la mano, promoción, nifu, seguridad ante jaque y derrota sin jugadas; se difieren repetición, jaque perpetuo y mate al colocar peón |

El acompañante explica, pero no mueve. Los motores opcionales solo aportan evidencia acotada y nunca mutan el estado autorizado.

## Mapa del repositorio

| Ruta | Finalidad |
| --- | --- |
| `src/domain/` | Reglas deterministas, propuestas, facetas didácticas y persistencia |
| `src/i18n/` | Once catálogos completos y pruebas de paridad |
| `references/engines.md` | Procedencia de motores opcionales y contrato de instalación verificada |
| `scripts/` | Comprobaciones de seguridad, instalación y verificación de motores |
| `docs/images/app.png` | Captura actual de la aplicación |

## Inicio rápido

Requiere Node.js `^20.19.0` o `>=22.12.0`.

```bash
npm ci
npm run dev
```

Vite escucha en loopback de forma predeterminada. La elección de idioma se guarda mediante una lista explícita de 11 valores; cualquier valor desconocido vuelve de forma segura al inglés.

## Contrato didáctico determinista

- Los identificadores de propuesta vinculan todo el estado, el actor y la acción canónica.
- Las vistas previas derivan un estado inmutable y nunca escriben en almacenamiento.
- Las selecciones obsoletas, desconocidas, de actor incorrecto o posteriores al final fallan de forma cerrada.
- Las afirmaciones exactas, calculadas, redactadas, de motor, modelo y analogía conservan etiquetas de procedencia separadas.
- Los límites de Xiangqi y Shogi siguen visibles y no se presentan como adjudicación completa.

## Validación

```bash
npm run check
git diff --check
```

La suite cubre reglas representativas, propuestas vinculadas al estado, idempotencia, vistas inmutables, carreras de persistencia, reanudación, seguridad de rutas de motores, paridad de 11 idiomas, persistencia de idioma, dirección RTL y confirmación explícita.

## Cita

Si usas LazyChess en investigación, cita el repositorio. GitHub lee [CITATION.cff](../CITATION.cff) y muestra el panel **Cite this repository** en la página del proyecto.

```bibtex
@software{chen_three_boards_teacher_2026,
  author  = {Chen, Lachlan},
  title   = {Three Boards Teacher: International Chess, Xiangqi, and Shogi},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/lachlanchen/LazyChess}
}
```

## Estado y licencia

La aplicación didáctica es local-first y tiene licencia MIT. `chess.js` usa BSD-2-Clause. Stockfish, Pikafish y Fairy-Stockfish siguen siendo programas GPL-3.0 instalados por separado y no se incluyen.
