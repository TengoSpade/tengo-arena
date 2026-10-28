/**
 * The vis-003 kit on real fight logs: the answer key, the prompts, the capture plan, the scoring of observers' answers,
 * answer-file parsing, and the on-screen evidence proxy. The logs come from the sim on content/default (full record level).
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, type ContentDB } from '../../../src/core/content';
import type { FightLog } from '../../../src/core/model';
import { sideInput, simulateRound } from '../../../src/core/sim';
import { loadRawContentFromDisk } from '../../lib/node-content';
import { CROSS_CASES } from '../cross/cases';
import { extractJson, mergeAnswers, parseAnswerFile } from './answers';
import { CALLOUT_TICKS, scoreEvidence, shownRoles, summarizeEvidence, type EvidenceCapture } from './evidence';
import { buildFightKey } from './key';
import { DOWN_ROWS, answersTemplate, frameFile, renderAnswerKey, renderObserverBrief, renderObserverSheet, renderTally, writeVis003Files } from './packet';
import { PACKET_EVERY_TICKS, planCaptures, planEvidence, planPacket } from './plan';
import { DOWNS_PROMPT, observerPrompts, promptsFor } from './prompts';
import { latestRealVisDir, visRuns, visSourceOf } from './runs';
import { normalize, scoreFight, scoreFightDetailed, scoreObserver, summarize, unitsMentioned } from './score';
import type { Capture, DownAnswer, FightAnswers, FightKey, ObserverAnswers, PromptResult, ScreenEvidence } from './types';

const loaded = loadContent('default', loadRawContentFromDisk('default').raw);
if (!loaded.ok) throw new Error('content/default is invalid');
const content: ContentDB = loaded.value;

function roundLog(caseIndex = 0): FightLog {
  const c = CROSS_CASES[caseIndex]!;
  const input = { round: c.round, home: sideInput(content, 'home', c.home, 0, 1), away: sideInput(content, 'away', c.away, 1, 0) };
  return simulateRound(input, c.seed, content, { record: 'full' }).log!;
}

/** Fighter names as the strip would show them, so name matching is exercised (not only class names). */
function namesFor(log: FightLog): Record<string, string> {
  const first = ['Brann', 'Corva', 'Dunmar', 'Esk', 'Falk', 'Garrow', 'Hesta', 'Ivo', 'Jorun', 'Kell'];
  return Object.fromEntries(log.header.units.map((u, i) => [u.fighterId, `${first[i]} ${['Ashdown', 'Vale', 'Thorn', 'Marsh', 'Crowe'][i % 5]}`]));
}

function keyOf(caseIndex = 0, fight = 1): FightKey {
  const log = roundLog(caseIndex);
  return buildFightKey(log, content, { fight, fixtureId: `f-${fight}`, names: namesFor(log), ourSide: 0, clubNames: ['Varrow Dockjacks', 'Marrowby Saltboilers'] });
}

describe('the answer key', () => {
  const key = keyOf();
  const log = roundLog();

  it('lists ten units with their roles from the class archetypes (D-J)', () => {
    expect(key.units).toHaveLength(10);
    const knight = key.units.find((u) => u.className === 'Knight')!;
    expect(knight.roles).toEqual(['tank']);
    expect(key.tanks[0]).toContain(key.units.find((u) => u.side === 0 && u.className === 'Knight')!.unit);
    expect(key.healers[0].length).toBeGreaterThan(0);
  });

  it('has every down of the log with its killer and ability name', () => {
    const downs = log.events.filter((e) => e.type === 'unit.down');
    expect(key.downs).toHaveLength(downs.length);
    expect(key.downs.length).toBeGreaterThan(0);
    const d = key.downs[0]!;
    const e = downs[0]!;
    expect(d.tick).toBe(e.tick);
    expect(d.victim).toBe(e.unit);
    expect(d.seconds).toBeCloseTo(e.tick * 0.05, 1);
    if (d.ability) expect(d.abilityName).toBe(content.abilities.get(d.ability)!.name);
    expect(key.durationTicks).toBeGreaterThan(d.tick);
    expect(key.logHash).toBe(log.hash);
    expect(key.winnerSide === 0 || key.winnerSide === 1).toBe(true);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(keyOf())).toBe(JSON.stringify(key));
  });

  it('hybrids hold two roles and count for both', () => {
    const k = keyOf(2);
    const hybrid = k.units.filter((u) => u.roles.length === 2);
    expect(hybrid.length).toBeGreaterThan(0);
    for (const h of hybrid) for (const r of h.roles) expect(r === 'tank' ? k.tanks[h.side] : r === 'healer' ? k.healers[h.side] : [h.unit]).toContain(h.unit);
  });
});

