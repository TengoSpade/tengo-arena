/**
 * The vis-003 files: an observer packet per fight (screenshots in order, the prompts, a brief for an agent observer),
 * the owner's sheet (the same prompts with blank answer lines) and the answer key (for scoring afterwards). The key and
 * the DOM evidence never go in a packet folder: an observer is told to open nothing outside it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promptsFor, sideLabel } from './prompts';
import type { Capture, FightKey, ObserverAnswers } from './types';

export interface PacketFight {
  key: FightKey;
  captures: Capture[];
}

const pad = (n: number, w: number): string => String(n).padStart(w, '0');

/** File name of a capture frame, relative to the fight's packet folder. */
export function frameFile(index: number, tick: number): string {
  return `frames/f${pad(index, 2)}-t${pad(tick, 4)}.png`;
}

export function packetDir(fight: number): string {
  return `packets/fight-${fight}`;
}

export function renderObserverBrief(f: PacketFight): string {
  const prompts = promptsFor(f.key);
  const example: Record<string, string> = {};
  for (const p of prompts) example[p.id] = p.kind === 'down' ? '<who or what, and the ability if you saw it>' : '<fighter name or class, or none>';
  const lines: string[] = [];
  lines.push(`# Observer brief: fight ${f.key.fight}`);
  lines.push('');
  lines.push('You are an observer in a readability test of a fantasy arena autobattler. Two sides of five fighters fight in a top-down arena. The folder `frames/` next to this file holds screenshots of ONE fight, in time order (the file names carry a frame number and the fight tick; 20 ticks are one second). They were taken while the fight played at normal speed (1x).');
  lines.push('');
  lines.push('## Rules');
  lines.push('');
  lines.push('- Answer **only from what you can see in these screenshots**: the arena, the tokens (side ring, role glyph, health bar), the panels, the callouts and the live feed.');
  lines.push('- Open **nothing else**: not any other folder or file of this run, not the source code, not the game content. Do not run commands. Do not use outside knowledge of the game; if the screen does not show it, you do not know it.');
  lines.push('- If you cannot tell from the screenshots, answer `unclear`. A wrong guess and `unclear` both count as not identified; do not invent an answer.');
  lines.push('- Name fighters the way the screen does (the name in the fighter strip or callout); a class name is accepted too.');
  lines.push('');
  lines.push('## What the screen means');
  lines.push('');
  lines.push('- Side: **your side** has solid brass-coloured rings, **the opponent** has double steel-blue rings.');
  lines.push('- Role: each token carries a role glyph (shape), and a hybrid class carries two. Tank, melee, ranged, controller and healer each have their own shape.');
  lines.push('');
  lines.push('## Prompts');
  lines.push('');
  for (const p of prompts) lines.push(`- \`${p.id}\`: ${p.text}`);
  lines.push('');
  lines.push('## Your answer');
  lines.push('');
  lines.push('Reply with one JSON object and nothing else (no prose before or after), with these keys exactly:');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({ observer: '<your name>', fight: f.key.fight, answers: example }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push(`There are ${f.captures.length} screenshots in \`frames/\`, in order f01 to f${pad(f.captures.length, 2)}.`);
  return `${lines.join('\n')}\n`;
}

/** The owner's sheet for the fights of a run: the prompts with blank answer lines, nothing of the key. */
export function renderOwnerSheet(keys: readonly FightKey[], title = 'vis-003 score sheet'): string {
  const lines: string[] = [`# ${title}`, '', 'Observer: ____________________   Date: ____________   Build / commit: ____________', ''];
  lines.push('Watch each fight once at 1x (Space pauses, nothing else is needed). After the fight, answer the prompts. Do not look at the key until all five fights are done.');
  lines.push('');
  let total = 0;
  for (const k of keys) {
    const prompts = promptsFor(k);
    total += prompts.length;
    lines.push(`## Fight ${k.fight}${k.fixtureId ? ` (round ${k.round})` : ''}`);
    lines.push('');
    lines.push('| Prompt | Your answer | Right? |');
    lines.push('| --- | --- | --- |');
    for (const p of prompts) lines.push(`| ${p.text.replace(/\|/g, '/')} | | |`);
    lines.push('');
    lines.push(`Fight ${k.fight}: ____ of ${prompts.length} right`);
    lines.push('');
  }
  lines.push('## Total');
  lines.push('');
  lines.push(`Right: ____ of ${total}  =  ____ %   (vis-003 needs at least 90%: ${Math.ceil(total * 0.9)} of ${total})`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

/** The key as a document, in the sheet's row order, for ticking the sheet afterwards. */
export function renderAnswerKey(keys: readonly FightKey[]): string {
  const lines: string[] = ['# vis-003 answer key', '', 'Do not read before the fights have been watched and the sheet filled in.', ''];
  for (const k of keys) {
    lines.push(`## Fight ${k.fight}${k.fixtureId ? ` (${k.fixtureId}, round ${k.round})` : ''}: ${k.clubNames[0]} vs ${k.clubNames[1]}, ${(k.durationTicks * 0.05).toFixed(0)} s, winner ${k.winnerSide === null ? '?' : k.clubNames[k.winnerSide]}`);
    lines.push('');
    const name = (u: number): string => (k.units[u]!.name === k.units[u]!.className ? k.units[u]!.name : `${k.units[u]!.name} (${k.units[u]!.className})`);
    for (const p of promptsFor(k)) {
      let answer: string;
      if (p.kind === 'tank' || p.kind === 'healer') {
        const holders = (p.kind === 'tank' ? k.tanks : k.healers)[p.side];
        answer = holders.length ? holders.map(name).join(' or ') : `none (no ${p.kind} on that side)`;
      } else {
        const d = k.downs[Number(p.id.split('.')[1]) - 1]!;
        answer = `${d.killer === null ? 'no unit (status or zone damage)' : name(d.killer)}${d.abilityName ? ` with ${d.abilityName}` : ' (basic attack)'}${d.assists.length ? `; assists: ${d.assists.map(name).join(', ')}` : ''}`;
      }
      lines.push(`- ${p.text} **${answer}**`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

export function answersTemplate(keys: readonly FightKey[], observer: string): ObserverAnswers {
  const fights: ObserverAnswers['fights'] = {};
  for (const k of keys) fights[String(k.fight)] = Object.fromEntries(promptsFor(k).map((p) => [p.id, '']));
  return { observer, fights };
}

export function sideSummary(key: FightKey): string {
  return `${sideLabel(key, 0)} against ${sideLabel(key, 1)}`;
}

function put(root: string, rel: string, content: string | Buffer): void {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/**
 * Write the files of a run's vis-003 folder. Screenshots are written by the capture as they are taken (their paths are
 * in `captures`); this writes everything else: prompts, briefs, keys, evidence, the sheets, the manifest.
 */
export function writeVis003Files(root: string, fights: readonly PacketFight[], extra: { seed: string; commit: string }): void {
  for (const f of fights) {
    const dir = packetDir(f.key.fight);
    put(root, `${dir}/prompts.json`, `${JSON.stringify(promptsFor(f.key).map((p) => ({ id: p.id, kind: p.kind, text: p.text })), null, 2)}\n`);
    put(root, `${dir}/observer-brief.md`, renderObserverBrief(f));
    put(root, `keys/fight-${f.key.fight}.key.json`, `${JSON.stringify(f.key, null, 2)}\n`);
    put(root, `evidence/fight-${f.key.fight}.json`, `${JSON.stringify(f.captures.map((c) => ({ index: c.index, tick: c.tick, reason: c.reason, file: c.file, evidence: c.evidence })), null, 2)}\n`);
  }
  const keys = fights.map((f) => f.key);
  put(root, 'owner-sheet.md', renderOwnerSheet(keys));
  put(root, 'owner-answer-key.md', renderAnswerKey(keys));
  put(root, 'answers-template.json', `${JSON.stringify(answersTemplate(keys, 'agent-1'), null, 2)}\n`);
  put(
    root,
    'manifest.json',
    `${JSON.stringify({ format: 'arena-league-vis003', version: 1, seed: extra.seed, commit: extra.commit, fights: fights.map((f) => ({ fight: f.key.fight, round: f.key.round, fixtureId: f.key.fixtureId, logHash: f.key.logHash, frames: f.captures.length, packet: packetDir(f.key.fight), prompts: promptsFor(f.key).length })) }, null, 2)}\n`,
  );
}
