/**
 * The vis-003 kit on real fight logs: the answer key, the prompts, the capture plan, the scoring of observers' answers,
 * answer-file parsing, and the on-screen evidence proxy. The logs come from the sim on content/default (full record level).
 */
import { describe, expect, it } from 'vitest';
import { loadContent, type ContentDB } from '../../../src/core/content';
import type { FightLog } from '../../../src/core/model';
import { sideInput, simulateRound } from '../../../src/core/sim';
import { loadRawContentFromDisk } from '../../lib/node-content';
import { CROSS_CASES } from '../cross/cases';
import { extractJson, mergeAnswers, parseAnswerFile } from './answers';
import { CALLOUT_TICKS, scoreEvidence, shownRoles, summarizeEvidence, type EvidenceCapture } from './evidence';
import { buildFightKey } from './key';
import { answersTemplate, frameFile, renderAnswerKey, renderObserverBrief, renderOwnerSheet } from './packet';
import { planCaptures } from './plan';
import { promptsFor } from './prompts';
import { normalize, scoreFight, scoreObserver, summarize, unitsMentioned } from './score';
import type { FightKey, ScreenEvidence } from './types';

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
  const prompts = promptsFor(key);

  it('four role prompts and one per down, never saying the answer', () => {
    expect(prompts.filter((p) => p.kind !== 'down').map((p) => p.id)).toEqual(['tank.us', 'tank.them', 'healer.us', 'healer.them']);
    expect(prompts.filter((p) => p.kind === 'down')).toHaveLength(key.downs.length);
    const text = prompts.map((p) => p.text).join('\n');
    const d = key.downs[0]!;
    if (d.killer !== null) expect(prompts.find((p) => p.id === 'down.1')!.text).not.toContain(key.units[d.killer]!.name);
    for (const u of key.units.filter((x) => x.roles.includes('healer'))) expect(prompts[0]!.text + prompts[1]!.text).not.toContain(u.name);
    expect(text).toContain('solid brass rings');
    expect(text).toContain('double steel-blue rings');
  });

  it('the down prompt names the victim and the time', () => {
    const d = key.downs[0]!;
    const p = prompts.find((x) => x.id === 'down.1')!;
    expect(p.text).toContain(key.units[d.victim]!.name);
    expect(p.text).toContain(`${d.seconds.toFixed(0)} s`);
    expect(p.victim).toBe(d.victim);
  });
});

