/**
 * zod schemas of the persisted GameState and SaveEnvelope (structure only;
 * references are checked in validate.ts). They mirror core/model exactly and
 * are strict: an unknown key is an error, so a module that writes a field the
 * model does not declare is caught by the soak and by load (05 §5: saves are
 * never repaired silently). Any core/model change bumps STATE_SCHEMA_VERSION,
 * adds a migration, and updates these schemas in the same change.
 */
import { z } from 'zod';
import { LEDGER_CATEGORIES, SAVE_FORMAT, SEASON_PHASES } from '../model';

const int = z.number().int();
const nonNegInt = z.number().int().min(0);
const str = z.string();
const id = z.string().min(1);
const nullableId = id.nullable();
const intRecord = z.record(z.string(), int);

const gameTime = z.strictObject({ season: int, weekIndex: int });

// ---- club ----------------------------------------------------------------------------------------------

const tacticsAssignment = z.union([
  z.strictObject({ kind: z.literal('preset'), presetId: id }),
  z.strictObject({
    kind: z.literal('custom'),
    name: str,
    rules: z.array(z.unknown()),
    stance: z.enum(['aggressive', 'steady', 'cautious']),
  }),
]);

const startingRow = z.enum(['front', 'back']);

const lineup = z.strictObject({
  fighters: z.array(z.strictObject({ fighterId: id, row: startingRow })).max(5),
  matchCaptainId: nullableId,
  tactics: z.record(z.string(), tacticsAssignment),
});

const clubFinance = z.strictObject({
  balance: int,
  seasonBudget: int,
  wageBudgetPerWeek: int,
  status: z.enum(['healthy', 'watch', 'embargo']),
  debtWeeks: nonNegInt,
  registryDebt: nonNegInt,
  parachuteSeasonsLeft: nonNegInt,
  ascensionSeasonsLeft: nonNegInt,
});

const clubSeasonRow = z.strictObject({
  season: int,
  tierId: id,
  wingId: nullableId,
  wingPosition: int,
  tierPosition: int,
  points: int,
  matchWins: int,
  matchLosses: int,
  reckoning: z.enum(['quarterfinal', 'semifinal', 'final', 'champion']).nullable(),
  shield: z.boolean(),
  promoted: z.boolean(),
  relegated: z.boolean(),
  income: int,
  costs: int,
  endBalance: int,
  prestigeEnd: int,
});

const club = z.strictObject({
  id,
  name: str,
  shortName: str,
  code: str,
  colors: z.strictObject({ primary: str, secondary: str }),
  regionId: id,
  districtId: id,
  tierId: id,
  wingId: nullableId,
  aiPersonalityId: id,
  tacticsStyle: z.enum(['aggressive', 'steady', 'cautious']),
  prestige: int,
  finance: clubFinance,
  captainId: nullableId,
  viceCaptainId: nullableId,
  captainAtLastLock: nullableId,
  captainSince: gameTime.nullable(),
  captainNotFieldedStreak: nonNegInt,
  statuses: z.array(z.strictObject({ id, remainingWeeks: int.nullable(), since: gameTime })),
  lineup,
  shortlist: z.array(id),
  history: z.array(clubSeasonRow),
});

// ---- fighter -----------------------------------------------------------------------------------------------

const personName = z.strictObject({ given: str, family: str.nullable(), epithet: str.nullable(), full: str });

const careerStats = z.strictObject({
  matches: nonNegInt,
  roundsStarted: nonNegInt,
  roundsWon: nonNegInt,
  downsInflicted: nonNegInt,
  downsSuffered: nonNegInt,
  damageDealt: nonNegInt,
  healingDone: nonNegInt,
  xpTotal: nonNegInt,
  proSeasons: nonNegInt,
  matchweeksAtClub: nonNegInt,
  matchweeksAsClubCaptain: nonNegInt,
  peakRating: nonNegInt,
  titles: nonNegInt,
});

const seasonCounters = z.strictObject({
  xp: nonNegInt,
  matchesStarted: nonNegInt,
  roundsStarted: nonNegInt,
  emphasisWeeks: z.strictObject({ balanced: nonNegInt, body: nonNegInt, mind: nonNegInt }),
  captainWeeksByClub: intRecord,
  injuries: nonNegInt,
});

const fighterSeasonRow = z.strictObject({
  season: int,
  age: int,
  clubId: nullableId,
  rating: int,
  potential: int,
  stats: intRecord,
  xp: int,
  usageBp: int,
  injuries: int,
  traitsGained: z.array(id),
  traitsLost: z.array(id),
});

