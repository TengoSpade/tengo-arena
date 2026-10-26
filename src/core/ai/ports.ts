/**
 * The other modules' functions the AI reads, behind one seam so the AI can be
 * unit-tested with test doubles and run against stand-ins before the real
 * modules land (05 §9.2: "stubs first; integrate each package as it merges").
 * The AI only READS through these; every decision leaves as a Command.
 */
import * as economy from '../economy';
import * as fighters from '../fighters';

export interface AiPorts {
  /** typicalRoundDrain10 (M1.1): the projected-rest rule of the AI rotation. */
  fighters: Pick<typeof fighters, 'rating' | 'potential' | 'humanAge100' | 'isFit' | 'captaincy' | 'typicalRoundDrain10'>;
  /** wageBill is the bill the commitment rule uses (agreed renewal raises included: economy.committedWageBill). */
  economy: Pick<typeof economy, 'ask' | 'checkOffer' | 'wageBill' | 'pendingWages' | 'agreedRenewal' | 'preferredLength' | 'releasePayout'>;
}

export const realAiPorts: AiPorts = {
  fighters: {
    rating: fighters.rating,
    potential: fighters.potential,
    humanAge100: fighters.humanAge100,
    isFit: fighters.isFit,
    captaincy: fighters.captaincy,
    // INTERIM until WP-B implements fighters.typicalRoundDrain10 (a stub): a typical drain of 6.0 a round.
    typicalRoundDrain10: () => 60,
  },
  economy: {
    ask: economy.ask,
    checkOffer: economy.checkOffer,
    wageBill: economy.committedWageBill,
    pendingWages: economy.pendingWages,
    agreedRenewal: economy.agreedRenewal,
    preferredLength: economy.preferredLength,
    releasePayout: economy.releasePayout,
  },
};
