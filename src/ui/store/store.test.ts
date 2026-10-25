import { describe, expect, it } from 'vitest';
import type { ClubId, GameState } from '../../core/model';
import { NotImplementedError, engineError, err } from '../../core/util';
import { createDevEngine } from '../debug/dev-engine';
import { createTestStore } from '../debug/test-store';
import { coreEngine, type GameEngine } from './engine';
import { blockerText, distinctBlockers, errorText } from './messages';
import { AUTOSAVE_SLOTS } from './create-store';
import { newsToDigest } from './digest';
import type { NewsItem } from '../../core/model';

function playerClub(state: GameState) {
  return state.clubs[state.playerClubId as ClubId]!;
}

describe('store: content and new game', () => {
  it('loads content and starts a career whose club is chosen by command', async () => {
    const { store } = createTestStore({ world: 'none' });
    expect(store.content.value?.ref.id).toBe('fixture');
    expect(store.game.value).toBeNull();
    const busySeen: boolean[] = [];
    const pending = store.newGame({ seed: 'abc' });
    busySeen.push(store.busy.value);
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(busySeen).toEqual([true]);
    expect(store.busy.value).toBe(false);
    expect(store.game.value?.rng.root).toBe('abc');
    expect(store.playerClubId.value).toBeNull();
    expect(store.blockers.value.map((b) => b.code)).toContain('club.not-chosen');
    const clubId = store.game.value!.clubs[Object.keys(store.game.value!.clubs)[0] as ClubId]!.id;
    expect(store.dispatch({ type: 'club.choose', clubId }).ok).toBe(true);
    expect(store.playerClubId.value).toBe(clubId);
  });

  it('reports content problems instead of throwing', () => {
    const { store } = createTestStore({ world: 'none' });
    const res = store.initContent('nope-theme');
    expect(res.ok).toBe(false);
    expect(store.contentIssues.value.length).toBeGreaterThan(0);
  });

  it('rejects an invalid custom seed', async () => {
    const { store } = createTestStore({ world: 'none' });
    const res = await store.newGame({ seed: 'a\u001fb' });
    expect(res.ok).toBe(false);
    expect(store.lastError.value?.code).toBe('seed.invalid');
  });
});

describe('store: dispatch', () => {
  it('commits a valid command, logs it and freezes the state in dev', () => {
    const { store } = createTestStore();
    const before = store.game.value!;
    const club = playerClub(before);
    const fighterId = club.lineup.fighters[0]!.fighterId;
    const res = store.dispatch({ type: 'training.set', clubId: club.id, fighterId, emphasis: 'body' });
    expect(res.ok).toBe(true);
    expect(store.game.value).not.toBe(before);
    expect(store.game.value!.fighters[fighterId]!.trainingEmphasis).toBe('body');
    expect(before.fighters[fighterId]!.trainingEmphasis).toBe('balanced');
    expect(Object.isFrozen(store.game.value)).toBe(true);
    expect(store.commandLog.value).toHaveLength(1);
    expect(store.recentCommands.value[0]!.command.type).toBe('training.set');
    expect(store.dirty.value).toBe(true);
  });

  it('keeps the state and sets lastError when a command fails', () => {
    const { store } = createTestStore();
    const before = store.game.value!;
    const club = playerClub(before);
    const id = club.lineup.fighters[0]!.fighterId;
    const res = store.dispatch({ type: 'captaincy.set', clubId: club.id, captainId: id, viceCaptainId: id });
    expect(res.ok).toBe(false);
    expect(store.game.value).toBe(before);
    expect(store.lastError.value?.code).toBe('captaincy.same');
  });

  it('maps a core stub to engine.not-implemented with readable text', () => {
    const engine: GameEngine = {
      ...createDevEngine(),
      applyCommand: () => {
        throw new NotImplementedError('game.applyCommand');
      },
    };
    const { store } = createTestStore({ engine });
    const club = playerClub(store.game.value!);
    const res = store.dispatch({ type: 'shortlist.toggle', clubId: club.id, fighterId: club.lineup.fighters[0]!.fighterId });
    expect(res.ok).toBe(false);
    expect(store.lastError.value?.code).toBe('engine.not-implemented');
    expect(errorText(store.lastError.value!)).toContain('game.applyCommand');
  });

  it('turns an unexpected crash into engine.crash', () => {
    const engine: GameEngine = {
      ...createDevEngine(),
      applyCommand: () => {
        throw new Error('boom');
      },
    };
    const { store } = createTestStore({ engine });
    const club = playerClub(store.game.value!);
    store.dispatch({ type: 'shortlist.toggle', clubId: club.id, fighterId: club.lineup.fighters[0]!.fighterId });
    expect(store.lastError.value).toMatchObject({ code: 'engine.crash', message: 'boom' });
  });
});

