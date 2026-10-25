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
  type FighterId,
  type GameState,
  type RegionId,
  type TierId,
} from '../model';
import { isValidSeed } from '../rng';
import { ok, type EngineError, type Result } from '../util';
import { applyToDraft } from './commands';
import type { GamePorts } from './ports';
import { clubsInOrder, compareIds, fail, rosterOf } from './shared';

export interface NewGameParams {
  /** From the platform's entropy (seedFromEntropy) or a typed custom seed. */
  rootSeed: string;
  options?: Partial<GameState['options']>;
}

/**
 * 03-league-economy §7: drop the lowest value-per-wage fighters to the pool
 * until the bill is <= 95% of WB, keeping >= the AI roster minimum.
 * OPEN: content field requested (economy.json budget.worldGenBillShareBp).
 */
export const PROVISIONAL_WORLDGEN_BILL_SHARE_BP = 9500;

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

  // Rosters at rosterFillOfCap of the cap (toward zero, 03 §1), clubs in clubs.json order.
  const gen = content.development.generation;
  const byClub = new Map<ClubId, FighterId[]>();
  for (const t of content.clubs.list) {
    const club = draft.clubs[asId<ClubId>(t.id)]!;
    const tier = content.tiers.require(club.tierId);
    const count = Math.trunc(tier.rosterCap * gen.worldGen.rosterFillOfCap);
    const ids: FighterId[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(ports.fighters.createFighter(draft, { kind: 'worldgen', potentialShift: tier.worldGenPotentialShift, regionId: club.regionId }, content));
    }
    byClub.set(club.id, ids);
  }
  // World-generation free agents (D-C: 2.5 per club), origins cycling through the regions.
  const faCount = Math.round(content.clubs.list.length * gen.worldGen.freeAgentsPerClub);
  const regions = content.regions.list;
  for (let i = 0; i < faCount; i++) {
    const regionId = asId<RegionId>(regions[i % regions.length]!.id);
    ports.fighters.createFighter(draft, { kind: 'free-agent', potentialShift: content.leagues.generationShifts.generatedFreeAgent, regionId }, content);
  }
  for (const id of Object.keys(draft.fighters).sort(compareIds) as FighterId[]) ports.economy.rollContractProfile(draft, id, content);

  // Contracts: 1/2/3 seasons in equal shares, at the fighter's ask for his club.
  for (const [clubId, ids] of byClub) {
    ids.forEach((fid, i) => {
      const seasons = content.economy.contracts.lengthsSeasons[i % content.economy.contracts.lengthsSeasons.length]!;
      const f = draft.fighters[fid]!;
      const wage = ports.economy.ask(draft, fid, clubId, seasons, content);
      f.clubId = clubId;
      f.status = 'active';
      f.freeAgency = null;
      f.contract = { clubId, wagePerWeek: wage, startSeason: 1, endSeason: seasons, signedAt: { season: 1, weekIndex: 1 }, dropClauseApplied: false };
    });
  }
  for (const f of Object.values(draft.fighters)) {
    if (f.status === 'free-agent' && f.freeAgency === null) {
      f.freeAgency = { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null };
    }
  }

  ports.league.setupSeason(draft, 1, content);
  // Season-1 intake (02 §2 step 3: Trials Day exists in the first season too).
  for (const id of ports.fighters.generateRookies(draft, content)) ports.economy.rollContractProfile(draft, id, content);
  ports.economy.initialFinances(draft, content);
  trimToBudget(ports, draft, content);

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

function trimToBudget(ports: GamePorts, draft: GameState, content: ContentDB): void {
  const minimum = content.economy.ai.rosterMinimum;
  for (const club of clubsInOrder(draft, content)) {
    const limit = Math.trunc((club.finance.wageBudgetPerWeek * PROVISIONAL_WORLDGEN_BILL_SHARE_BP) / 10000);
    let roster = rosterOf(draft, club.id);
    while (roster.length > minimum && ports.economy.wageBill(draft, club.id) > limit) {
      let worst: { id: FighterId; key: number } | null = null;
      for (const f of roster) {
        const wage = Math.max(1, f.contract?.wagePerWeek ?? 1);
        const key = Math.trunc((ports.ai.valueFighter(draft, club.id, f.id, content) * 1_000_000) / wage);
        if (worst === null || key < worst.key || (key === worst.key && compareIds(f.id, worst.id) > 0)) worst = { id: f.id, key };
      }
      const f = draft.fighters[worst!.id]!;
      f.clubId = null;
      f.status = 'free-agent';
      f.contract = null;
      f.freeAgency = { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null };
      roster = rosterOf(draft, club.id);
    }
  }
}
