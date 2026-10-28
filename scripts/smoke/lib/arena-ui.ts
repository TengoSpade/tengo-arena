/**
 * The arena screen's own controls, used the way a person uses them. Finding the round's end needs this: the viewer stops by
 * itself for an auto-pause (our fighter or captain down, overtime), and when that tick is also the round's last, the
 * auto-pause wins over the end (render/viewer core: "at the same tick an auto-pause wins over the end"). The screen then
 * says "Paused automatically" with a Play button, and one more press of Play lets the end through (round-end overlay, then
 * the between-round screen). A driver that waits for the round to end by itself waits forever; one that presses Play when
 * the screen is paused does what a player does.
 */
import type { PageDriver } from './page';

export const ARENA_UI = {
  screen: '[data-testid="screen-arena"]',
  play: '[data-testid="arena-play"]',
} as const;

export interface ArenaUiState {
  /** The screen's data-state: paused, playing, round-end, ... */
  state: string;
  /** The text of the Play / Pause button ("Play Space", "Pause Space"). */
  playLabel: string;
}

export async function arenaUi(page: PageDriver): Promise<ArenaUiState | null> {
  return await page.eval<ArenaUiState | null>(
    `(() => { const s = document.querySelector(${JSON.stringify(ARENA_UI.screen)}); if (!s) return null; const b = document.querySelector(${JSON.stringify(ARENA_UI.play)}); return { state: s.getAttribute('data-state') || '', playLabel: b ? b.innerText.replace(/\\s+/g, ' ').trim() : '' }; })()`,
  );
}

/** The screen is paused with a Play button and is not already finishing the round. */
export function needsPlayPress(ui: ArenaUiState | null): boolean {
  return ui !== null && ui.state !== 'round-end' && /^Play\b/i.test(ui.playLabel);
}

/** Press the screen's Play button when it shows one; true if it was pressed. */
export async function pressPlayIfPaused(page: PageDriver): Promise<boolean> {
  if (!needsPlayPress(await arenaUi(page))) return false;
  await page.click({ css: ARENA_UI.play }, 'the Play button');
  return true;
}

/** The arena's size in centimetres, from the content (combat.json arena: 32 x 18 m). */
export function arenaCmOf(env: { content: { combat: { arena: { widthM: number; heightM: number } } } }): { width: number; height: number } {
  return { width: env.content.combat.arena.widthM * 100, height: env.content.combat.arena.heightM * 100 };
}
