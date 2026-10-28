/**
 * Where the smoke finds things in the real UI. Kept in one place so a renamed control is a one-line fix.
 * The M1.1 screens' selectors are read from the code (data-testid); the M2 arena controls (WP-M2E) are matched by
 * the contract's words (Watch, Simulate, 05-technical-m2 §A7) because their test ids are not fixed by the contract.
 */
import type { Locator } from './page';

export const SEL = {
  // title / new career (src/ui/screens/new-game)
  titleScreen: '[data-testid="screen-new-game"]',
  advanced: { css: 'button', text: '^Advanced$' } satisfies Locator,
  seedInput: { css: 'input.input[type="text"]' } satisfies Locator,
  newCareer: { css: '[data-testid="title-new"]' } satisfies Locator,
  // club select (src/ui/screens/club-select)
  clubCard: { css: '[data-testid^="club-card-"]' } satisfies Locator,
  startCareer: { css: '[data-testid="start-career"]' } satisfies Locator,
  startCareerConfirm: { css: '[data-testid="start-career-confirm"]' } satisfies Locator,
  // frame (src/ui/app/Frame.tsx)
  continueButton: { css: '[data-testid="continue"]' } satisfies Locator,
  continueMain: '.continue__main',
  // M2 (WP-M2E): the other way to play the match, beside the primary button (Simulate beside Watch, and the reverse)
  continueOther: { css: '[data-testid="continue-other"]' } satisfies Locator,
  continueSub: '.continue__sub',
  continueConfirm: '[data-testid="continue-confirm"]',
  continueConfirmPrimary: { css: '[data-testid="continue-confirm"] button.btn--primary' } satisfies Locator,
  homeScreen: '[data-testid="screen-home"]',
  // between rounds (src/ui/screens/between-rounds)
  betweenRoundsContinue: { css: '[data-testid="br-continue"]' } satisfies Locator,
  // M2 (WP-M2E): Play match offers Watch (primary) and Simulate; the arena screen
  watch: { css: 'button, a, [role="button"]', text: '^\\s*Watch\\b' } satisfies Locator,
  arenaScreen: '[data-testid="screen-arena"]',
  openReportToast: { css: 'button, a', text: 'Open report' } satisfies Locator,
} as const;

/**
 * The primary Continue button's text on the day of the player's match: "Play match" in M1.1; in M2 "Watch" (or "Simulate" when the
 * pacing preset or the Watch preference simulates; Q54, 05-technical-m2 §A3).
 */
export const MATCHDAY_MAIN = /^(Play match|Watch|Simulate)$/i;

/** Hash routes of the contract (src/ui/app/routes.ts). */
export const ROUTE = {
  arena: /#\/arena\b/,
  betweenRounds: /#\/between-rounds\b/,
  report: /#\/match\//,
  home: /#\/home\b/,
  squad: /#\/squad\b/,
  clubSelect: /#\/club-select\b/,
} as const;
