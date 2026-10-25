/**
 * Small cross-screen requests that must not import the (lazy) target screen: a screen reads its
 * request once when it mounts and clears it.
 */
import { signal } from '@preact/signals';

/** Open the Market on a given view (e.g. Renewals from the expiring-contracts dialog). */
export const marketViewRequest = signal<'renewals' | null>(null);