describe('the prompts', () => {
  const key = keyOf();
  const scored = promptsFor(key);
  const asked = observerPrompts(key);

  it('what is scored: four role prompts and one item per down', () => {
    expect(scored.filter((p) => p.kind !== 'down').map((p) => p.id)).toEqual(['tank.us', 'tank.them', 'healer.us', 'healer.them']);
    expect(scored.filter((p) => p.kind === 'down')).toHaveLength(key.downs.length);
    const d = key.downs[0]!;
    const p = scored.find((x) => x.id === 'down.1')!;
    expect(p.text).toContain(key.units[d.victim]!.name);
    expect(p.text).toContain(`${d.seconds.toFixed(0)} s`);
    expect(p.victim).toBe(d.victim);
  });

  it('what an observer is asked names no victim, no time and no count', () => {
    expect(asked.map((p) => p.id)).toEqual(['tank.us', 'tank.them', 'healer.us', 'healer.them', 'downs']);
    const text = asked.map((p) => p.text).join('\n');
    for (const d of key.downs) {
      const v = key.units[d.victim]!;
      expect(text).not.toContain(v.name);
      expect(text).not.toContain(`${d.seconds.toFixed(0)} s`);
    }
    expect(text).not.toContain(`${key.downs.length} downs`);
    expect(text).toContain('solid brass rings');
    expect(text).toContain('double steel-blue rings');
    expect(asked.find((p) => p.id === 'downs')!.text).toBe(DOWNS_PROMPT);
  });

  it('never says who holds a role', () => {
    const text = asked.map((p) => p.text).join('\n');
    for (const u of key.units.filter((x) => x.roles.includes('healer') || x.roles.includes('tank'))) expect(text).not.toContain(u.name);
  });
});

describe('the capture plan', () => {
  const key = keyOf();
  const keyWithDowns = (downs: FightKey['downs']): FightKey => ({ ...key, downs });

  it('the observer frames are a fixed schedule: tick 10, every 30 ticks, the last tick', () => {
    const packet = planPacket(130);
    expect(packet.map((p) => p.tick)).toEqual([10, 40, 70, 100, 130]);
    expect(packet.map((p) => p.reason)).toEqual(['spawn', 'periodic', 'periodic', 'periodic', 'end']);
    expect(packet.every((p) => p.packet)).toBe(true);
    const odd = planPacket(145).map((p) => p.tick);
    expect(odd).toEqual([10, 40, 70, 100, 130, 145]);
    // Every callout (40 ticks) is on screen in at least one frame.
    expect(PACKET_EVERY_TICKS).toBeLessThan(40);
  });

  it('the packet schedule and its frame count do not depend on the downs', () => {
    const none = planCaptures(keyWithDowns([])).filter((p) => p.packet);
    const many = planCaptures(key).filter((p) => p.packet);
    expect(key.downs.length).toBeGreaterThan(0);
    expect(many).toEqual(none);
    expect(many.map((p) => p.tick)).toEqual(planPacket(key.durationTicks).map((p) => p.tick));
    const doubled = keyWithDowns([...key.downs, ...key.downs.map((d, i) => ({ ...d, index: key.downs.length + i + 1 }))]);
    expect(planCaptures(doubled).filter((p) => p.packet)).toEqual(none);
  });

  it('the frame count follows the fight length only', () => {
    expect(planPacket(900).length).toBeGreaterThan(planPacket(600).length);
    expect(planPacket(600)).toEqual(planCaptures({ ...key, downs: [], durationTicks: 600 }));
  });

  it('the down-bracketing captures are evidence only: no picture, never a packet frame', () => {
    const evidence = planEvidence(key);
    expect(evidence).toHaveLength(3 * key.downs.length);
    expect(evidence.every((p) => !p.packet)).toBe(true);
    for (const d of key.downs) {
      expect(evidence.some((p) => p.reason === 'before-down' && p.tick === Math.max(0, d.tick - 8))).toBe(true);
      expect(evidence.some((p) => p.reason === 'down' && p.tick >= d.tick && p.tick <= d.tick + 2)).toBe(true);
      expect(evidence.some((p) => p.reason === 'after-down' && p.tick >= d.tick && p.tick <= d.tick + 30)).toBe(true);
    }
    expect(evidence.every((p) => p.tick <= key.durationTicks)).toBe(true);
  });

  it('the merged plan is in tick order and holds both kinds', () => {
    const plan = planCaptures(key);
    for (let i = 1; i < plan.length; i++) expect(plan[i]!.tick).toBeGreaterThanOrEqual(plan[i - 1]!.tick);
    expect(plan.length).toBe(planPacket(key.durationTicks).length + 3 * key.downs.length);
    expect(plan[plan.length - 1]!.tick).toBe(key.durationTicks);
  });

  it('frame file names are a number and nothing else', () => {
    expect(frameFile(3)).toBe('frames/frame-03.png');
    expect(frameFile(12)).toBe('frames/frame-12.png');
    expect(frameFile(7)).not.toMatch(/t\d{4}|tick|down/i);
  });
});

describe('matching answers to fighters', () => {
  const key = keyOf();

  it('normalizes', () => {
    expect(normalize('  Brann  Ashdown!! ')).toBe('brann ashdown');
    expect(normalize('Ælfred’s')).toBe('lfred s');
  });

  it('a full name names one unit, a first name too, a class name every unit of that class', () => {
    const brann = key.units[0]!;
    expect(unitsMentioned(brann.name, key.units)).toEqual([0]);
    expect(unitsMentioned('Brann', key.units)).toEqual([0]);
    const classMates = key.units.filter((u) => u.className === 'Chirurgeon').map((u) => u.unit);
    expect(classMates.length).toBe(2);
    expect(unitsMentioned('the chirurgeon', key.units)).toEqual(classMates);
  });

  it('a name pins the unit down against its class-mates', () => {
    const chirs = key.units.filter((u) => u.className === 'Chirurgeon');
    expect(unitsMentioned(`${chirs[0]!.name}, the Chirurgeon`, key.units)).toEqual([chirs[0]!.unit]);
  });
});