describe('store: advance', () => {
  it('guards against a double advance', async () => {
    const { store } = createTestStore();
    const a = store.advance();
    const b = await store.advance();
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error.code).toBe('engine.busy');
    const ra = await a;
    expect(ra.ok).toBe(true);
    expect(store.lastWeekReport.value?.weekIndex).toBe(11);
    expect(store.game.value!.calendar.weekIndex).toBe(12);
  });

  it('does not commit when the engine refuses, and maps the error', async () => {
    const engine: GameEngine = { ...createDevEngine(), advanceWeek: () => err(engineError('lineup.incomplete', 'no')) };
    const { store } = createTestStore({ engine });
    const before = store.game.value;
    const res = await store.advance();
    expect(res.ok).toBe(false);
    expect(store.game.value).toBe(before);
    expect(store.busy.value).toBe(false);
    expect(store.lastError.value?.code).toBe('lineup.incomplete');
  });

  it('autosaves after every advance, rotating over three slots (oldest overwritten)', async () => {
    const { store, saves, clock } = createTestStore();
    for (let i = 0; i < 4; i++) {
      clock.advance(60_000);
      // Integrator (WP5): with the real lifecycle an injury can block Continue; auto-pick like a player would.
      if (store.blockers.value.length > 0) store.dispatch(coreEngine.suggestLineup(store.game.value!, store.playerClubId.value!, store.content.value!));
      const r = await store.advance();
      expect(r.ok).toBe(true);
    }
    const metas = await saves.list();
    expect(metas.map((m) => m.slotId).sort()).toEqual([...AUTOSAVE_SLOTS]);
    expect(metas.every((m) => m.kind === 'auto')).toBe(true);
    // The 4th advance overwrote auto-1 (the oldest): it now holds the newest week.
    const auto1 = metas.find((m) => m.slotId === 'auto-1')!;
    expect(auto1.weekIndex).toBe(15);
    expect(Math.max(...metas.map((m) => m.weekIndex))).toBe(15);
    // Four real week processings: ~2 s alone, slower while the core suites run in parallel.
  }, 20_000);
});

