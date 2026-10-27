import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClubId } from '../../core/model';
import { buildFixtureWorld, fixtureContent } from '../../core/testkit';
import { createTestStore } from '../debug/test-store';
import { coreEngine, isTicketSlot, type AppStore } from '../store';
import { snapshot } from './launcher';
import { reproduceTicket } from './repro';
import { serializeCareer } from './tool';

const ID = 'AL-R001-T001_20261025-193412';

afterEach(() => {
  vi.unstubAllGlobals();
  location.hash = '';
});

async function advance(store: AppStore, weeks: number, tick: () => void): Promise<void> {
  for (let i = 0; i < weeks; i++) {
    tick();
    if (store.blockers.value.length > 0) store.dispatch(coreEngine.suggestLineup(store.game.value!, store.playerClubId.value!, store.content.value!));
    expect((await store.advance()).ok).toBe(true);
  }
}

/** The dev-server plugin's answers for one ticket: its save (as filed) and its metadata. */
function serveTicket(state: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => (url.endsWith('/state.json') ? new Response(state) : new Response(JSON.stringify({ route: { hash: '#/squad' } })))),
  );
}

describe('ticket reproduction', () => {
  it('never touches the career saves: reproduce, advance three weeks, every other slot is byte-identical', async () => {
    const { store, saves, clock } = createTestStore();
    const tick = () => clock.advance(60_000);
    expect((await store.save('manual-1', 'Career A')).ok).toBe(true);
    await advance(store, 3, tick); // fills auto-1..3
    const before = new Map<string, string | null>();
    for (const m of await saves.list()) before.set(m.slotId, await saves.read(m.slotId));
    expect([...before.keys()].sort()).toEqual(['auto-1', 'auto-2', 'auto-3', 'manual-1']);

    serveTicket(serializeCareer(store.engine, snapshot(store))!);
    expect(await reproduceTicket(store, saves, ID)).toBe(true);
    expect(store.loadedSlot.value).toBe(`ticket-${ID}`);
    expect(isTicketSlot(store.loadedSlot.value)).toBe(true); // the frame's banner
    expect(store.currentSlot.value).toBeNull(); // Ctrl S does not write into the ticket either
    expect(location.hash).toBe('#/squad');
    const ticketSave = await saves.read(`ticket-${ID}`);

    await advance(store, 3, tick);
    for (const [slotId, json] of before) expect(await saves.read(slotId), slotId).toBe(json);
    expect((await saves.list()).map((m) => m.slotId).sort()).toEqual(['auto-1', 'auto-2', 'auto-3', 'manual-1', `ticket-${ID}`]);
    expect(await saves.read(`ticket-${ID}`)).toBe(ticketSave); // the reproduction stays as filed

    // Loading a real save ends the reproduction (banner gone, autosaves back).
    expect((await store.load('manual-1')).ok).toBe(true);
    expect(isTicketSlot(store.loadedSlot.value)).toBe(false);
    expect((await store.load(`ticket-${ID}`)).ok).toBe(true);
    await store.newGame({ seed: 'another' });
    expect(store.loadedSlot.value).toBeNull();
  }, 120_000); // plays six weeks: about 5 s alone
});

describe('career id', () => {
  it('is new for every new career (same seed too), kept in its saves and restored by a load', async () => {
    const { store, clock } = createTestStore();
    // The dev world has no saved id: a short stable key from seed and club.
    expect(store.careerId.value).toMatch(/^seed-[0-9a-f]{12}$/);
    await store.newGame({ seed: 'same-seed' });
    const first = store.careerId.value;
    expect(first).toMatch(/^c-[0-9a-f]{16}$/);
    store.dispatch({ type: 'club.choose', clubId: Object.keys(store.game.value!.clubs)[0] as ClubId });
    expect(store.careerId.value).toBe(first);
    expect((await store.save('manual-1')).ok).toBe(true);
    clock.advance(1000);
    await store.newGame({ seed: 'same-seed' });
    const second = store.careerId.value;
    expect(second).not.toBe(first);
    expect((await store.load('manual-1')).ok).toBe(true);
    expect(store.careerId.value).toBe(first);
    // A ticket's save carries the id, so a reproduction files under the same run.
    const state = JSON.parse(serializeCareer(store.engine, snapshot(store))!) as { meta: { careerId?: string } };
    expect(state.meta.careerId).toBe(first);
  }, 60_000);

  it('keeps the fallback key short: a career on a 500-character seed saves and loads with the real core', async () => {
    const { store } = createTestStore({ world: 'none', engine: coreEngine });
    const world = structuredClone(buildFixtureWorld());
    world.rng.root = 's'.repeat(500);
    store.replaceWorld(world, fixtureContent());
    const key = store.careerId.value!;
    expect(key).toMatch(/^seed-[0-9a-f]{12}$/);
    expect((await store.save('manual-1')).ok).toBe(true);
    const loaded = await store.load('manual-1');
    expect(loaded.ok, JSON.stringify(loaded)).toBe(true);
    expect(store.game.value!.rng.root).toHaveLength(500);
    expect(store.careerId.value).toBe(key);
  }, 60_000);
});