const injury = z.strictObject({
  severity: z.enum(['knock', 'minor', 'moderate', 'serious']),
  weeksOut: nonNegInt,
  fixtureId: nullableId,
  round: int.nullable(),
  causeFighterId: nullableId,
  damageBp: int,
  since: gameTime,
  careerEnding: z.boolean().optional(),
});

const contract = z.strictObject({
  clubId: id,
  wagePerWeek: nonNegInt,
  startSeason: int,
  endSeason: int,
  signedAt: gameTime,
  dropClauseApplied: z.boolean(),
  next: z.strictObject({ wagePerWeek: nonNegInt, endSeason: int }).nullable().optional(),
});

const fighter = z.strictObject({
  id,
  name: personName,
  raceId: id,
  classId: id,
  originRegionId: id,
  age: nonNegInt,
  debutSeason: int,
  clubId: nullableId,
  status: z.enum(['active', 'free-agent', 'retired', 'hired-blade', 'academy']),
  contract: contract.nullable(),
  contractProfile: z.strictObject({ greedBp: int }),
  freeAgency: z
    .strictObject({
      unsignedSeasonEnds: nonNegInt,
      formerClubId: nullableId,
      releasedByClubId: nullableId,
      releasedSeason: int.nullable(),
      enteredAt: gameTime.optional(),
    })
    .nullable(),
  potentialRoll: int,
  paceId: id,
  cap100: intRecord,
  bloom: intRecord,
  dev100: z.strictObject({ physical: int, mental: int }),
  wear100: intRecord,
  traits: z.array(z.strictObject({ id, gainedSeason: int, source: z.enum(['worldgen', 'rolled', 'event', 'scar']) })),
  statuses: z.array(
    z.strictObject({ id, remainingWeeks: int.nullable(), remainingMatches: int.nullable(), since: gameTime }),
  ),
  injury: injury.nullable(),
  trainingEmphasis: z.enum(['balanced', 'body', 'mind']),
  finalSeason: z.boolean(),
  career: careerStats,
  season: seasonCounters,
  history: z.array(fighterSeasonRow),
  learnedAbilityIds: z.array(id),
  academy: z.strictObject({ programId: id, sinceSeason: int, progressBp: int }).nullable(),
});

// ---- competitions and fixtures -------------------------------------------------------------------------------

const standingRow = z.strictObject({
  clubId: id,
  position: int,
  played: int,
  matchWins: int,
  matchLosses: int,
  points: int,
  roundsWon: int,
  roundsLost: int,
  downsInflicted: int,
  downsSuffered: int,
  results: z.strictObject({ '2-0': int, '2-1': int, '1-2': int, '0-2': int }),
  form: z.array(z.enum(['W', 'L'])),
});

const bracketSlot = z.union([
  z.strictObject({ kind: z.literal('seed'), seed: int }),
  z.strictObject({ kind: z.literal('winner-of'), roundId: z.enum(['quarterfinal', 'semifinal']), slot: int }),
]);

const bracket = z.strictObject({
  seeds: z.array(id),
  rounds: z.array(
    z.strictObject({
      roundId: z.enum(['quarterfinal', 'semifinal', 'final']),
      weekId: id,
      bestOf: int,
      ties: z.array(
        z.strictObject({ slot: int, home: bracketSlot, away: bracketSlot, fixtureId: nullableId, winnerClubId: nullableId }),
      ),
    }),
  ),
  championId: nullableId,
  runnerUpId: nullableId,
});

const competition = z.strictObject({
  id,
  kind: z.enum(['league', 'reckoning']),
  season: int,
  tierId: id,
  clubIds: z.array(id),
  wings: z.array(z.strictObject({ wingId: id, clubIds: z.array(id) })),
  seedOrder: z.array(id),
  fixtureIds: z.array(id),
  bracket: bracket.nullable(),
  status: z.enum(['scheduled', 'in-progress', 'completed']),
});

const fixtureStage = z.enum(['league', 'quarterfinal', 'semifinal', 'final']);

const fixture = z.strictObject({
  id,
  competitionId: id,
  season: int,
  tierId: id,
  weekIndex: int,
  weekId: id,
  stage: fixtureStage,
  matchweek: int.nullable(),
  wing: nullableId,
  homeClubId: id,
  awayClubId: id,
  bestOf: int,
  venueId: nullableId,
  status: z.enum(['scheduled', 'played']),
});

// ---- match results ----------------------------------------------------------------------------------------------