const roles = (key: FightKey): Record<string, string> => {
  const name = (u: number): string => key.units[u]!.name;
  const holder = (list: readonly number[]): string => (list.length ? name(list[0]!) : 'none');
  return { 'tank.us': holder(key.tanks[0]), 'tank.them': holder(key.tanks[1]), 'healer.us': holder(key.healers[0]), 'healer.them': holder(key.healers[1]) };
};

/** What a perfect observer writes for the downs: every victim by name with the credited fighter and the ability. */
function perfectDowns(key: FightKey): DownAnswer[] {
  const name = (u: number): string => key.units[u]!.name;
  return key.downs.map((d) => ({ victim: name(d.victim), cause: `${d.killer === null ? 'status damage' : name(d.killer)}${d.abilityName ? ` with ${d.abilityName}` : ''}` }));
}

function perfect(key: FightKey): FightAnswers {
  return { roles: roles(key), downs: perfectDowns(key) };
}

const down = (r: PromptResult[], n: number): PromptResult => r.find((x) => x.prompt === `down.${n}`)!;

describe('scoring one fight', () => {
  const key = keyOf();

  it('perfect answers by name score 100%', () => {
    const results = scoreFight(key, perfect(key));
    expect(results.every((r) => r.correct)).toBe(true);
    const s = summarize('obs', results);
    expect(s.rate).toBe(1);
    expect(s.pass).toBe(true);
    expect(s.byKind.tank.total).toBe(2);
    expect(s.byKind.down.total).toBe(key.downs.length);
  });

  it('class names score too (a class holding the role on that side)', () => {
    const a = perfect(key);
    a.roles['tank.us'] = key.units[key.tanks[0][0]!]!.className;
    expect(scoreFight(key, a).find((r) => r.prompt === 'tank.us')!.correct).toBe(true);
  });

  it("naming the wrong fighter, or the other side's, is wrong", () => {
    const a = perfect(key);
    a.roles['healer.us'] = key.units[key.tanks[0][0]!]!.name;
    a.roles['tank.them'] = key.units[key.tanks[0][0]!]!.name;
    const r = scoreFight(key, a);
    expect(r.find((x) => x.prompt === 'healer.us')!.correct).toBe(false);
    expect(r.find((x) => x.prompt === 'tank.them')!.correct).toBe(false);
    expect(r.find((x) => x.prompt === 'healer.us')!.why).toMatch(/is not the healer/);
  });

  it('naming a tank and a non-tank together is wrong', () => {
    const a = perfect(key);
    const nonTank = key.units.find((u) => u.side === 0 && !u.roles.includes('tank'))!;
    a.roles['tank.us'] = `${key.units[key.tanks[0][0]!]!.name} and ${nonTank.name}`;
    expect(scoreFight(key, a).find((x) => x.prompt === 'tank.us')!.correct).toBe(false);
  });

  it('unanswered, "unclear" and "unknown" are wrong, for roles and for causes alike', () => {
    const a = perfect(key);
    delete a.roles['tank.us'];
    a.roles['healer.them'] = 'unclear';
    a.roles['healer.us'] = 'Unknown.';
    a.downs[0]!.cause = 'unclear';
    a.downs[1]!.cause = "I don't know";
    const r = scoreFight(key, a);
    expect(r.find((x) => x.prompt === 'tank.us')).toMatchObject({ correct: false, why: 'no answer' });
    expect(r.find((x) => x.prompt === 'healer.them')).toMatchObject({ correct: false, why: 'unclear' });
    expect(r.find((x) => x.prompt === 'healer.us')).toMatchObject({ correct: false, why: 'unclear' });
    expect(down(r, 1)).toMatchObject({ correct: false, why: 'the cause is unclear' });
    expect(down(r, 2).correct).toBe(false);
    expect(summarize('o', r).unanswered).toBe(1);
  });

  it('"unclear" and "unknown" are wrong for a down with no fighter behind it too', () => {
    const none: FightKey = { ...key, downs: [{ ...key.downs[0]!, killer: null, ability: null, abilityName: null }] };
    const victim = none.units[none.downs[0]!.victim]!.name;
    const ask = (cause: string): boolean => scoreFight(none, { roles: roles(none), downs: [{ victim, cause }] }).find((x) => x.prompt === 'down.1')!.correct;
    for (const cause of ['unclear', 'unknown', 'no idea']) expect(ask(cause)).toBe(false);
    for (const cause of ['burning damage over time', 'a status effect', 'the zone']) expect(ask(cause)).toBe(true);
    expect(ask('Garrow Ashdown')).toBe(false);
  });

  it('the credited fighter is what counts for a down; the ability only when strict', () => {
    const d = key.downs.find((x) => x.killer !== null && x.abilityName)!;
    const a = perfect(key);
    a.downs[d.index - 1]!.cause = key.units[d.killer!]!.name;
    expect(down(scoreFight(key, a), d.index).correct).toBe(true);
    const strict = down(scoreFight(key, a, { strictAbility: true }), d.index);
    expect(strict.correct).toBe(false);
    expect(strict.abilityNamed).toBe(false);
  });

  it("naming several enemies for one down is wrong, even with the credited fighter among them (the protocol's rule)", () => {
    const d = key.downs.find((x) => x.killer !== null)!;
    const victimSide = key.units[d.victim]!.side;
    const other = key.units.find((u) => u.side !== victimSide && u.unit !== d.killer && u.className !== key.units[d.killer!]!.className)!;
    const a = perfect(key);
    a.downs[d.index - 1]!.cause = `${key.units[d.killer!]!.name} and ${other.name}`;
    const r = down(scoreFight(key, a), d.index);
    expect(r.correct).toBe(false);
    expect(r.why).toMatch(/names several enemies/);
    // an assist the key lists is not credited either
    const assist = d.assists.map((u) => key.units[u]!).find((u) => u.className !== key.units[d.killer!]!.className);
    if (assist) {
      a.downs[d.index - 1]!.cause = `${key.units[d.killer!]!.name} (with help from ${assist.name})`;
      expect(down(scoreFight(key, a), d.index).correct).toBe(false);
    }
  });

  it('a class name that two enemies share is one answer, not several', () => {
    const d = key.downs.find((x) => x.killer !== null)!;
    const a = perfect(key);
    a.downs[d.index - 1]!.cause = key.units[d.killer!]!.className;
    expect(down(scoreFight(key, a), d.index).correct).toBe(true);
  });

  it("a name inside the ability's name is not read as a fighter", () => {
    const d = key.downs.find((x) => x.killer !== null && x.abilityName)!;
    const a = perfect(key);
    a.downs[d.index - 1]!.cause = `${key.units[d.killer!]!.name} with ${d.abilityName}`;
    expect(down(scoreFight(key, a), d.index).correct).toBe(true);
  });

  it('a down the observer did not list is a missed prompt; one that never happened is reported, not counted', () => {
    const a = perfect(key);
    a.downs.splice(2, 1);
    a.downs.push({ victim: 'Nobody Real', cause: 'a ghost' });
    const { results, extraDowns } = scoreFightDetailed(key, a);
    expect(down(results, 3).correct).toBe(false);
    expect(down(results, 3).why).toMatch(/no listed down names/);
    expect(extraDowns).toBe(1);
    expect(results).toHaveLength(promptsFor(key).length);
    expect(summarize('o', results, extraDowns).extraDowns).toBe(1);
  });

  it('one listed entry cannot answer two downs', () => {
    const a = perfect(key);
    a.downs = [a.downs[0]!, a.downs[0]!];
    const r = scoreFight(key, a).filter((x) => x.kind === 'down');
    expect(r.filter((x) => x.correct)).toHaveLength(1);
  });

  it('a victim named without the cause, or the victim as the cause, is wrong', () => {
    const d = key.downs.find((x) => x.killer !== null)!;
    const victim = key.units[d.victim]!.name;
    const a = perfect(key);
    a.downs[d.index - 1] = { victim, cause: '' };
    expect(down(scoreFight(key, a), d.index).correct).toBe(false);
    a.downs[d.index - 1] = { victim, cause: victim };
    expect(down(scoreFight(key, a), d.index).correct).toBe(false);
  });

  it('90% is the bar, per observer', () => {
    const results = scoreFight(key, perfect(key));
    const n = results.length;
    const wrongCount = Math.floor(n * 0.1);
    const bent = results.map((r, i) => (i < wrongCount ? { ...r, correct: false } : r));
    expect(summarize('o', bent).pass).toBe(true);
    const bentMore = results.map((r, i) => (i < wrongCount + 1 ? { ...r, correct: false } : r));
    expect(summarize('o', bentMore).pass).toBe(n - wrongCount - 1 >= n * 0.9);
  });
});

