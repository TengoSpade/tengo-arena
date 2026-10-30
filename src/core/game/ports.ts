/**
 * Every other module function the season engine calls, behind one seam.
 * realGamePorts binds the real modules; tests and pre-integration runs pass
 * stand-ins (./stand-ins) or spies. The engine never calls a module except
 * through these ports, so "pipeline order" tests can record every call.
 */
import * as ai from '../ai';
import type { AiApi, AiPorts } from '../ai';
import * as economy from '../economy';
import * as fighters from '../fighters';
import * as league from '../league';
import * as sim from '../sim';
import * as tactics from '../tactics';

export interface GamePorts {
  /** M1.1: simulateRound (WP-A) is what the orchestrator calls; simulateMatch stays for the M1 whole-match path and tests. */
  sim: Pick<typeof sim, 'simulateMatch' | 'simulateRound'> & { engineVersion: number };
  tactics: Pick<typeof tactics, 'resolveTactics'>;
  fighters: Pick<
    typeof fighters,
    | 'createFighter'
    | 'humanAge100'
    | 'effectiveStats'
    | 'rating'
    | 'potential'
    | 'captaincy'
    | 'lineupChemistry'
    | 'isFit'
    | 'injuryChanceBp'
    | 'retirementChanceBp'
    | 'lineupCaptain'
    | 'captainChangeConsequences'
    | 'lineupLock'
    | 'applyMatchLifecycle'
    | 'weeklyLifecycle'
    | 'seasonEndDevelopment'
    | 'seasonEndRetirements'
    | 'offseasonRecovery'
    | 'generateRookies'
    | 'announceFinalSeasons'
    // ---- M1.1 (WP-B contract; 05 M1.1 addendum) ----
    | 'freshnessOf'
    | 'freshnessLabel'
    | 'ratingAtFreshness'
    | 'effectiveLevelUpMode'
    | 'autoPickChoice'
    | 'typicalRoundDrain10'
    | 'freshnessAfterRound'
    | 'xpAfterRound'
    | 'injuriesAfterRound'
    | 'freshnessBetweenRounds'
    | 'matchEndProgression'
    | 'resolveLevelUp'
    // M1.1 reads for levelUpView and policy picks (WP-B)
    | 'levelOptionLegal'
    | 'levelEtaMatches'
    | 'offerContextOf'
  >;
  league: Pick<
    typeof league,
    | 'nextCalendar'
    | 'seasonStartCalendar'
    | 'setupSeason'
    | 'fixturesForWeek'
    | 'clubFixture'
    | 'recordResult'
    | 'standings'
    | 'seedReckonings'
    | 'reckoningStage'
    | 'promotionRelegation'
    | 'applyTierMoves'
    | 'archiveSeason'
    | 'leagueSeasonColumns'
    | 'compactHistory'
    | 'compactAgedResults'
    | 'lastRegularWeekIndex'
    | 'isCompactedResult'
  >;
  economy: Pick<
    typeof economy,
    | 'post'
    | 'wageBill'
    | 'pendingWages'
    | 'marketWage'
    | 'ask'
    | 'checkOffer'
    | 'makeOffer'
    | 'withdrawOffer'
    | 'renewContract'
    | 'signTrialsRookie'
    | 'releaseFighter'
    | 'assignHiredBlades'
    | 'weeklyIncome'
    | 'weeklyCosts'
    | 'financialStatus'
    | 'releaseTrialsRookies'
    | 'resolveFreeAgentOffers'
    | 'topUpFreeAgentPool'
    | 'seasonPrizes'
    | 'updatePrestige'
    | 'contractExpiries'
    | 'poolMaintenance'
    | 'nextSeasonFinanceSetup'
    | 'initialFinances'
    | 'rollContractProfile'
    | 'assignTrialsRookies'
    | 'committedWageBill'
    | 'agreedRenewal'
    | 'preferredLength'
    | 'releasePayout'
    | 'capReliefAllowance'
  >;
  ai: AiApi;
}

