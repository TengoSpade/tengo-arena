/**
 * The other modules' functions the AI reads, behind one seam so the AI can be
 * unit-tested with test doubles and run against stand-ins before the real
 * modules land (05 §9.2: "stubs first; integrate each package as it merges").
 * The AI only READS through these; every decision leaves as a Command.
 */
import * as economy from '../economy';
import * as fighters from '../fighters';

export interface AiPorts {
  fighters: Pick<typeof fighters, 'rating' | 'potential' | 'humanAge100' | 'isFit' | 'captaincy'>;
  /** wageBill is the bill the commitment rule uses (agreed renewal raises included: economy.committedWageBill). */
  economy: Pick<typeof economy, 'ask' | 'checkOffer' | 'wageBill' | 'pendingWages' | 'agreedRenewal' | 'preferredLength'>;
}

export const realAiPorts: AiPorts = {
  fighters: {
    rating: fighters.rating,
    potential: fighters.potential,
    humanAge100: fighters.humanAge100,
    isFit: fighters.isFit,
    captaincy: fighters.captaincy,
  },
  economy: {
    ask: economy.ask,
    checkOffer: economy.checkOffer,
    wageBill: economy.committedWageBill,
    pendingWages: economy.pendingWages,
    agreedRenewal: economy.agreedRenewal,
    preferredLength: economy.preferredLength,
  },
};
