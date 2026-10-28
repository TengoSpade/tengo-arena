/**
 * The self-test (`--self-test`): the driver run against a small mock arena (scripts/smoke/mock) that implements the
 * test hook with a WebGL canvas, a playback clock, auto-pause stops with a 12 ms "save" hitch, and a strip with role
 * glyphs. It tests the DRIVER (CDP, frame recording, trace analysis, pixel checks, report), not the game. The mock's
 * round is a real full-level log simulated here in Node, so its hash is the headless one.
 */
import { join } from 'node:path';
import type { ContentDB } from '../../../src/core/content';
import type { FightLog } from '../../../src/core/model';
import { sideInput, simulateRound } from '../../../src/core/sim';
import { CROSS_CASES } from '../cross/cases';
import { REPO_ROOT } from '../../lib/node-content';
import { serveFolder, type Served } from '../lib/serve';
import type { PacketFight } from '../vis003/packet';
import type { HeadlessRound } from '../lib/headless';
import { PageDriver } from '../lib/page';
import { buildFightKey } from '../vis003/key';
import { watchedRoundSteps } from './arena-steps';
import type { JourneyEnv } from './env';
import { captureFight, finish } from './vis003-capture';

export interface MockRound {
  json: string;
  hash: string;
  log: FightLog;
}

export function mockRound(content: ContentDB): MockRound {
  const c = CROSS_CASES[0]!;
  const input = { round: c.round, home: sideInput(content, 'home', c.home, 0, 1), away: sideInput(content, 'away', c.away, 1, 0) };
  const log = simulateRound(input, c.seed, content, { record: 'full' }).log!;
  const names: Record<number, string> = {};
  const roles: Record<number, readonly string[]> = {};
  log.header.units.forEach((u, i) => {
    const k = content.classes.get(u.classId);
    names[i] = k?.name ?? u.classId;
    roles[i] = k?.archetypes ?? [];
  });
  const abilityNames: Record<string, string> = {};
  for (const e of log.events) if (e.type === 'unit.down' && e.data?.ability) abilityNames[e.data.ability] = content.abilities.get(e.data.ability)?.name ?? e.data.ability;
  return { json: JSON.stringify({ log, meta: { names, roles, abilityNames } }), hash: log.hash, log };
}

export async function startMock(content: ContentDB): Promise<{ served: Served; round: MockRound }> {
  const round = mockRound(content);
  const served = await serveFolder(join(REPO_ROOT, 'scripts', 'smoke', 'mock'), { '/round.json': () => round.json });
  return { served, round };
}

/** The headless reference the mock's state stands for: the sim's own hash of the round the mock plays. */
export function mockHeadless(round: MockRound): () => HeadlessRound {
  return () => ({ hash: round.hash, recomputed: round.hash, source: 'self-test (core/sim in Node)', problem: null });
}

/** The "career" of the self-test: open the mock as a live watched round and run the arena steps on it. */
export async function runMockCareer(env: JourneyEnv): Promise<void> {
  const { rec } = env;
  await rec.journey('career (mock live round)', async () => {
    const page = await PageDriver.open(env.client, { width: 1920, height: 1080, colorScheme: 'dark' });
    try {
      await rec.step('mock.open', 'Open the mock arena as a live round', async () => {
        await page.goto(`${env.baseUrl}/?live=1&theme=dark`);
      });
      await watchedRoundSteps(page, env, { path: 'mock' });
    } finally {
      env.collectConsole(page);
      await page.close();
    }
  });
}

/** The self-test's vis-003 capture: one fight of the mock at 1x (the key comes from the mock's own log). */
export async function runMockVis003(env: JourneyEnv, round: MockRound): Promise<void> {
  const { rec } = env;
  await rec.journey('vis003 capture (mock live round)', async () => {
    const page = await PageDriver.open(env.client, { width: 1280, height: 720, colorScheme: 'dark' });
    const root = join(env.outDir, 'vis003');
    const fights: PacketFight[] = [];
    try {
      await rec.step('mock.vis003', 'Capture one mock fight at 1x', async () => {
        await page.goto(`${env.baseUrl}/?live=1&theme=dark`);
        await page.waitFor('window.__arena && window.__arena.viewer.frame().units.length === 10', 'the mock round', { timeoutMs: 15_000 });
        const key = buildFightKey(round.log, env.content, { fight: 1, ourSide: 0, clubNames: ['Mock Home', 'Mock Away'] });
        const run = await captureFight(page, key, root);
        rec.say(`  ${run.captures.filter((c) => c.frame !== null).length} frames, ${key.downs.length} downs`);
        fights.push({ key, captures: run.captures });
      });
    } finally {
      env.collectConsole(page);
      await page.close();
      finish(env, root, fights);
    }
  });
}
