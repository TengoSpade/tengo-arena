# core/model

**Owner:** architect. **Status:** phase A types implemented; fields marked `[phase B]` are provisional.

Engine and state types shared by every module. Plain JSON data only (no classes, Maps, Dates or functions inside state).

| File | Contents |
| --- | --- |
| `ids.ts` | branded ids (`ClubId`, `FighterId`, `FixtureId`, content ids), deterministic `allocateId` |
| `calendar.ts` | `Calendar`, `SeasonPhase` |
| `club.ts` | `Club`, `Lineup`, `TacticsAssignment` |
| `fighter.ts` | `Fighter` (provisional), `Contract`, `Injury`, `CareerStats` |
| `competition.ts` | `Competition`, `Fixture`, `Bracket`, `StandingRow` (derived) |
| `match.ts` | `MatchResult`, `RoundResult`, `LineupSnapshot`, `FighterMatchStats` |
| `events.ts` | fight event-stream envelope, engine-level events, `FightLog`, `hashEventStream` |
| `ledger.ts` | `Money`, `LedgerEntry`, `Ledger`, `LedgerCategory` |
| `news.ts` | `NewsItem` (text key + params, no prose) |
| `commands.ts` | `Command` union (the only way decisions change state), `CommandLogEntry` |
| `game-state.ts` | `GameState`, `STATE_SCHEMA_VERSION`, `SeasonRecord`, `WeekReport` |
| `save.ts` | `SaveEnvelope`, `SaveMeta`, `SAVE_FORMAT` |
| `factories.ts` | `createEmptyGameState` |

Content types (classes, abilities, races, traits, ...) are **not** here; core/content defines them from its schemas (phase B).

Changing a persisted type: bump `STATE_SCHEMA_VERSION`, add a migration in core/save, update docs/design 05. Request via the architect.