describe('store: saves', () => {
  it('saves, loads back the exact state and restores play time', async () => {
    const { store, clock } = createTestStore();
    clock.advance(90_000);
    const saved = await store.save('manual-1', 'Test slot');
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.value).toMatchObject({ slotId: 'manual-1', kind: 'manual', label: 'Test slot', playtimeSec: 90 });
    const snapshot = JSON.stringify(store.game.value);
    await store.advance();
    expect(JSON.stringify(store.game.value)).not.toBe(snapshot);
    const loaded = await store.load('manual-1');
    expect(loaded.ok).toBe(true);
    expect(JSON.stringify(store.game.value)).toBe(snapshot);
    expect(store.currentSlot.value).toBe('manual-1');
    expect(store.dirty.value).toBe(false);
  });

  it('reports each load failure with a SaveError code and never half-loads', async () => {
    const { store, saves } = createTestStore();
    const before = store.game.value;
    const empty = await store.load('manual-9');
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(errorText(empty.error)).toBe('That save slot is empty.');

    await saves.write('manual-2', '{not json', { ...(await metaOf(store)), slotId: 'manual-2' });
    const bad = await store.load('manual-2');
    expect(!bad.ok && bad.error.code).toBe('save.json');

    await store.save('manual-3');
    const rec = saves.records.get('manual-3')!;
    const tampered = JSON.parse(rec.json) as { state: GameState };
    tampered.state.calendar.season = 99;
    await saves.write('manual-3', JSON.stringify(tampered), rec.meta);
    const sum = await store.load('manual-3');
    expect(!sum.ok && sum.error.code).toBe('save.checksum');
    expect(store.game.value!.calendar.season).toBe(before!.calendar.season);
  });

  it('keeps the previous file when a write fails', async () => {
    const { store, saves } = createTestStore();
    await store.save('manual-1', 'first');
    saves.failNextWrite();
    const res = await store.save('manual-1', 'second');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('save.storage');
    expect(saves.records.get('manual-1')!.meta.label).toBe('first');
  });

  it('exports, imports into a free manual slot and deletes', async () => {
    const { store, downloads } = createTestStore();
    await store.save('manual-1', 'Export me');
    expect((await store.exportSave('manual-1')).ok).toBe(true);
    expect(downloads[0]!.fileName).toBe('export-me.json');
    const imported = await store.importSave(new Blob([downloads[0]!.text]));
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.value.slotId).toBe('manual-2');
    expect((await store.deleteSave('manual-1')).ok).toBe(true);
    expect((await store.listSaves()).map((m) => m.slotId)).toEqual(['manual-2']);
    const junk = await store.importSave(new Blob(['[]']));
    expect(!junk.ok && junk.error.code).toBe('save.format');
  });

  it('quick save uses the current slot, else the first free one', async () => {
    const { store } = createTestStore();
    const a = await store.quickSave();
    expect(a.ok && a.value.slotId).toBe('manual-1');
    const b = await store.quickSave();
    expect(b.ok && b.value.slotId).toBe('manual-1');
  });

  it('dumps the state with the command log and build info', () => {
    const { store, downloads } = createTestStore();
    const club = playerClub(store.game.value!);
    store.dispatch({ type: 'training.set', clubId: club.id, fighterId: club.lineup.fighters[0]!.fighterId, emphasis: 'mind' });
    store.dumpState();
    expect(downloads).toHaveLength(1);
    expect(downloads[0]!.fileName).toMatch(/^.+-s1w11\.state-dump\.json$/);
    const dump = JSON.parse(downloads[0]!.text) as { commandLog: unknown[]; build: { gameVersion: string } };
    expect(dump.commandLog).toHaveLength(1);
    expect(dump.build.gameVersion).toBe('0.0.0-test');
  });
});

describe('store: with core stubs', () => {
  it('turns stubs into errors, never exceptions', async () => {
    const engine: GameEngine = {
      ...coreEngine,
      createWorld: () => {
        throw new NotImplementedError('game.createWorld');
      },
    };
    const { store } = createTestStore({ world: 'none', engine });
    const res = await store.newGame();
    expect(res.ok).toBe(false);
    expect(store.lastError.value?.code).toBe('engine.not-implemented');
  });
});

async function metaOf(store: ReturnType<typeof createTestStore>['store']) {
  const res = await store.save('manual-10');
  if (!res.ok) throw new Error('save failed');
  await store.deleteSave('manual-10');
  return res.value;
}