describe('the capture plan', () => {
  const key = keyOf();

  it('starts at the spawn, ends at the end, and brackets every down', () => {
    const plan = planCaptures(key);
    expect(plan[0]).toEqual({ tick: 10, reason: 'spawn' });
    // The last frame is at the last tick (a down that ends the fight takes that frame over from the plain end frame).
    expect(plan[plan.length - 1]!.tick).toBe(key.durationTicks);
    for (const d of key.downs) {
      // A frame while the callout is on screen (it lasts 40 ticks), and the frame where it is named is kept when downs cluster.
      expect(plan.some((p) => p.tick >= d.tick && p.tick < d.tick + 40)).toBe(true);
    }
  });

  it('is sorted, within the fight, and thinned', () => {
    const plan = planCaptures(key, { everyTicks: 80, minGapTicks: 6 });
    for (let i = 1; i < plan.length; i++) expect(plan[i]!.tick - plan[i - 1]!.tick).toBeGreaterThanOrEqual(6);
    expect(plan.every((p) => p.tick <= key.durationTicks)).toBe(true);
    expect(plan.length).toBeLessThan(80);
  });

  it('a longer interval gives fewer frames', () => {
    expect(planCaptures(key, { everyTicks: 200 }).length).toBeLessThan(planCaptures(key, { everyTicks: 40 }).length);
  });

  it('frame file names carry the number and the tick', () => {
    expect(frameFile(3, 142)).toBe('frames/f03-t0142.png');
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

describe('scoring one fight', () => {
  const key = keyOf();

  function perfect(): Record<string, string> {
    const a: Record<string, string> = {};
    const name = (u: number): string => key.units[u]!.name;
    a['tank.us'] = name(key.tanks[0][0]!);
    a['tank.them'] = name(key.tanks[1][0]!);
    a['healer.us'] = name(key.healers[0][0]!);
    a['healer.them'] = name(key.healers[1][0]!);
    for (const d of key.downs) a[`down.${d.index}`] = `${d.killer === null ? 'status damage' : name(d.killer)}${d.abilityName ? ` with ${d.abilityName}` : ''}`;
    return a;
  }

  it('perfect answers by name score 100%', () => {
    const results = scoreFight(key, perfect());
    expect(results.every((r) => r.correct)).toBe(true);
    const s = summarize('obs', results);
    expect(s.rate).toBe(1);
    expect(s.pass).toBe(true);
    expect(s.byKind.tank.total).toBe(2);
    expect(s.byKind.down.total).toBe(key.downs.length);
  });

  it('class names score too (a class holding the role on that side)', () => {
    const a = perfect();
    a['tank.us'] = key.units[key.tanks[0][0]!]!.className;
    expect(scoreFight(key, a).find((r) => r.prompt === 'tank.us')!.correct).toBe(true);
  });

  it('naming the wrong fighter, or the other side\'s, is wrong', () => {
    const a = perfect();
    a['healer.us'] = key.units[key.tanks[0][0]!]!.name;
    a['tank.them'] = key.units[key.tanks[0][0]!]!.name;
    const r = scoreFight(key, a);
    expect(r.find((x) => x.prompt === 'healer.us')!.correct).toBe(false);
    expect(r.find((x) => x.prompt === 'tank.them')!.correct).toBe(false);
    expect(r.find((x) => x.prompt === 'healer.us')!.why).toMatch(/not the healer|not only the healer/);
  });

  it('naming a tank and a non-tank together is wrong', () => {
    const a = perfect();
    const nonTank = key.units.find((u) => u.side === 0 && !u.roles.includes('tank'))!;
    a['tank.us'] = `${key.units[key.tanks[0][0]!]!.name} and ${nonTank.name}`;
    expect(scoreFight(key, a).find((x) => x.prompt === 'tank.us')!.correct).toBe(false);
  });

  it('unanswered and "unclear" prompts are wrong', () => {
    const a = perfect();
    delete a['tank.us'];
    a['healer.them'] = 'unclear';
    const r = scoreFight(key, a);
    expect(r.find((x) => x.prompt === 'tank.us')).toMatchObject({ correct: false, why: 'no answer' });
    expect(r.find((x) => x.prompt === 'healer.them')!.correct).toBe(false);
    expect(summarize('o', r).unanswered).toBe(1);
  });

  it('the killer is what counts for a down; the ability only when strict', () => {
    const d = key.downs.find((x) => x.killer !== null && x.abilityName)!;
    const killer = key.units[d.killer!]!.name;
    const a = { ...perfect(), [`down.${d.index}`]: killer };
    expect(scoreFight(key, a).find((x) => x.prompt === `down.${d.index}`)!.correct).toBe(true);
    const strict = scoreFight(key, a, { strictAbility: true }).find((x) => x.prompt === `down.${d.index}`)!;
    expect(strict.correct).toBe(false);
    expect(strict.abilityNamed).toBe(false);
  });

  it('a down answer that names the victim and the killer still scores; one naming only the victim does not', () => {
    const d = key.downs.find((x) => x.killer !== null)!;
    const victim = key.units[d.victim]!.name;
    const killer = key.units[d.killer!]!.name;
    expect(scoreFight(key, { ...perfect(), [`down.${d.index}`]: `${victim} was killed by ${killer}` }).find((x) => x.prompt === `down.${d.index}`)!.correct).toBe(true);
    expect(scoreFight(key, { ...perfect(), [`down.${d.index}`]: `${victim} died` }).find((x) => x.prompt === `down.${d.index}`)!.correct).toBe(false);
  });

  it('listing most of the enemy team is not an answer', () => {
    const d = key.downs.find((x) => x.killer !== null)!;
    const victimSide = key.units[d.victim]!.side;
    const everyone = key.units.filter((u) => u.side !== victimSide).map((u) => u.name).join(', ');
    expect(scoreFight(key, { ...perfect(), [`down.${d.index}`]: everyone }).find((x) => x.prompt === `down.${d.index}`)!.correct).toBe(false);
  });

  it('90% is the bar, per observer', () => {
    const results = scoreFight(key, perfect());
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
    const answers = { observer: 'agent-1', fights: { '1': { 'tank.us': keys[0]!.units[keys[0]!.tanks[0][0]!]!.name } } };
    const { results, summary } = scoreObserver(keys, answers);
    expect(results.length).toBe(keys.reduce((s, k) => s + promptsFor(k).length, 0));
    expect(summary.correct).toBe(1);
    expect(summary.byFight).toHaveLength(5);
    expect(summary.pass).toBe(false);
  });
});

describe('answer files', () => {
  it('extracts the JSON from prose and code fences', () => {
    const obj = extractJson('Sure! Here is my answer:\n```json\n{"observer":"a","fight":2,"answers":{"tank.us":"Knight {x}"}}\n```\nDone.') as { fight: number };
    expect(obj.fight).toBe(2);
    expect(() => extractJson('no json here')).toThrow();
    expect(() => extractJson('{"a": 1')).toThrow(/not closed/);
  });

  it('reads per-fight and combined files and merges by observer', () => {
    const a = parseAnswerFile('{"observer":"agent-1","fight":1,"answers":{"tank.us":"A"}}');
    const b = parseAnswerFile('{"observer":"agent-1","fight":2,"answers":{"tank.us":"B"}}');
    const c = parseAnswerFile('{"observer":"person","fights":{"1":{"tank.us":"C"},"2":{"healer.us":"D"}}}');
    const merged = mergeAnswers([a, b, c]);
    expect(merged).toHaveLength(2);
    expect(merged.find((m) => m.observer === 'agent-1')!.fights).toEqual({ '1': { 'tank.us': 'A' }, '2': { 'tank.us': 'B' } });
    expect(merged.find((m) => m.observer === 'person')!.fights['2']).toEqual({ 'healer.us': 'D' });
  });

  it('an observer left as the template placeholder falls back to the file name', () => {
    expect(parseAnswerFile('{"observer":"<your name>","fight":1,"answers":{}}', 'file-name').observer).toBe('file-name');
  });

  it('non-string answers become text and a malformed file is refused', () => {
    expect(parseAnswerFile('{"observer":"o","fight":1,"answers":{"a":null,"b":5}}').fights['1']).toEqual({ a: '', b: '5' });
    expect(() => parseAnswerFile('{"observer":"o"}')).toThrow(/expected/);
  });
});

describe('packet documents', () => {
  const keys = [keyOf(0, 1), keyOf(1, 2)];

  it('the observer brief carries the rules, every prompt and the answer format, and never the key', () => {
    const brief = renderObserverBrief({ key: keys[0]!, captures: [] });
    expect(brief).toContain('Open **nothing else**');
    for (const p of promptsFor(keys[0]!)) expect(brief).toContain(`\`${p.id}\``);
    expect(brief).toContain('"answers"');
    const holder = keys[0]!.units[keys[0]!.tanks[0][0]!]!;
    expect(brief).not.toContain(`Tank: ${holder.name}`);
    expect(brief).not.toContain(keys[0]!.logHash);
  });

  it('the owner sheet has blank answer lines, a total and the 90% number; the key sheet has the answers', () => {
    const sheet = renderOwnerSheet(keys);
    const total = keys.reduce((s, k) => s + promptsFor(k).length, 0);
    expect(sheet).toContain(`____ of ${total}`);
    expect(sheet).toContain(`${Math.ceil(total * 0.9)} of ${total}`);
    expect(sheet).toContain('## Fight 2');
    const key = renderAnswerKey(keys);
    expect(key).toContain(keys[0]!.units[keys[0]!.tanks[0][0]!]!.name);
    expect(key).toContain('with ');
    // The sheet asks; it never lists who holds a role.
    expect(sheet).not.toContain("holds the tank");
  });

  it('the answers template has every prompt of every fight, empty', () => {
    const t = answersTemplate(keys, 'agent-9');
    expect(t.observer).toBe('agent-9');
    expect(Object.keys(t.fights)).toEqual(['1', '2']);
    expect(Object.values(t.fights['1']!).every((v) => v === '')).toBe(true);
    expect(Object.keys(t.fights['1']!)).toEqual(promptsFor(keys[0]!).map((p) => p.id));
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

  it('fails a cause whose ability is not named', () => {
    const withAbility = key.downs.filter((d) => d.abilityName);
    expect(withAbility.length).toBeGreaterThan(0);
    const r = scoreEvidence(key, screenFor(key, { omitAbility: true })).filter((x) => x.kind === 'down');
    const abilityRows = r.filter((x) => key.downs[Number(x.prompt.split('.')[1]) - 1]!.abilityName);
    expect(abilityRows.every((x) => !x.identifiable)).toBe(true);
    expect(abilityRows[0]!.why).toMatch(/does not name the ability/);
  });
});
