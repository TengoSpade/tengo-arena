/**
 * INTERIM (until WP-B merges): the M1.1 lifecycle hooks bound into
 * realGamePorts while core/fighters still stubs them. They keep the shipped
 * game playing the M1 lifecycle on top of the round-by-round orchestrator:
 * no per-round drain, XP or immediate injuries; at match end the M1
 * applyMatchLifecycle (XP for rounds started, injury rolls) runs on the
 * result. With Freshness at 100 and no mid-match injuries no swap happens, so
 * every match plays exactly as the M1 whole-match sim did.
 *
 * Delete this file and bind the real fighters functions in ports.ts when
 * WP-B lands.
 */
import type { ContentDB } from '../content';
import * as fighters from '../fighters';
import type { MatchProgressionOutcome } from '../fighters';
import type { GameState, MatchResult } from '../model';
import { engineError, err } from '../util';
import type { GamePorts } from './ports';

type Hooks = Pick<
  GamePorts['fighters'],
  | 'autoPickChoice'
  | 'typicalRoundDrain10'
  | 'freshnessAfterRound'
  | 'xpAfterRound'
  | 'injuriesAfterRound'
  | 'freshnessBetweenRounds'
  | 'matchEndProgression'
  | 'resolveLevelUp'
  | 'levelOptionLegal'
  | 'levelEtaMatches'
>;

/** Per-match XP and injuries the interim match end applied (read by the match news). */
export interface InterimMatchEnd extends MatchProgressionOutcome {
  m1: fighters.MatchLifecycleOutcome;
}

export const interimLifecycleHooks: Hooks = {
  autoPickChoice: (_f, offer) => ({ optionIndex: offer.options.length > 0 ? 0 : null, traitIndex: null }),
  typicalRoundDrain10: () => 60,
  freshnessAfterRound: () => undefined,
  xpAfterRound: () => undefined,
  injuriesAfterRound: () => [],
  freshnessBetweenRounds: () => undefined,
  matchEndProgression: (draft: GameState, result: MatchResult, content: ContentDB): InterimMatchEnd => {
    const m1 = fighters.applyMatchLifecycle(draft, result, content);
    return { benchXp: {}, levelUps: [], autoResolved: [], newsIds: m1.newsIds, m1 };
  },
  resolveLevelUp: () => err(engineError('levelup.unavailable', 'Level-ups arrive with the M1.1 lifecycle (WP-B)')),
  levelOptionLegal: () => true,
  levelEtaMatches: () => null,
};
