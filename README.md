# Arena League (working title)

Single-player PC management game: run a fantasy-mercenary club in an arena league. Lineups of 5 fighters battle automatically in a real-time 2D arena using ordered IF/THEN tactics rules; you manage the roster, contracts, wages, development and aging across seasons with promotion and relegation.

- Design package: [`docs/design/`](docs/design/) (01 vision, 02 flow, 03 systems, 04 presentation, 05 technical). Drafts in `docs/design/_drafts/`; the technical plan draft is [`docs/design/_drafts/05-technical.md`](docs/design/_drafts/05-technical.md).
- Research: [`docs/research.md`](docs/research.md) and [`docs/research-notes/`](docs/research-notes/).
- Theme content (names, classes, abilities, races, leagues, clubs, economy): [`content/default/*.json`](content/default/).

Current target: **M1 "Season MVP"** (a full playable season through match reports, with save/load).

## Requirements

- Node.js 22.12+ (developed on Node 24). On Windows, if `npm` is not on PATH, use `"C:\Program Files\nodejs\npm.cmd"`.

## Run

```sh
npm install          # once
npm run dev          # dev server at http://localhost:5173 (hot reload, including content JSON edits)
npm run build        # production bundle in dist/ (static, works offline)
npm run preview      # serve dist/ at http://localhost:4173
```

## Check

```sh
npm run typecheck    # tsc: core with no DOM/Node types, then the whole project
npm run lint         # ESLint (editor feedback for the architecture rules)
npm test             # Vitest: unit tests + architecture/purity checks
npm run check        # all three
```

## Headless harnesses

```sh
npm run balance -- --fights 5000 --seed balance-1   # per-class win rates from seeded headless fights
npm run soak -- --seasons 10 --seed soak-1          # N seasons headless with economy/age/league sanity checks
```

Both write a JSON report to `reports/` (git-ignored). In phase A they are stubs with the final report shape: balance runs placeholder fights until `core/sim` exists; soak reports every check as pending until `core/game` exists.

## Layout

```
content/<theme>/*.json   theme data (designers)
docs/                    research and design package
scripts/                 headless CLIs (balance, soak) and Node helpers
src/core/                pure, deterministic engine: no DOM, no PixiJS, no Math.random, no clocks
  util/ rng/ model/      foundation (architect)
  content/ tactics/ sim/ fighters/ league/ economy/ ai/ game/ save/ harness/
src/platform/            browser/desktop adapters (content loader, saves, clock, entropy)
src/ui/                  Preact + signals management UI; styles/ belongs to the UI designer
src/render/              PixiJS arena viewer (M2)
tests/architecture/      purity and module-boundary checks
```

Each module folder has a README with its owner, responsibility, rules and planned API. Module boundaries are enforced by `tests/architecture/rules.ts`.

## Browser preview

`.claude/launch.json` defines `arena-league-dev` (`npm run dev`, port 5173) for the Claude browser pane.
