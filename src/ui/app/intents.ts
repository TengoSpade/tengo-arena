/**
 * Small cross-screen requests that must not import the (lazy) target screen: a screen reads its
 * request once when it mounts and clears it.
 */
import { signal } from '@preact/signals';

/** Open the Market on a given view (e.g. Renewals from the expiring-contracts dialog). */
export const marketViewRequest = signal<'renewals' | null>(null);

/** Home asks the frame to run quiet preseason weeks up to kick-off ("Skip to Matchweek 1"). */
export const skipToKickOffRequest = signal(0);

/** Open the level-up dialog of a fighter (badges, "Choose" buttons; the frame loads the dialog host). */
export const levelUpRequest = signal<string | null>(null);