const fightFighterInput = z.strictObject({
  fighterId: id,
  classId: id,
  raceId: id,
  row: startingRow,
  slot: int,
  stats: intRecord,
  captainQuality: int,
  traitIds: z.array(id),
  tactics: tacticsAssignment,
  rating: int,
  combatMods: z
    .strictObject({
      hpMult: z.number().optional(),
      armorFlat: z.number().optional(),
      wardFlat: z.number().optional(),
      moveSpeedMult: z.number().optional(),
      tenacityFlat: z.number().optional(),
    })
    .optional(),
});

const sideInput = z.strictObject({
  clubId: id,
  fighters: z.array(fightFighterInput),
  captainIndex: int,
  viceCaptainIndex: int.nullable(),
  chemistry: int,
});

const matchInput = z.strictObject({ seed: id, bestOf: int, home: sideInput, away: sideInput });

const roundResult = z.strictObject({
  round: int,
  seed: id,
  winner: z.enum(['home', 'away']),
  endReason: z.enum(['elimination', 'time-limit']),
  tiebreakStep: z.enum(['fighters_standing', 'hp_fraction_sum', 'damage_dealt', 'first_down', 'seeded_coin']).nullable(),
  durationTicks: nonNegInt,
  survivors: z.strictObject({ home: int, away: int }),
  downs: z.strictObject({ home: int, away: int }),
  finalHp: z.array(int),
  checksum: str,
  eventHash: str.nullable(),
});

const downRecord = z.strictObject({
  round: int,
  tick: int,
  byFighterId: nullableId,
  abilityId: nullableId,
  hit: int,
  overkill: int,
  damageTakenRound: int,
  maxHp: int,
});

const fighterMatchStats = z.strictObject({
  clubId: id,
  roundsPlayed: int,
  roundsSurvived: int,
  ticksOnArena: int,
  damageDealt: int,
  damageToShields: int,
  damageTaken: int,
  healingDone: int,
  shieldingDone: int,
  overheal: int,
  ccAppliedTicks: int,
  ccReceivedTicks: int,
  downsInflicted: int,
  downsSuffered: int,
  assists: int,
  focusSpent: int,
  casts: intRecord,
  ruleFires: z.array(int),
  ruleCommittedTicks: z.array(int),
  rulesNeverFired: z.array(int),
  downs: z.array(downRecord),
  opponentIds: z.array(id),
  roundDamageTaken: z.array(int).optional(),
  roundMaxHp: z.array(int).optional(),
});

const matchResult = z.strictObject({
  fixtureId: id,
  competitionId: id,
  stage: fixtureStage,
  season: int,
  weekIndex: int,
  weekId: id,
  homeClubId: id,
  awayClubId: id,
  engineVersion: int,
  contentHash: str,
  input: matchInput,
  rounds: z.array(roundResult),
  score: z.strictObject({ home: nonNegInt, away: nonNegInt }),
  winnerClubId: id,
  fighterStats: z.record(z.string(), fighterMatchStats),
  mvpFighterId: nullableId,
  hiredBladeIds: z.array(id),
});

// ---- market, ledger, news, history ------------------------------------------------------------------------------

const market = z.strictObject({
  offers: z.array(
    z.strictObject({
      clubId: id,
      fighterId: id,
      wagePerWeek: nonNegInt,
      seasons: int.min(1),
      madeAt: gameTime,
      isCounterAcceptance: z.boolean(),
    }),
  ),
  negotiations: z.array(
    z.strictObject({
      fighterId: id,
      clubId: id,
      season: int,
      kind: z.enum(['free-agent', 'renewal']),
      patienceLeft: int,
      counterWage: int.nullable(),
      validUntilWeek: int.nullable(),
    }),
  ),
  trialsRookies: z.record(z.string(), z.array(id)),
  refusalsThisSeason: intRecord,
  releasedThisSeason: z.array(z.strictObject({ fighterId: id, clubId: id })),
});

const ledger = z.strictObject({
  nextSeq: int.min(1),
  openingBalances: intRecord,
  entries: z.array(
    z.strictObject({
      seq: int,
      season: int,
      weekIndex: int,
      clubId: id,
      amount: int,
      category: z.enum(LEDGER_CATEGORIES),
      fighterId: id.optional(),
      fixtureId: id.optional(),
    }),
  ),
});

