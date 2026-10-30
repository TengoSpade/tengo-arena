/**
 * npm run validate-content -- [--theme default] [--profile theme|fixture]
 *
 * For designers: validates content/<theme>/*.json (schemas, cross-file
 * references, closed vocabularies, exact units, theme counts) and prints
 * every issue as "file › path: message". Exits 1 on errors.
 */
import { formatContentIssues, loadContent, type ValidationProfile } from '../src/core/content';
import { parseArgs, stringArg } from './lib/args';
import { loadRawContentFromDisk } from './lib/node-content';

const args = parseArgs(process.argv.slice(2));
const theme = stringArg(args, 'theme', 'default');
const profile = stringArg(args, 'profile', 'theme') as ValidationProfile;

const disk = loadRawContentFromDisk(theme);
if (disk.errors.length) {
  console.error(`JSON syntax errors:\n  ${disk.errors.join('\n  ')}`);
  process.exit(1);
}
const result = loadContent(theme, disk.raw, { profile });
if (!result.ok) {
  const errors = result.error.filter((i) => i.severity === 'error').length;
  console.error(formatContentIssues(result.error));
  console.error(`\ncontent/${theme}: ${errors} error(s).`);
  process.exit(1);
}
const db = result.value;
if (db.warnings.length) console.log(formatContentIssues(db.warnings));
console.log(
  `content/${theme}: OK (${db.classes.list.length} classes, ${db.abilities.list.length} abilities, ${db.presets.list.length} presets, ` +
    `${db.traits.list.length} traits, ${db.races.list.length} races, ${db.clubs.list.length} clubs; hash ${db.ref.hash}; ${db.warnings.length} warning(s))`,
);
