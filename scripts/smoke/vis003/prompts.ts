/**
 * The vis-003 prompts of a fight (01 §6): name both sides' tank and healer, and the cause of each down. The same
 * wording serves the owner's sheet and the agent observer's brief. A prompt never says the answer; a down prompt names the
 * victim and about when it happened, so the observer can find the moment, and asks for the cause.
 */
import type { FightKey, Prompt, SideNo } from './types';

/** How a side looks on screen (asset-006: the player's side solid brass rings, the opponent double steel-blue rings). */
export function sideLabel(key: FightKey, side: SideNo): string {
  if (key.ourSide === null) return side === 0 ? `the home side (${key.clubNames[0]})` : `the away side (${key.clubNames[1]})`;
  return side === key.ourSide ? `your side (solid brass rings, ${key.clubNames[side]})` : `the opponent (double steel-blue rings, ${key.clubNames[side]})`;
}

export function promptsFor(key: FightKey): Prompt[] {
  const ours: SideNo = key.ourSide ?? 0;
  const theirs: SideNo = ours === 0 ? 1 : 0;
  const out: Prompt[] = [];
  for (const role of ['tank', 'healer'] as const) {
    out.push({ id: `${role}.us`, kind: role, side: ours, text: `Which fighter is the ${role} of ${sideLabel(key, ours)}? (name or class; "none" if there is none)` });
    out.push({ id: `${role}.them`, kind: role, side: theirs, text: `Which fighter is the ${role} of ${sideLabel(key, theirs)}? (name or class; "none" if there is none)` });
  }
  for (const d of key.downs) {
    const v = key.units[d.victim]!;
    out.push({
      id: `down.${d.index}`,
      kind: 'down',
      side: v.side,
      victim: d.victim,
      text: `Down ${d.index}, at about ${d.seconds.toFixed(0)} s: ${v.name}${v.name === v.className ? '' : ` (${v.className})`}, ${sideLabel(key, v.side)}, went down. Who or what downed them (the fighter, and the ability if you could see it)?`,
    });
  }
  return out;
}
