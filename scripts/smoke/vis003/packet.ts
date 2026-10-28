/**
 * The vis-003 files: an observer packet per fight (screenshots in order, the prompts, a brief for an agent observer), a
 * sheet per fight for people, the owner's tally page and the answer key (for scoring afterwards). The key and the DOM
 * evidence never go in a packet folder: an observer is told to open nothing outside it. Nothing an observer sees names a
 * victim, a time or the number of downs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { observerPrompts, promptsFor } from './prompts';
import type { Capture, FightKey, ObserverAnswers } from './types';

export interface PacketFight {
  key: FightKey;
  captures: Capture[];
}

/** Where the fights came from: the real game, or the driver's own mock arena (a self-test). */
export type Vis003Source = 'game' | 'mock';

export const MOCK_BANNER = '> **SELF-TEST on the mock arena.** These are not real fights of the game; nothing here says anything about vis-003.';

const pad = (n: number, w: number): string => String(n).padStart(w, '0');

/** File name of an observer frame, relative to the fight's packet folder: a number and nothing else (no tick, no reason). */
export function frameFile(frame: number): string {
  return `frames/frame-${pad(frame, 2)}.png`;
}

/** The observer frames of a fight: the captures that have a picture. */
export function packetFrames(f: PacketFight): Capture[] {
  return f.captures.filter((c) => c.frame !== null);
}

export function packetDir(fight: number): string {
  return `packets/fight-${fight}`;
}

/** Rows an observer has for the downs of one fight: more than a fight is likely to have, so the count is not given away. */
export const DOWN_ROWS = 12;

export function renderObserverBrief(f: PacketFight, source: Vis003Source = 'game'): string {
  const prompts = observerPrompts(f.key);
  const example: Record<string, unknown> = {};
  for (const p of prompts) example[p.id] = p.id === 'downs' ? [{ victim: '<who went down>', cause: '<the fighter credited, and the ability if you saw it>' }] : '<fighter name or class, or none>';
  const lines: string[] = [];
  if (source === 'mock') lines.push(MOCK_BANNER, '');
  lines.push(`# Observer brief: fight ${f.key.fight}`);
  lines.push('');
  lines.push('You are an observer in a readability test of a fantasy arena autobattler. Two sides of five fighters fight in a top-down arena. The folder `frames/` next to this file holds screenshots of ONE fight, in time order (`frame-01.png` is the first). They were taken at regular intervals, about one and a half seconds of fight time apart, while the fight played at normal speed (1x).');
  lines.push('');
  lines.push('## Rules');
  lines.push('');
  lines.push('- Answer **only from what you can see in these screenshots**: the arena, the tokens (side ring, role glyph, health bar), the panels, the callouts and the live feed.');
  lines.push('- Open **nothing else**: not any other folder or file of this run, not the source code, not the game content. Do not run commands. Do not use outside knowledge of the game; if the screen does not show it, you do not know it.');
  lines.push('- If you cannot tell from the screenshots, answer `unclear`. A wrong guess and `unclear` both count as not identified; do not invent an answer.');
  lines.push('- Name fighters the way the screen does (the name in the fighter strip or callout); a class name is accepted too.');
  lines.push('- For the downs, name the **one fighter the screen credits** with each down (a callout or the feed names it), not everyone who helped. Naming several fighters for one down counts as wrong.');
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
  lines.push('Reply with one JSON object and nothing else (no prose before or after), with these keys exactly. `downs` is a list with one entry per fighter that went down, as many as you saw (an empty list if none).');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({ observer: '<your name>', fight: f.key.fight, answers: example }, null, 2));
  lines.push('```');
  lines.push('');
  const n = packetFrames(f).length;
  lines.push(`There are ${n} screenshots in \`frames/\`, in order frame-01 to frame-${pad(n, 2)}.`);
  return `${lines.join('\n')}\n`;
}