describe('scoring across fights', () => {
  it('scores five fights and counts the ones not answered as wrong', () => {
    const keys = [0, 1, 2, 3, 4].map((i) => keyOf(i, i + 1));
    const answers: ObserverAnswers = { observer: 'agent-1', fights: { '1': { roles: { 'tank.us': keys[0]!.units[keys[0]!.tanks[0][0]!]!.name }, downs: [] } } };
    const { results, summary } = scoreObserver(keys, answers);
    expect(results.length).toBe(keys.reduce((s, k) => s + promptsFor(k).length, 0));
    expect(summary.correct).toBe(1);
    expect(summary.byFight).toHaveLength(5);
    expect(summary.pass).toBe(false);
  });

  it('a perfect observer on all five fights passes', () => {
    const keys = [0, 1, 2, 3, 4].map((i) => keyOf(i, i + 1));
    const answers: ObserverAnswers = { observer: 'agent-1', fights: Object.fromEntries(keys.map((k) => [String(k.fight), perfect(k)])) };
    const { summary } = scoreObserver(keys, answers);
    expect(summary.rate).toBe(1);
    expect(summary.pass).toBe(true);
    expect(summary.extraDowns).toBe(0);
  });
});

describe('answer files', () => {
  it('extracts the JSON from prose and code fences', () => {
    const obj = extractJson('Sure! Here is my answer:\n```json\n{"observer":"a","fight":2,"answers":{"tank.us":"Knight {x}"}}\n```\nDone.') as { fight: number };
    expect(obj.fight).toBe(2);
    expect(() => extractJson('no json here')).toThrow();
    expect(() => extractJson('{"a": 1')).toThrow(/not closed/);
  });

  it('reads a fight reply: role strings and the list of downs', () => {
    const a = parseAnswerFile('{"observer":"agent-1","fight":1,"answers":{"tank.us":"A","downs":[{"victim":"Corva","cause":"Garrow with Mace Strike"},{"victim":"Knight","cause":"Archer"}]}}');
    expect(a.fights['1']).toEqual({ roles: { 'tank.us': 'A' }, downs: [{ victim: 'Corva', cause: 'Garrow with Mace Strike' }, { victim: 'Knight', cause: 'Archer' }] });
  });

  it('accepts a down as a line of text, and drops empty rows', () => {
    const a = parseAnswerFile('{"observer":"o","fight":1,"answers":{"downs":["Corva Vale downed by Garrow Ashdown","Esk: Falk","Hesta only",{"victim":"","cause":""}]}}');
    expect(a.fights['1']!.downs).toEqual([{ victim: 'Corva Vale', cause: 'Garrow Ashdown' }, { victim: 'Esk', cause: 'Falk' }, { victim: 'Hesta only', cause: '' }]);
  });

  it('reads combined files and merges per-fight files by observer', () => {
    const a = parseAnswerFile('{"observer":"agent-1","fight":1,"answers":{"tank.us":"A","downs":[{"victim":"x","cause":"y"}]}}');
    const b = parseAnswerFile('{"observer":"agent-1","fight":2,"answers":{"tank.us":"B"}}');
    const c = parseAnswerFile('{"observer":"person","fights":{"1":{"tank.us":"C"},"2":{"healer.us":"D","downs":[{"victim":"v","cause":"w"}]}}}');
    const merged = mergeAnswers([a, b, c]);
    expect(merged).toHaveLength(2);
    const one = merged.find((m) => m.observer === 'agent-1')!;
    expect(one.fights['1']).toEqual({ roles: { 'tank.us': 'A' }, downs: [{ victim: 'x', cause: 'y' }] });
    expect(one.fights['2']!.roles).toEqual({ 'tank.us': 'B' });
    expect(merged.find((m) => m.observer === 'person')!.fights['2']!.downs).toEqual([{ victim: 'v', cause: 'w' }]);
  });

  it('an observer left as the template placeholder falls back to the file name', () => {
    expect(parseAnswerFile('{"observer":"<your name>","fight":1,"answers":{}}', 'file-name').observer).toBe('file-name');
  });

  it('non-string role answers become text and a malformed file is refused', () => {
    expect(parseAnswerFile('{"observer":"o","fight":1,"answers":{"a":null,"b":5}}').fights['1']!.roles).toEqual({ a: '', b: '5' });
    expect(() => parseAnswerFile('{"observer":"o"}')).toThrow(/expected/);
  });
});