export const realGamePorts: GamePorts = {
  sim: { simulateMatch: sim.simulateMatch, simulateRound: sim.simulateRound, engineVersion: sim.ENGINE_VERSION },
  tactics: { resolveTactics: tactics.resolveTactics },
  fighters: {
    createFighter: fighters.createFighter,
    humanAge100: fighters.humanAge100,
    effectiveStats: fighters.effectiveStats,
    rating: fighters.rating,
    potential: fighters.potential,
    captaincy: fighters.captaincy,
    lineupChemistry: fighters.lineupChemistry,
    isFit: fighters.isFit,
    injuryChanceBp: fighters.injuryChanceBp,
    retirementChanceBp: fighters.retirementChanceBp,
    lineupCaptain: fighters.lineupCaptain,
    captainChangeConsequences: fighters.captainChangeConsequences,
    lineupLock: fighters.lineupLock,
    applyMatchLifecycle: fighters.applyMatchLifecycle,
    weeklyLifecycle: fighters.weeklyLifecycle,
    seasonEndDevelopment: fighters.seasonEndDevelopment,
    seasonEndRetirements: fighters.seasonEndRetirements,
    offseasonRecovery: fighters.offseasonRecovery,
    generateRookies: fighters.generateRookies,
    announceFinalSeasons: fighters.announceFinalSeasons,
    freshnessOf: fighters.freshnessOf,
    freshnessLabel: fighters.freshnessLabel,
    ratingAtFreshness: fighters.ratingAtFreshness,
    effectiveLevelUpMode: fighters.effectiveLevelUpMode,
    autoPickChoice: fighters.autoPickChoice,
    offerContextOf: fighters.offerContextOf,
    typicalRoundDrain10: fighters.typicalRoundDrain10,
    freshnessAfterRound: fighters.freshnessAfterRound,
    xpAfterRound: fighters.xpAfterRound,
    injuriesAfterRound: fighters.injuriesAfterRound,
    freshnessBetweenRounds: fighters.freshnessBetweenRounds,
    matchEndProgression: fighters.matchEndProgression,
    resolveLevelUp: fighters.resolveLevelUp,
    levelOptionLegal: fighters.levelOptionLegal,
    levelEtaMatches: fighters.levelEtaMatches,
  },
  league: {
    nextCalendar: league.nextCalendar,
    seasonStartCalendar: league.seasonStartCalendar,
    setupSeason: league.setupSeason,
    fixturesForWeek: league.fixturesForWeek,
    clubFixture: league.clubFixture,
    recordResult: league.recordResult,
    standings: league.standings,
    seedReckonings: league.seedReckonings,
    reckoningStage: league.reckoningStage,
    promotionRelegation: league.promotionRelegation,
    applyTierMoves: league.applyTierMoves,
    archiveSeason: league.archiveSeason,
    leagueSeasonColumns: league.leagueSeasonColumns,
    compactHistory: league.compactHistory,
    compactAgedResults: league.compactAgedResults,
    lastRegularWeekIndex: league.lastRegularWeekIndex,
    isCompactedResult: league.isCompactedResult,
  },
  economy: {
    post: economy.post,
    wageBill: economy.wageBill,
    pendingWages: economy.pendingWages,
    marketWage: economy.marketWage,
    ask: economy.ask,
    checkOffer: economy.checkOffer,
    makeOffer: economy.makeOffer,
    withdrawOffer: economy.withdrawOffer,
    renewContract: economy.renewContract,
    signTrialsRookie: economy.signTrialsRookie,
    releaseFighter: economy.releaseFighter,
    assignHiredBlades: economy.assignHiredBlades,
    weeklyIncome: economy.weeklyIncome,
    weeklyCosts: economy.weeklyCosts,
    financialStatus: economy.financialStatus,
    releaseTrialsRookies: economy.releaseTrialsRookies,
    resolveFreeAgentOffers: economy.resolveFreeAgentOffers,
    topUpFreeAgentPool: economy.topUpFreeAgentPool,
    seasonPrizes: economy.seasonPrizes,
    updatePrestige: economy.updatePrestige,
    contractExpiries: economy.contractExpiries,
    poolMaintenance: economy.poolMaintenance,
    nextSeasonFinanceSetup: economy.nextSeasonFinanceSetup,
    initialFinances: economy.initialFinances,
    rollContractProfile: economy.rollContractProfile,
    assignTrialsRookies: economy.assignTrialsRookies,
    committedWageBill: economy.committedWageBill,
    agreedRenewal: economy.agreedRenewal,
    preferredLength: economy.preferredLength,
    releasePayout: economy.releasePayout,
    capReliefAllowance: economy.capReliefAllowance,
  },
  ai: ai.createAi(ai.realAiPorts),
};

/** The AI-relevant subset of game ports (to build an AI over the same implementations). */
export function aiPortsOf(ports: GamePorts): AiPorts {
  return {
    fighters: {
      rating: ports.fighters.rating,
      potential: ports.fighters.potential,
      humanAge100: ports.fighters.humanAge100,
      isFit: ports.fighters.isFit,
      captaincy: ports.fighters.captaincy,
      typicalRoundDrain10: ports.fighters.typicalRoundDrain10,
    },
    economy: {
      ask: ports.economy.ask,
      checkOffer: ports.economy.checkOffer,
      wageBill: ports.economy.committedWageBill,
      pendingWages: ports.economy.pendingWages,
      agreedRenewal: ports.economy.agreedRenewal,
      preferredLength: ports.economy.preferredLength,
      releasePayout: ports.economy.releasePayout,
    },
  };
}
