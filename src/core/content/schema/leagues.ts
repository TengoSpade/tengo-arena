/**
 * leagues.json: regions, tiers, wings, regular season, standings, the
 * Reckoning tournament, promotion/relegation, venues and the season calendar.
 * Owner: league-economy designer. Spec: docs/design/_drafts/03-league-economy.md
 * sys-league, sys-calendar, sys-tournament. Structure generated from the
 * content and curated by hand. Enumerated format keys name algorithms that
 * core/league implements; descriptive strings are documentation.
 */
import { z } from 'zod';
import { SEASON_WEEK_PHASES, STANDINGS_TIEBREAKERS, TOURNAMENT_ROUNDS, id, int } from './common';

export const LeaguesFileSchema = z.object({
  _doc: z.string().optional(),
  schemaVersion: z.number(),
  status: z.string(),
  regions: z.array(z.object({
    id: id(),
    name: z.string(),
    hostsLeagues: z.boolean(),
    description: z.string(),
    districts: z.array(z.object({
      id: id(),
      name: z.string(),
      description: z.string(),
    }).strict()).optional(),
    hostsLeaguesFromMilestone: z.string().optional(),
  }).strict()),
  tiers: z.array(z.object({
    id: id(),
    regionId: id(),
    level: int().min(1),
    name: z.string(),
    shortName: z.string(),
    clubCount: int().positive(),
    rosterCap: int().positive(),
    academyCapacity: int().nonnegative(),
    basePrestige: z.number(),
    ratingBand: z.object({
      min: z.number(),
      max: z.number(),
    }).strict(),
    tournamentName: z.string(),
    shieldName: z.string(),
    worldGenPotentialShift: z.number(),
  }).strict()),
  generationShifts: z.object({
    _doc: z.string().optional(),
    rookieIntake: z.number(),
    generatedFreeAgent: z.number(),
    worldGenFreeAgentsPerClub: z.string(),
  }).strict(),
  wings: z.object({
    _doc: z.string().optional(),
    list: z.array(z.object({
      id: id(),
      name: z.string(),
    }).strict()),
    size: int().positive(),
    serpentinePattern: z.array(id()),
  }).strict(),
  regularSeason: z.object({
    format: z.enum(['two_wing_double_round_robin_plus_cross']),
    matchesPerClub: int().positive(),
    matchBestOf: int().positive(),
    wingRounds: int().positive(),
    wingRoundMatchweeks: z.array(int()),
    crossWingMatchweeks: z.array(int()),
    secondHalf: z.enum(['mirror_first_half_venues_swapped']),
    slotAssignment: z.string(),
    crossPairing: z.object({
      _doc: z.string().optional(),
      week1: z.enum(['same_k', 'mirrored_k']),
      week2: z.enum(['same_k', 'mirrored_k']),
    }).strict(),
    seedOrder: z.object({
      _doc: z.string().optional(),
      season1: z.enum(['startPrestige_desc']),
      later: z.array(z.enum(['relegatedFromAbove', 'stayed', 'promotedFromBelow'])),
    }).strict(),
    byes: int().nonnegative(),
  }).strict(),
  standings: z.object({
    pointsByResult: z.object({
      "2-0": z.number(),
      "2-1": z.number(),
      "1-2": z.number(),
      "0-2": z.number(),
    }).strict(),
    tieBreakers: z.array(z.object({
      id: z.enum(STANDINGS_TIEBREAKERS),
      onlyIfAllTiedClubsMetEquallyOften: z.boolean().optional(),
      stream: z.enum(['schedule']).optional(),
    }).strict()),
    restartOnSplit: z.string(),
    tables: z.object({
      wing: z.string(),
      tier: z.string(),
    }).strict(),
  }).strict(),
  tournament: z.object({
    _doc: z.string().optional(),
    qualifiersPerWing: int().positive(),
    seeding: z.string(),
    rounds: z.array(z.object({
      id: z.enum(TOURNAMENT_ROUNDS),
      week: z.string(),
      bestOf: int().positive(),
      host: z.enum(['higher_seed', 'neutral']),
      pairs: z.array(z.tuple([z.union([int(), z.string()]), z.union([int(), z.string()])])).optional(),
      venueId: id().optional(),
      homeSideForSim: z.enum(['higher_seed']).optional(),
    }).strict()),
  }).strict(),
  promotionRelegation: z.object({
    _doc: z.string().optional(),
    relegatePerWing: int().nonnegative(),
    relegationPlace: z.string(),
    promotionRoutes: z.array(z.object({
      id: z.enum(['reckoning', 'shield']),
      rule: z.string(),
    }).strict()),
    promotionPlayoff: z.object({
      enabled: z.boolean(),
      milestone: z.string(),
    }).strict(),
  }).strict(),
  venues: z.array(z.object({
    id: id(),
    name: z.string(),
    city: z.string(),
    regionId: id(),
    use: z.string(),
  }).strict()),
  calendar: z.object({
    _doc: z.string().optional(),
    weeks: z.array(z.object({
      index: int().positive(),
      id: z.string().min(1),
      phase: z.enum(SEASON_WEEK_PHASES),
      label: z.string().optional(),
      commit: z.enum(['kick_off']).optional(),
      matchweek: int().optional(),
      fixtureKind: z.enum(['cross_wing']).optional(),
      round: z.enum(TOURNAMENT_ROUNDS).optional(),
    }).strict()),
    weekProcessingOrder: z.array(z.string()),
    seasonEndOrder: z.array(z.string()),
  }).strict(),
  /**
   * Optional: a content set without it (the frozen test fixture, whose hash pins the sim goldens) compacts after
   * DEFAULT_COMPACT_AI_MATCHES_AFTER_WEEKS (core/league). content/default always carries it.
   */
  matchRecords: z.object({
    _doc: z.string().optional(),
    /** Weeks after which a match between two other clubs is compacted (1-99; 23 or more: never in season). */
    compactAiMatchesAfterWeeks: int().min(1).max(99),
  }).strict().optional(),
}).strict();