describe('packet documents', () => {
  const keys = [keyOf(0, 1), keyOf(1, 2)];

  it('the observer brief carries the rules, every prompt and the answer format, and never the key or a victim', () => {
    const brief = renderObserverBrief({ key: keys[0]!, captures: [] });
    expect(brief).toContain('Open **nothing else**');
    for (const p of observerPrompts(keys[0]!)) expect(brief).toContain(`\`${p.id}\``);
    expect(brief).toContain('"downs"');
    expect(brief).toContain('Naming several fighters for one down counts as wrong');
    expect(brief).not.toContain(keys[0]!.logHash);
    for (const d of keys[0]!.downs) expect(brief).not.toContain(`${d.seconds.toFixed(0)} s`);
    expect(brief).not.toContain('SELF-TEST');
  });

  it('nothing an observer sees counts or places the downs: neutral frame names, a count from the packet frames only, no ticks', () => {
    const k = keys[0]!;
    const packet = planPacket(k.durationTicks).map((p, i): Capture => ({ index: i + 1, tick: p.tick, reason: p.reason, frame: i + 1, file: `packets/fight-1/${frameFile(i + 1)}`, evidence: null }));
    const priv = planEvidence(k).map((p, i): Capture => ({ index: packet.length + i + 1, tick: p.tick, reason: p.reason, frame: null, file: null, evidence: null }));
    const fight = { key: k, captures: [...packet, ...priv] };
    const n = packet.length;
    const brief = renderObserverBrief(fight);
    expect(brief).toContain(`There are ${n} screenshots`);
    expect(brief).toContain(`frame-${String(n).padStart(2, '0')}`);
    expect(brief).not.toMatch(/\btick|20 ticks|before-down|after-down|f\d\d-t\d{4}/i);
    // The same fight with a different number of downs gives the same observer-facing count.
    const fewer = { key: { ...k, downs: k.downs.slice(0, 1) }, captures: packet };
    expect(renderObserverBrief(fewer).match(/There are \d+ screenshots/)![0]).toBe(brief.match(/There are \d+ screenshots/)![0]);
  });

  it('the evidence-only captures and their reasons stay in the private evidence file, not in the packet folder', () => {
    const k = keys[0]!;
    const dir = mkdtempSync(join(tmpdir(), 'vis003-private-'));
    try {
      const captures: Capture[] = [
        { index: 1, tick: 10, reason: 'spawn', frame: 1, file: 'packets/fight-1/frames/frame-01.png', evidence: null },
        { index: 2, tick: 92, reason: 'before-down', frame: null, file: null, evidence: null },
        { index: 3, tick: 102, reason: 'down', frame: null, file: null, evidence: null },
      ];
      writeVis003Files(dir, [{ key: k, captures }], { seed: 's', commit: 'abc', source: 'game' });
      const evidence = JSON.parse(readFileSync(join(dir, 'evidence', 'fight-1.json'), 'utf8')) as Capture[];
      expect(evidence.map((c) => c.reason)).toEqual(['spawn', 'before-down', 'down']);
      expect(evidence.map((c) => c.frame)).toEqual([1, null, null]);
      const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { fights: { frames: number }[] };
      expect(manifest.fights[0]!.frames).toBe(1);
      expect(readdirSync(join(dir, 'packets', 'fight-1')).sort()).toEqual(['observer-brief.md', 'prompts.json']);
      for (const f of ['packets/fight-1/observer-brief.md', 'packets/fight-1/prompts.json', 'sheets/fight-1.md']) expect(readFileSync(join(dir, f), 'utf8')).not.toMatch(/before-down|after-down/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a mock run says so at the top of every document', () => {
    expect(renderObserverBrief({ key: keys[0]!, captures: [] }, 'mock')).toContain('SELF-TEST on the mock arena');
    expect(renderObserverSheet(keys[0]!, 'mock')).toContain('SELF-TEST on the mock arena');
    expect(renderTally(keys, 'mock')).toContain('SELF-TEST on the mock arena');
    expect(renderAnswerKey(keys, 'mock')).toContain('SELF-TEST on the mock arena');
  });

  it('the observer sheet is one fight, with role rows and blank down rows, and no victim, time or count', () => {
    const sheet = renderObserverSheet(keys[0]!);
    expect(sheet).toContain('# Fight 1');
    expect(sheet).not.toContain('Fight 2');
    expect(sheet).toContain('| Who went down | Who or what downed them |');
    expect((sheet.match(/^\| \| \|$/gm) ?? []).length).toBe(DOWN_ROWS);
    expect(DOWN_ROWS).toBeGreaterThan(keys[0]!.downs.length);
    for (const d of keys[0]!.downs) expect(sheet).not.toContain(`${d.seconds.toFixed(0)} s`);
  });

  it('the tally has the totals and the 90% line; the key sheet has the answers with the credited fighter', () => {
    const total = keys.reduce((s, k) => s + promptsFor(k).length, 0);
    const tally = renderTally(keys);
    expect(tally).toContain(`**${total}**`);
    expect(tally).toContain(`${Math.ceil(total * 0.9)} of ${total}`);
    expect(tally).toContain('| 2 | |');
    const key = renderAnswerKey(keys);
    expect(key).toContain(keys[0]!.units[keys[0]!.tanks[0][0]!]!.name);
    expect(key).toContain('credited: ');
    expect(key).toContain('not credited');
  });

  it('the answers template has the roles empty and one empty down row per fight', () => {
    const t = answersTemplate(keys, 'agent-9');
    expect(t.observer).toBe('agent-9');
    expect(Object.keys(t.fights)).toEqual(['1', '2']);
    expect(t.fights['1']!.roles).toEqual({ 'tank.us': '', 'tank.them': '', 'healer.us': '', 'healer.them': '' });
    expect(t.fights['1']!.downs).toEqual([{ victim: '', cause: '' }]);
  });

  it('writes the sheet per fight, the manifest with its source, and the key apart from the packets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vis003-files-'));
    try {
      writeVis003Files(dir, keys.map((key) => ({ key, captures: [] })), { seed: 's', commit: 'abc', source: 'mock' });
      const files = (d: string): string[] => readdirSync(join(dir, d)).sort();
      expect(files('sheets')).toEqual(['fight-1.md', 'fight-2.md']);
      expect(files('keys')).toEqual(['fight-1.key.json', 'fight-2.key.json']);
      expect(files('packets/fight-1')).toEqual(['observer-brief.md', 'prompts.json']);
      const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { source: string };
      expect(manifest.source).toBe('mock');
      expect(visSourceOf(dir)).toBe('mock');
      expect(readFileSync(join(dir, 'owner-tally.md'), 'utf8')).toContain('SELF-TEST');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('finding the run to use', () => {
  const make = (root: string, run: string, source: 'game' | 'mock'): void => {
    mkdirSync(join(root, run, 'vis003', 'keys'), { recursive: true });
    writeFileSync(join(root, run, 'vis003', 'manifest.json'), JSON.stringify({ source }));
  };

  it('latest is the newest run of the real game; a newer self-test is never picked', () => {
    const root = mkdtempSync(join(tmpdir(), 'vis003-runs-'));
    try {
      make(root, '20261028-090000', 'game');
      make(root, '20261028-100000', 'game');
      make(root, '20261028-110000', 'mock');
      expect(latestRealVisDir(root)).toBe(join(root, '20261028-100000', 'vis003'));
      expect(visRuns(root).map((r) => `${r.name}:${r.source}`)).toEqual(['20261028-090000:game', '20261028-100000:game', '20261028-110000:mock']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('with only self-test runs there is no latest', () => {
    const root = mkdtempSync(join(tmpdir(), 'vis003-runs-'));
    try {
      make(root, '20261028-110000', 'mock');
      expect(latestRealVisDir(root)).toBeNull();
      expect(latestRealVisDir(join(root, 'missing'))).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a folder without a manifest counts as real (unknown), not as a self-test', () => {
    const root = mkdtempSync(join(tmpdir(), 'vis003-runs-'));
    try {
      mkdirSync(join(root, 'r1', 'vis003', 'keys'), { recursive: true });
      expect(visSourceOf(join(root, 'r1', 'vis003'))).toBe('unknown');
      expect(latestRealVisDir(root)).toBe(join(root, 'r1', 'vis003'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/** What the screen would show for a fight: a strip row with glyphs per fighter and a callout and feed after each down. */
function screenFor(key: FightKey, opts: { glyphs?: boolean; wrongGlyphFor?: number; callouts?: boolean; omitAbility?: boolean; onlyFeedAfter?: number } = {}): EvidenceCapture[] {
  const glyphs = opts.glyphs ?? true;
  const roles = key.units.flatMap((u) =>
    glyphs ? (opts.wrongGlyphFor === u.unit ? ['melee'] : u.roles).map((r) => ({ role: r, aria: r, row: `${u.name} ${u.className} 100%` })) : [],
  );
  const feed: string[] = [];
  const captures: EvidenceCapture[] = [{ tick: 10, reason: 'spawn', evidence: { text: key.units.map((u) => u.name).join('\n'), live: [], roles, canvasLabel: null } }];
  for (const d of key.downs) {
    const victim = key.units[d.victim]!;
    const killer = d.killer === null ? null : key.units[d.killer]!;
    const line = `${victim.className} downed by ${killer ? killer.className : 'status damage'}${d.abilityName && !opts.omitAbility ? ` · ${d.abilityName}` : ''}`;
    feed.push(line);
    const ev = (live: string[], text: string): ScreenEvidence => ({ text, live, roles, canvasLabel: null });
    if (opts.callouts !== false) captures.push({ tick: d.tick + 2, reason: 'down', evidence: ev([line, ...feed], `${line}\n${feed.join('\n')}`) });
    captures.push({ tick: d.tick + 30, reason: 'after-down', evidence: ev([...feed], feed.join('\n')) });
  }
  captures.push({ tick: key.durationTicks - 1, reason: 'end', evidence: { text: feed.join('\n'), live: [...feed], roles, canvasLabel: null } });
  return captures.sort((a, b) => a.tick - b.tick);
}

describe('the on-screen evidence proxy', () => {
  const key = keyOf();

  it('reads each fighter\'s glyphs from the rows that name them', () => {
    const shown = shownRoles(key.units, screenFor(key)[0]!.evidence!);
    expect(shown.size).toBe(10);
    for (const u of key.units) expect([...shown.get(u.unit)!].sort()).toEqual([...u.roles].sort());
  });

  it('passes when glyphs agree with the classes and every cause is named', () => {
    const s = summarizeEvidence(scoreEvidence(key, screenFor(key)));
    expect(s.roles).toEqual({ identifiable: 4, total: 4 });
    expect(s.causes.named).toBe(key.downs.length);
    expect(s.causes.persistent).toBeGreaterThanOrEqual(1);
    expect(s.pass).toBe(true);
  });

  it('fails the roles when no glyphs are on screen', () => {
    const r = scoreEvidence(key, screenFor(key, { glyphs: false })).filter((x) => x.kind !== 'down');
    expect(r.every((x) => !x.identifiable)).toBe(true);
    expect(r[0]!.why).toMatch(/no capture carried role glyphs/);
  });

  it('fails a role when a fighter wears the wrong glyph', () => {
    const tank = key.tanks[0][0]!;
    const r = scoreEvidence(key, screenFor(key, { wrongGlyphFor: tank }));
    const prompt = r.find((x) => x.prompt === 'tank.us')!;
    expect(prompt.identifiable).toBe(false);
    expect(prompt.why).toMatch(/disagrees with the class roles/);
  });

  it('fails the causes when no callout or feed names them', () => {
    const r = scoreEvidence(key, screenFor(key, { callouts: false })).filter((x) => x.kind === 'down');
    // The after-down frame is 30 ticks on, still inside the callout window plus lag (40 + 8), so the feed entry counts.
    expect(30).toBeLessThan(CALLOUT_TICKS);
    expect(r.every((x) => x.identifiable)).toBe(true);
    const none = scoreEvidence(key, screenFor(key, { callouts: false }).filter((c) => c.reason === 'spawn' || c.reason === 'end')).filter((x) => x.kind === 'down');
    expect(none.every((x) => !x.identifiable)).toBe(true);
    expect(none[0]!.why).toMatch(/no capture within the callout window/);
  });

  it('reads a feed entry whose ability is on the line after it, past other lines that name the same two fighters', () => {
    // As the real feed prints: an interrupt by the same killer first, then the down, with the ability on its own line.
    const d = key.downs.find((x) => x.killer !== null && x.abilityName)!;
    const v = key.units[d.victim]!.name;
    const k = key.units[d.killer!]!.name;
    const text = ['0:33', `${v} interrupted by ${k}`, '0:45', 'Overtime begins', '0:45', `${v} downed by ${k}`, d.abilityName, 'Paused: overtime starts'].join('\n');
    const evidence: ScreenEvidence = { text, live: [], roles: [], canvasLabel: null };
    const r = scoreEvidence(key, [{ tick: d.tick + 2, reason: 'down', evidence }]).find((x) => x.prompt === `down.${d.index}`)!;
    expect(r.identifiable).toBe(true);
    // ...and not when the ability line is missing
    const without = { ...evidence, text: text.replace(d.abilityName!, 'something else') };
    expect(scoreEvidence(key, [{ tick: d.tick + 2, reason: 'down', evidence: without }]).find((x) => x.prompt === `down.${d.index}`)!.identifiable).toBe(false);
  });

  it('fails a cause whose ability is not named', () => {
    const withAbility = key.downs.filter((d) => d.abilityName);
    expect(withAbility.length).toBeGreaterThan(0);
    const r = scoreEvidence(key, screenFor(key, { omitAbility: true })).filter((x) => x.kind === 'down');
    const abilityRows = r.filter((x) => key.downs[Number(x.prompt.split('.')[1]) - 1]!.abilityName);
    expect(abilityRows.every((x) => !x.identifiable)).toBe(true);
    expect(abilityRows[0]!.why).toMatch(/does not name the ability/);
  });
});

describe('the evidence scorer on the evidence recorded from a real run (20261028-072400, fight 1, down 5)', () => {
  interface Recorded {
    tick: number;
    down: { tick: number; victim: string; victimClass: string; killer: string; killerClass: string; ability: string };
    evidence: Pick<ScreenEvidence, 'text' | 'live'>;
  }
  const rec = JSON.parse(readFileSync(new URL('../fixtures/evidence-fight1-down5.json', import.meta.url), 'utf8')) as Recorded;

  /** A key with the ten fighters of that fight's feed; the victim and the killer are the ones of the recorded down. */
  function recordedKey(): FightKey {
    const names: [string, string][] = [
      ['Yenen of the Bright Hour', 'Warlock'], ['Torrok Stoneeye', 'Ranger'], [rec.down.killer, rec.down.killerClass], ['Perwen Dunmere', 'Bladeturner'], ['Yorisa Ashwood', 'Cleric'],
      ['Moketh Redmane', 'Warrior'], ['Belon Colelow', 'Leechblade'], ['Borda Deepmark', 'Galeshaper'], ['Solae Sootstep', 'Mage'], [rec.down.victim, rec.down.victimClass],
    ];
    return {
      fight: 1,
      fixtureId: null,
      round: 1,
      ourSide: 0,
      clubNames: ['A', 'B'],
      units: names.map(([name, className], unit) => ({ unit, side: unit < 5 ? 0 : 1, fighterId: `f${unit}`, name, className, roles: ['melee'] })),
      tanks: [[], []],
      healers: [[], []],
      downs: [{ index: 1, tick: rec.down.tick, seconds: 45.7, victim: 9, killer: 2, ability: 'hushweaver_muting_needle', abilityName: rec.down.ability, assists: [] }],
      winnerSide: 0,
      durationTicks: 1092,
      logHash: 'recorded',
    };
  }
  // The recorded excerpt has no role rows (they play no part in a down); the rest of the shape is filled in.
  const named = (e: Pick<ScreenEvidence, 'text' | 'live'>): boolean => scoreEvidence(recordedKey(), [{ tick: rec.tick, reason: 'after-down', evidence: { roles: [], canvasLabel: null, ...e } }]).find((r) => r.prompt === 'down.1')!.identifiable;

  it('finds the down in the feed text, past the interrupt by the same fighter just before it', () => {
    expect(named({ ...rec.evidence, live: [] })).toBe(true);
  });

  it('finds it in the collapsed live region too', () => {
    expect(named({ ...rec.evidence, text: '' })).toBe(true);
  });

  it('does not find it when the ability line is not there (the same text with the ability taken out)', () => {
    const without = (t: string): string => t.split('Muting Needle').join('');
    expect(named({ ...rec.evidence, text: without(rec.evidence.text), live: rec.evidence.live.map(without) })).toBe(false);
  });

  it('the recorded text really has the pattern that broke the first scorer: two lines naming the pair, the ability only after the second', () => {
    const lines = rec.evidence.text.split('\n');
    const pair = lines.filter((l) => l.includes(rec.down.victim) && l.includes(rec.down.killer));
    expect(pair).toHaveLength(2);
    expect(pair.some((l) => /interrupted by/.test(l))).toBe(true);
    expect(lines[lines.indexOf(pair[1]!) + 1]).toBe(rec.down.ability);
  });
});
