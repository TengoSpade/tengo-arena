# ui/screens

One folder per screen (`index.tsx` default-exports the screen component; local CSS and `text.ts` copy live in the folder; tests as `*.test.tsx`). Every screen is already registered in `ui/app/routes.ts` with a placeholder, so screen work never edits shared files.

| Folder | Route | Owner |
| --- | --- | --- |
| `home/` | `#/home` (hub: digest, next fixture, Continue) | WP6 |
| `new-game/` | `#/new-game` | WP6 |
| `club-select/` | `#/club-select` | WP6 |
| `squad/` | `#/squad` (roster, lineup of 5, rows, captain and vice-captain, preset per fighter, training emphasis) | WP6 |
| `fighter/` | `#/fighter/:id` | WP6 |
| `codex/` | `#/codex` (classes, abilities, races, traits) | WP6 |
| `league/` | `#/league` (wing and tier tables, Reckoning bracket) | WP7 |
| `fixtures/` | `#/fixtures` | WP7 |
| `match-report/` | `#/match/:fixtureId` | WP7 |
| `market/` | `#/market` (free agents, offers, renewals, trials rookies) | WP7 |
| `finances/` | `#/finances` | WP7 |
| `season-review/` | `#/season-review` | WP7 |
| `saves/` | `#/saves` | WP7 |
| `settings/` | `#/settings` | WP7 |
| `between-rounds/` | `#/between-rounds` (M1.1) | WP7 |
| `arena/` | `#/arena` (the live round) and `#/replay/:fixtureId` (M2, docs/design/_drafts/05-technical-m2.md; see `arena/README.md`) | WP-M2E |

Screens read `useStore()` signals and call store actions; they never mutate GameState. Tests provide a store through `StoreContext` (state from `core/testkit` `buildFixtureWorld()`).
