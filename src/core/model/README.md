# core/model

**Owner:** architect. **Status:** complete GameState and engine types (phase B). Changes go through the architect (STATE_SCHEMA_VERSION + migration).

Engine and state types shared by every module. Plain JSON data only.

| File | Contents |
| --- | --- |
| `ids.ts` | branded ids; clubs use clubs.json ids; identity ids for competitions and fixtures (`lg:`/`rk:`); allocated fighter and news ids |
| `calendar.ts` | `Calendar` (season, weekIndex, weekId, phase), `GameTime` |
| `club.ts` | `Club`, `ClubFinance`, captaincy fields, `Lineup`, `TacticsAssignment`, `ClubSeasonRow` |
| `fighter.ts` | `Fighter` (stored lifecycle inputs; stats are derived), `Contract`, `Injury`, traits, statuses, career and season counters, history rows; reserved `academy` (M5) |
| `competition.ts` | `Competition` (league with wings, or Reckoning with bracket), `Fixture`, `Bracket`, `StandingRow` |
| `match.ts` | sim inputs (`MatchInput`, `SideInput`, `FightFighterInput`) and the committed `MatchResult` (with the compacted-result fields `fighterTotals` and `fielded`), `RoundResult`, `FighterMatchStats`, `DownRecord` |
| `fielded.ts` | `fieldedFive(result, side)` (a side's round-1 five from the sim input, or from `fielded` once the result is compacted) and `compactFielded`: the one way to read who a club fielded from a stored result |
| `events.ts` | fight event stream: envelope, header, the full `FightEvent` union, `SUMMARY_EVENT_TYPES`, `hashEventStream` |
| `ledger.ts` | `Gold`, `LEDGER_CATEGORIES`, `LedgerEntry`, `Ledger` |
| `market.ts` | offers, negotiations, trials rookies, AI memory, reserved `KnowledgeEntry` (M4) |
| `news.ts` | `NewsItem` (text key + params) |
| `commands.ts` | the `Command` union (the only way decisions change state) |
| `history.ts` | `SeasonRecord`, tier records, retirements |
| `report.ts` | derived views: `MatchReport`, `WeekReport`, `SeasonEndReport`, `Blocker` |
| `game-state.ts` | `GameState`, `GameOptions` (M1 defaults), `STATE_SCHEMA_VERSION` (4: v3 added the M1.1 fields, v4 the optional `MatchResult.fielded`) |
| `alumni.ts` | `Alumnus` (slim record of a fighter who left), `alumnusOf`, `personOf`, `personName` (current fighter or alumnus) |
| `indexes.ts` | derived indexes of transition drafts (club rosters, free-agent pool, results per club and season, fixtures per week) and the only writers of membership and of the fighters / results / fixtures maps: `setMembership`, `putFighter`, `removeFighter`, `putResult`, `removeResult`, `putFixture`, `removeFixture` (enforced by tests/architecture/indexed-writes.test.ts) |
| `transition.ts` | `beginTransition`: the per-transition draft (mutable parts copied, write-once `results` / `history` / `alumni` shared and frozen) |
| `save.ts` | `SaveEnvelope`, `SaveMeta`, `SaveError` codes |
| `factories.ts` | `createEmptyGameState` |

Content types live in core/content (inferred from the schemas).