describe('digest copy from core news', () => {
  const news = (key: string, params: Record<string, string | number>, refs: NewsItem['refs'] = {}): NewsItem =>
    ({ id: 'n-1', at: { season: 1, weekIndex: 3 }, key, params, clubId: null, refs, importance: 'notable', read: false }) as NewsItem;

  it('names the fighter and fills every slot for the keys core writes', () => {
    const { store } = createTestStore();
    const state = store.game.value!;
    const content = store.content.value!;
    const club = state.clubs[state.playerClubId as ClubId]!;
    const starter = club.lineup.fighters[0]!.fighterId;
    const trait = content.traits.list[0]!.id;
    const cases: [string, Record<string, string | number>][] = [
      ['fighter.injured', { severity: content.development.injury.severityLadder[0]!.id, weeksOut: 3, round: 2 }],
      ['fighter.career_ended', {}],
      ['fighter.scarred', { traitId: trait }],
      ['fighter.trait_gained', { traitId: trait }],
      ['fighter.trait_lost', { traitId: trait }],
      ['fighter.trait_skipped', { traitId: trait }],
      ['fighter.final_season', { age: 34 }],
      ['fighter.retired', { age: 35, cause: 'age' }],
      ['captaincy.snubbed', {}],
      ['captaincy.passed_over', {}],
      ['captaincy.losing_the_room', {}],
      ['captaincy.interim', {}],
      ['offer.accepted', { wage: 450, seasons: 2 }],
      ['offer.countered', { counterWage: 480, validUntilWeek: 5 }],
      ['offer.refused', { patienceLeft: 1 }],
      ['offer.void', { reason: 'fighter.unavailable' }],
      ['finance.registry-advance', { amount: 5000, registryDebt: 5000 }],
    ];
    const name = state.fighters[starter]!.name.full;
    for (const [key, params] of cases) {
      const d = newsToDigest(news(key, params, { fighterId: starter }), { state, content });
      expect(`${d.title} ${d.text}`, key).not.toMatch(/[{}]/);
      if (key.startsWith('fighter.') || key.startsWith('offer.') || key === 'captaincy.interim') expect(d.title, key).toContain(name);
    }
    const lost = newsToDigest(news('offer.lost', {}, { fighterId: starter, otherClubId: Object.keys(state.clubs).find((id) => id !== club.id) as ClubId }), { state, content });
    expect(lost.title).not.toMatch(/[{}]|another club/);
    expect(newsToDigest(news('offer.accepted', { wage: 450, seasons: 1 }, { fighterId: starter }), { state, content }).text).toBe('450 ts/wk for 1 season.');
  });

  it('flags an injury as needing action only while the fighter is an unfit starter', () => {
    const { store } = createTestStore();
    const state = structuredClone(store.game.value!) as GameState;
    const club = state.clubs[state.playerClubId as ClubId]!;
    const starter = club.lineup.fighters[0]!.fighterId;
    const item = news('fighter.injured', { severity: 'minor', weeksOut: 2, round: 1 }, { fighterId: starter });
    state.fighters[starter]!.injury = { severity: 'minor', weeksOut: 2, fixtureId: null, round: 1, causeFighterId: null, damageBp: 0, since: { season: 1, weekIndex: 1 } };
    expect(newsToDigest(item, { state }).needsAction).toBe(true);
    club.lineup.fighters = club.lineup.fighters.slice(1);
    expect(newsToDigest(item, { state }).needsAction).toBe(false);
  });
});

describe('blocker copy', () => {
  it('names the unfit starter and lists the cause once', () => {
    const { store } = createTestStore();
    const state = store.game.value!;
    const club = state.clubs[state.playerClubId as ClubId]!;
    const id = club.lineup.fighters[0]!.fighterId;
    const unfit = { code: 'lineup.unavailable', fighterId: id };
    expect(blockerText(unfit, state)).toBe(`${state.fighters[id]!.name.full} is unfit to play`);
    expect(blockerText(unfit)).toBe('A lineup fighter is unavailable');
    const both = [unfit, { code: 'lineup.incomplete', details: { have: 4, need: 5 } }];
    expect(distinctBlockers(both).map((b) => b.code)).toEqual(['lineup.unavailable']);
    expect(distinctBlockers([both[1]!]).map((b) => b.code)).toEqual(['lineup.incomplete']);
  });
});