const newsItem = z.strictObject({
  id,
  at: gameTime,
  key: str,
  params: z.record(z.string(), z.union([z.string(), z.number()])),
  clubId: nullableId,
  refs: z.strictObject({ fighterId: id.optional(), fixtureId: id.optional(), otherClubId: id.optional() }),
  importance: z.enum(['info', 'notable', 'urgent']),
  read: z.boolean(),
});

const reckoningStage = z.enum(['quarterfinal', 'semifinal', 'final', 'champion']);

const alumnus = z.strictObject({
  id,
  name: personName,
  raceId: id,
  classId: id,
  originRegionId: id,
  debutSeason: int,
  leftSeason: int,
  age: nonNegInt,
  lastClubId: nullableId,
  cause: z.enum(['age', 'career-ending-injury', 'left-unsigned', 'hired-blade']),
  career: careerStats,
  traitIds: z.array(id),
  seasons: z.array(z.strictObject({ season: int, clubId: nullableId, rating: int })),
});

const seasonRecord = z.strictObject({
  season: int,
  tiers: z.array(
    z.strictObject({
      tierId: id,
      wingTables: z.array(z.strictObject({ wingId: id, rows: z.array(standingRow) })),
      tierTable: z.array(standingRow),
      reckoningChampionId: nullableId,
      reckoningRunnerUpId: nullableId,
      shieldWinnerId: nullableId,
      promotedIds: z.array(id),
      relegatedIds: z.array(id),
      reckoningStages: z.record(z.string(), reckoningStage).optional(),
    }),
  ),
  retirements: z.array(
    z.strictObject({
      fighterId: id,
      age: int,
      lastClubId: nullableId,
      proSeasons: int,
      peakRating: int,
      cause: z.enum(['age', 'career-ending-injury', 'left-unsigned']),
    }),
  ),
  rookieIds: z.array(id),
  development: z
    .array(
      z.strictObject({
        fighterId: id,
        ageBefore: int,
        ageAfter: int,
        ratingBefore: int,
        ratingAfter: int,
        attributeDeltas: intRecord,
        potentialChange: int.optional(),
        retired: z.boolean().optional(),
      }),
    )
    .optional(),
  wageRaises: z.array(z.strictObject({ clubId: id, fighterId: id, from: nonNegInt, to: nonNegInt })).optional(),
});

// ---- state and envelope ---------------------------------------------------------------------------------------

export const GameStateSchema = z.strictObject({
  schemaVersion: int,
  content: z.strictObject({ id, hash: str }),
  rng: z.strictObject({ root: id, counters: intRecord }),
  ids: z.strictObject({ fighter: int.min(1), news: int.min(1) }),
  calendar: z.strictObject({
    season: int.min(1),
    weekIndex: int.min(1),
    weekId: nullableId,
    phase: z.enum(SEASON_PHASES as unknown as [string, ...string[]]),
  }),
  options: z.strictObject({ trainingEmphasis: z.boolean(), patronGoals: z.boolean(), retirement: z.boolean() }),
  playerClubId: nullableId,
  clubs: z.record(z.string(), club),
  fighters: z.record(z.string(), fighter),
  competitions: z.record(z.string(), competition),
  fixtures: z.record(z.string(), fixture),
  results: z.record(z.string(), matchResult),
  market,
  ai: z.record(z.string(), z.strictObject({ voluntaryReleasesThisSeason: nonNegInt })),
  ledger,
  news: z.array(newsItem),
  history: z.array(seasonRecord),
  knowledge: z.null(),
  alumni: z.record(z.string(), alumnus),
});

export const SaveMetaSchema = z.strictObject({
  slotId: id,
  kind: z.enum(['manual', 'auto']),
  label: str,
  savedAt: str,
  gameVersion: str,
  season: int,
  weekIndex: int,
  weekId: nullableId,
  phase: z.enum(SEASON_PHASES as unknown as [string, ...string[]]),
  playerClubId: nullableId,
  playerClubName: str.nullable(),
  playtimeSec: nonNegInt,
});

/** Envelope without the state (the state is checked after checksum and migrations). */
export const EnvelopeHeaderSchema = z.object({
  format: z.literal(SAVE_FORMAT),
  schemaVersion: int.min(1),
  engineVersion: int,
  content: z.strictObject({ id, hash: str }),
  meta: SaveMetaSchema,
  checksum: z.string().regex(/^[0-9a-f]{32}$/),
  state: z.unknown(),
  commandLog: z.array(z.unknown()).optional(),
});

export function formatZodPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const p of path) out += typeof p === 'number' ? `[${p}]` : out === '' ? String(p) : `.${String(p)}`;
  return out;
}
