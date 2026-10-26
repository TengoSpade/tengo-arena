/**
 * npm run fixture:content
 *
 * Regenerates src/core/testkit/fixture-content.json: a small, FROZEN content
 * set for module tests, derived from content/default. It keeps every
 * constants file whole and trims classes to one base class per archetype
 * plus one hybrid (with their abilities and presets), so tests do not depend
 * on later value edits in content/default and stay fast.
 *
 * Run it only when the content SCHEMA changes (architect); commit the result.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '../src/core/content';
import { REPO_ROOT, loadRawContentFromDisk } from './lib/node-content';

type Json = Record<string, unknown>;

const disk = loadRawContentFromDisk('default');
if (disk.missing.length || disk.errors.length) {
  console.error('content/default is incomplete:', disk.missing, disk.errors);
  process.exit(1);
}
const raw = structuredClone(disk.raw) as Record<string, Json>;

const classesFile = raw['classes']!;
const classes = classesFile['classes'] as Json[];
const picked: Json[] = [];
for (const arch of ['tank', 'melee', 'ranged', 'controller', 'healer']) {
  const k = classes.find((c) => (c['archetypes'] as string[]).length === 1 && (c['archetypes'] as string[])[0] === arch);
  if (k) picked.push(k);
}
const hybrid = classes.find((c) => (c['archetypes'] as string[]).length === 2);
if (hybrid) picked.push(hybrid);
const classIds = new Set(picked.map((c) => c['id'] as string));

classesFile['classes'] = picked;
classesFile['status'] = 'FIXTURE (frozen subset of content/default for tests)';
const abilitiesFile = raw['abilities']!;
abilitiesFile['abilities'] = (abilitiesFile['abilities'] as Json[]).filter((a) => classIds.has(a['classId'] as string));
const presetsFile = raw['tactics-presets']!;
presetsFile['presets'] = (presetsFile['presets'] as Json[]).filter((p) => classIds.has(p['classId'] as string));
// M1.1: one rank row per kept ability; perks and levels stay whole (they are not per class).
const ranksFile = raw['ability-ranks']!;
ranksFile['ranks'] = (ranksFile['ranks'] as Json[]).filter((r) => classIds.has(r['classId'] as string));

const check = loadContent('fixture', raw, { profile: 'fixture' });
if (!check.ok) {
  console.error('fixture content does not validate:', check.error);
  process.exit(1);
}

const out = join(REPO_ROOT, 'src', 'core', 'testkit', 'fixture-content.json');
writeFileSync(out, `${JSON.stringify(raw)}\n`, 'utf8');
console.log(`fixture content: ${picked.length} classes (${[...classIds].join(', ')}) -> ${out}`);
