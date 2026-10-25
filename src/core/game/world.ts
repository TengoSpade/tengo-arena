/**
 * New game (02 §2 step 2; 03-league-economy §7 "Setup"): 48 clubs from
 * clubs.json, generated rosters at rosterFillOfCap of the cap, contracts of
 * 1/2/3 seasons in equal shares at each fighter's ask for his club, the
 * world-generation free-agent pool, finances, the season-1 schedule and the
 * season-1 rookie intake, then every club's captain, presets, training and
 * lineup by the AI rule (through commands). playerClubId stays null until
 * 'club.choose'.
 */
import type { ContentDB } from '../content';
import {
  asId,
  createEmptyGameState,
  type Club,
  type ClubId,
  type GameState,
  type RegionId,
  type TierId,
} from '../model';
import { Rng, STREAM, isValidSeed } from '../rng';
import { ok, type EngineError, type Result } from '../util';
import { applyToDraft } from './commands';
import type { GamePorts } from './ports';
import { clubsInOrder, fail, rosterOf } from './shared';

export interface NewGameParams {
  /** From the platform's entropy (seedFromEntropy) or a typed custom seed. */
  rootSeed: string;
  options?: Partial<GameState['options']>;
}

function newClub(content: ContentDB, t: ContentDB['clubs']['list'][number]): Club {
  const tier = content.tierByLevel(t.startTierLevel);
  return {
    id: asId<ClubId>(t.id),
    name: t.name,
    shortName: t.shortName,
    code: t.code,
    colors: { primary: t.colors.primary, secondary: t.colors.secondary },
    regionId: asId(t.regionId),
    districtId: asId(t.districtId),
    tierId: asId<TierId>(tier.id),
    wingId: null,
    aiPersonalityId: asId(t.aiPersonality),
    tacticsStyle: t.tacticsStyle,
    prestige: t.startPrestige,
    finance: {
      balance: 0,
      seasonBudget: 0,
      wageBudgetPerWeek: 0,
      status: 'healthy',
      debtWeeks: 0,
      registryDebt: 0,
      parachuteSeasonsLeft: 0,
      ascensionSeasonsLeft: 0,
    },
    captainId: null,
    viceCaptainId: null,
    captainAtLastLock: null,
    captainSince: null,
    captainNotFieldedStreak: 0,
    statuses: [],
    lineup: { fighters: [], matchCaptainId: null, tactics: {} },
    shortlist: [],
    history: [],
  };
}

/**
 * tech (WP5): world-generation rosters are generated toward the tier quality
 * bands (03 §1) through FighterSpec.ratingTarget. Without it, the potential
 * shifts alone give every tier a mean rating near 47 and Muster bills of about
 * 2x WB (soak, seed soak-1). Switch off when the generator's shifts are retuned.
 */
export const WORLDGEN_RATING_IN_TIER_BAND = true;

export function createWorld(ports: GamePorts, content: ContentDB, params: NewGameParams): Result<GameState, EngineError> {
  if (!isValidSeed(params.rootSeed)) return fail('world.seed', `Invalid world seed ${JSON.stringify(params.rootSeed)}`);
  const draft = createEmptyGameState({ rootSeed: params.rootSeed, content: content.ref, options: params.options });
  draft.calendar = ports.league.seasonStartCalendar(1, content);

  for (const t of content.clubs.list) {
    const club = newClub(content, t);
    draft.clubs[club.id] = club;
    draft.ai[club.id] = { voluntaryReleasesThisSeason: 0 };
    draft.ledger.openingBalances[club.id] = 0;
  }

  // Rosters at rosterFillOfCap of the cap (toward zero, 03 §1), clubs in clubs.json order. The fighters join
  // their club here without a contract: economy.initialFinances writes the contracts (1/2/3 seasons in equal
  // shares at each fighter's ask), the greed rolls, the finances and the 95%-of-WB trim.
  const gen = content.development.generation;
  for (const t of content.clubs.list) {
    const club = draft.clubs[asId<ClubId>(t.id)]!;
    const tier = content.tiers.require(club.tierId);
    const count = Math.trunc(tier.rosterCap * gen.worldGen.rosterFillOfCap);
    for (let i = 0; i < count; i++) {
      // 03 §1 tier quality bands: a roster fighter's typical rating lies in leagues.json tiers.ratingBand.
      // The target is the mean of two uniform draws in the band (STREAM.world), so most land mid-band.
      const rng = Rng.create(draft.rng.root, STREAM.world, 'roster-rating', club.id, i);
      const ratingTarget = Math.trunc((rng.int(tier.ratingBand.min, tier.ratingBand.max) + rng.int(tier.ratingBand.min, tier.ratingBand.max)) / 2);
      const spec = { kind: 'worldgen' as const, potentialShift: tier.worldGenPotentialShift, regionId: club.regionId };
      const id = ports.fighters.createFighter(draft, WORLDGEN_RATING_IN_TIER_BAND ? { ...spec, ratingTarget } : spec, content);
      const f = draft.fighters[id]!;
      f.clubId = club.id;
      f.status = 'active';
      f.freeAgency = null;
    }
  }
  // World-generation free agents (D-C: 2.5 per club), origins cycling through the regions.
  const faCount = Math.round(content.clubs.list.length * gen.worldGen.freeAgentsPerClub);
  const regions = content.regions.list;
  for (let i = 0; i < faCount; i++) {
    const regionId = asId<RegionId>(regions[i % regions.length]!.id);
    ports.fighters.createFighter(draft, { kind: 'free-agent', potentialShift: content.leagues.generationShifts.generatedFreeAgent, regionId }, content);
  }

  ports.league.setupSeason(draft, 1, content);
  // Season-1 intake (02 §2 step 3: Trials Day exists in the first season too).
  const rookies = ports.fighters.generateRookies(draft, content);
  ports.economy.initialFinances(draft, content);
  ports.economy.assignTrialsRookies(draft, rookies, 1, content);

  // Every club's captain, presets, training emphasis and lineup by the AI rule (commands, P-04).
  for (const club of clubsInOrder(draft, content)) {
    for (const cmd of ports.ai.planRoster(draft, club.id, content)) {
      const r = applyToDraft(ports, draft, cmd, content);
      if (!r.ok) return fail('world.setup', `World setup command ${cmd.type} for ${club.id} failed: ${r.error.message}`, { error: r.error });
    }
  }
  ports.fighters.announceFinalSeasons(draft, content);

  for (const club of Object.values(draft.clubs)) {
    if (rosterOf(draft, club.id).length < 5) return fail('world.roster', `${club.name} has fewer than 5 fighters after generation`);
  }
  return ok(draft);
}
