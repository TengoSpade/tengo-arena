/**
 * The vis-003 prompts (01 §6): name both sides' tank and healer, and the cause of each down.
 *
 * Two views of the same questions. `observerPrompts` is what an observer is shown: four role prompts and one list prompt
 * ("list every fighter that went down and who or what downed them"); it names no victim, no time and no count, so the
 * observer has to notice the downs, not be told them. `promptsFor` is what the scorer counts: the same four role prompts and
 * one item per down of the fight (so a down the observer did not list is a missed prompt).
 */
import type { FightKey, ObserverPrompt, Prompt, SideNo } from './types';

/** How a side looks on screen (asset-006: the player's side solid brass rings, the opponent double steel-blue rings). */
export function sideLabel(key: FightKey, side: SideNo): string {
  if (key.ourSide === null) return side === 0 ? `the home side (${key.clubNames[0]})` : `the away side (${key.clubNames[1]})`;
  return side === key.ourSide ? `your side (solid brass rings, ${key.clubNames[side]})` : `the opponent (double steel-blue rings, ${key.clubNames[side]})`;
}

function roleText(key: FightKey, role: 'tank' | 'healer', side: SideNo): string {
  return `Which fighter is the ${role} of ${sideLabel(key, side)}? (name or class; "none" if there is none)`;
}

export const DOWNS_PROMPT = 'List every fighter that went down in this fight, in the order it happened. For each: who went down (name or class), and who or what downed them (the fighter the screen credits, and the ability if you could see it).';

export function observerPrompts(key: FightKey): ObserverPrompt[] {
  const ours: SideNo = key.ourSide ?? 0;
  const theirs: SideNo = ours === 0 ? 1 : 0;
  return [
    { id: 'tank.us', text: roleText(key, 'tank', ours) },
    { id: 'tank.them', text: roleText(key, 'tank', theirs) },
    { id: 'healer.us', text: roleText(key, 'healer', ours) },
    { id: 'healer.them', text: roleText(key, 'healer', theirs) },
    { id: 'downs', text: DOWNS_PROMPT },
  ];
}

/** The scored items of a fight, in the order of the key sheet: four role prompts, then one per down. */
export function promptsFor(key: FightKey): Prompt[] {
  const ours: SideNo = key.ourSide ?? 0;
  const theirs: SideNo = ours === 0 ? 1 : 0;
  const out: Prompt[] = [];
  for (const role of ['tank', 'healer'] as const) {
    out.push({ id: `${role}.us`, kind: role, side: ours, text: roleText(key, role, ours) });
    out.push({ id: `${role}.them`, kind: role, side: theirs, text: roleText(key, role, theirs) });
  }
  for (const d of key.downs) {
    const v = key.units[d.victim]!;
    out.push({
      id: `down.${d.index}`,
      kind: 'down',
      side: v.side,
      victim: d.victim,
      text: `Down ${d.index}, at about ${d.seconds.toFixed(0)} s: ${v.name}${v.name === v.className ? '' : ` (${v.className})`}, ${sideLabel(key, v.side)}, went down. Who or what downed them?`,
    });
  }
  return out;
}