/** The sheet an observer fills in for one fight (handed over after the fight, not before): role rows and blank down rows. */
export function renderObserverSheet(key: FightKey, source: Vis003Source = 'game'): string {
  const lines: string[] = [];
  if (source === 'mock') lines.push(MOCK_BANNER, '');
  lines.push(`# Fight ${key.fight}: observer sheet`, '', 'Observer: ____________________', '');
  lines.push('Answer from what you saw on screen. Write a fighter\'s name or class; "none" if the side has none; "unclear" if you could not tell.', '');
  lines.push('| Question | Your answer |', '| --- | --- |');
  for (const p of observerPrompts(key).filter((x) => x.id !== 'downs')) lines.push(`| ${p.text.replace(/\|/g, '/')} | |`);
  lines.push('');
  lines.push('**Downs.** List every fighter that went down, in the order it happened: who went down (name or class), and the one fighter the screen credits with downing them (and the ability if you saw it).', '');
  lines.push('| Who went down | Who or what downed them |', '| --- | --- |');
  for (let i = 0; i < DOWN_ROWS; i++) lines.push('| | |');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

/** The owner's tally page: filled in after the key is opened, one row per fight, the right answers counted against the key's totals. */
export function renderTally(keys: readonly FightKey[], source: Vis003Source = 'game'): string {
  const total = keys.reduce((s, k) => s + promptsFor(k).length, 0);
  const lines: string[] = [];
  if (source === 'mock') lines.push(MOCK_BANNER, '');
  lines.push('# vis-003 tally', '', 'Observer: ____________________   Date: ____________   Build / commit: ____________', '');
  lines.push('Open `owner-answer-key.md` only after every observer has handed in every fight sheet. Mark each observer\'s sheets right or wrong against it (rules in PROTOCOL.md), then fill in one tally per observer.', '');
  lines.push('| Fight | Right | Of |', '| --- | --- | --- |');
  for (const k of keys) lines.push(`| ${k.fight} | | ${promptsFor(k).length} |`);
  lines.push(`| **All** | | **${total}** |`, '');
  lines.push(`Rate = right / ${total} = ______ %   vis-003 needs at least 90%: ${Math.ceil(total * 0.9)} of ${total}.   Pass / fail: ____________`, '');
  lines.push('Missed by kind: tank ____  healer ____  down ____', '');
  return `${lines.join('\n')}\n`;
}

/** The key as a document, in the scorer's order, for marking the sheets afterwards. */
export function renderAnswerKey(keys: readonly FightKey[], source: Vis003Source = 'game'): string {
  const lines: string[] = [];
  if (source === 'mock') lines.push(MOCK_BANNER, '');
  lines.push('# vis-003 answer key', '', 'Do not read before the fights have been watched and the sheets handed in.', '');
  for (const k of keys) {
    lines.push(`## Fight ${k.fight}${k.fixtureId ? ` (${k.fixtureId}, round ${k.round})` : ''}: ${k.clubNames[0]} vs ${k.clubNames[1]}, ${(k.durationTicks * 0.05).toFixed(0)} s, winner ${k.winnerSide === null ? '?' : k.clubNames[k.winnerSide]}, ${promptsFor(k).length} prompts`);
    lines.push('');
    const name = (u: number): string => (k.units[u]!.name === k.units[u]!.className ? k.units[u]!.name : `${k.units[u]!.name} (${k.units[u]!.className})`);
    for (const p of promptsFor(k)) {
      let answer: string;
      if (p.kind === 'tank' || p.kind === 'healer') {
        const holders = (p.kind === 'tank' ? k.tanks : k.healers)[p.side];
        answer = holders.length ? holders.map(name).join(' or ') : `none (no ${p.kind} on that side)`;
      } else {
        const d = k.downs[Number(p.id.split('.')[1]) - 1]!;
        answer = `credited: ${d.killer === null ? 'no fighter (status or zone damage)' : name(d.killer)}${d.abilityName ? ` with ${d.abilityName}` : ' (basic attack)'}${d.assists.length ? `; assists, not credited: ${d.assists.map(name).join(', ')}` : ''}`;
      }
      lines.push(`- ${p.text} **${answer}**`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

export function answersTemplate(keys: readonly FightKey[], observer: string): ObserverAnswers {
  const fights: ObserverAnswers['fights'] = {};
  for (const k of keys) {
    fights[String(k.fight)] = {
      roles: Object.fromEntries(observerPrompts(k).filter((p) => p.id !== 'downs').map((p) => [p.id, ''])),
      downs: [{ victim: '', cause: '' }],
    };
  }
  return { observer, fights };
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
export function writeVis003Files(root: string, fights: readonly PacketFight[], extra: { seed: string; commit: string; source: Vis003Source }): void {
  for (const f of fights) {
    const dir = packetDir(f.key.fight);
    put(root, `${dir}/prompts.json`, `${JSON.stringify(observerPrompts(f.key), null, 2)}\n`);
    put(root, `${dir}/observer-brief.md`, renderObserverBrief(f, extra.source));
    put(root, `keys/fight-${f.key.fight}.key.json`, `${JSON.stringify(f.key, null, 2)}\n`);
    put(root, `evidence/fight-${f.key.fight}.json`, `${JSON.stringify(f.captures.map((c) => ({ index: c.index, tick: c.tick, reason: c.reason, frame: c.frame, file: c.file, evidence: c.evidence })), null, 2)}\n`);
    put(root, `sheets/fight-${f.key.fight}.md`, renderObserverSheet(f.key, extra.source));
  }
  const keys = fights.map((f) => f.key);
  put(root, 'owner-tally.md', renderTally(keys, extra.source));
  put(root, 'owner-answer-key.md', renderAnswerKey(keys, extra.source));
  put(root, 'answers-template.json', `${JSON.stringify(answersTemplate(keys, 'agent-1'), null, 2)}\n`);
  put(
    root,
    'manifest.json',
    `${JSON.stringify({ format: 'arena-league-vis003', version: 1, source: extra.source, seed: extra.seed, commit: extra.commit, fights: fights.map((f) => ({ fight: f.key.fight, round: f.key.round, fixtureId: f.key.fixtureId, logHash: f.key.logHash, frames: packetFrames(f).length, packet: packetDir(f.key.fight), prompts: promptsFor(f.key).length })) }, null, 2)}\n`,
  );
}
