/**
 * npx tsx scripts/smoke/vis003/cli.ts <command> --run <run folder or its vis003 folder> [options]
 * (the package script `smoke:vis003` runs it)
 *
 *   score      --answers <file> [--answers <file> ...] [--strict-ability] [--min 90]
 *              score observers' answers (the agent observers' JSON replies, or a person's transcription) against the key
 *   precheck   re-score the automated on-screen evidence (roles and causes) from the captured evidence
 *   sheet      rewrite sheets/fight-N.md, owner-tally.md, owner-answer-key.md and answers-template.json from the keys
 *   template   [--observer <name>]  write an empty answers file for an observer
 *
 * The run folder is reports/smoke/<run id> (a `--only vis003` run of `npx tsx scripts/smoke/run.ts`); `latest` picks the
 * newest run made from the real game (a self-test on the mock arena is never picked; name its folder to use it).
 * Exit codes: 0 every observer reached 90%, 1 one did not, 2 usage or missing files.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { intArg, parseArgs, stringArg } from '../../lib/args';
import { REPO_ROOT } from '../../lib/node-content';
import { mergeAnswers, parseAnswerFile } from './answers';
import { latestRealVisDir, visRuns, visSourceOf } from './runs';
import { scoreEvidence, summarizeEvidence } from './evidence';
import { answersTemplate, renderAnswerKey, renderObserverSheet, renderTally } from './packet';
import { scoreObserver } from './score';
import type { Capture, FightKey, ObserverAnswers, PromptResult, ScoreSummary } from './types';

function die(message: string): never {
  console.error(message);
  process.exit(2);
}

export function resolveVisDir(runArg: string): string {
  const reports = join(REPO_ROOT, 'reports', 'smoke');
  let dir = runArg;
  if (runArg === 'latest') {
    const latest = latestRealVisDir(reports);
    if (!latest) {
      const onlyMock = visRuns(reports).length > 0;
      die(`No run of the real game with a vis003 folder under ${reports}${onlyMock ? ' (there are self-test runs on the mock arena; name one with --run <folder> to use it)' : ''}. Run: npx tsx scripts/smoke/run.ts --only vis003`);
    }
    dir = latest;
  }
  dir = resolve(dir);
  if (basename(dir) !== 'vis003' && existsSync(join(dir, 'vis003'))) dir = join(dir, 'vis003');
  if (!existsSync(join(dir, 'keys'))) die(`${dir} has no keys/ folder: not a vis-003 folder`);
  if (visSourceOf(dir) === 'mock') console.warn('warning: this folder is from a SELF-TEST on the mock arena, not from the game');
  return dir;
}

export function readKeys(visDir: string): FightKey[] {
  const files = readdirSync(join(visDir, 'keys')).filter((f) => /^fight-\d+\.key\.json$/.test(f));
  return files
    .map((f) => JSON.parse(readFileSync(join(visDir, 'keys', f), 'utf8')) as FightKey)
    .sort((a, b) => a.fight - b.fight);
}

function readCaptures(visDir: string, fight: number): Capture[] {
  const file = join(visDir, 'evidence', `fight-${fight}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Capture[]) : [];
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function scoreMarkdown(summaries: readonly ScoreSummary[], results: Map<string, PromptResult[]>, strict: boolean): string {
  const lines: string[] = ['# vis-003 agent observer score', '', `Counting rule: a down is right when the observer lists its victim and names the one fighter credited with it${strict ? ' and the ability' : ''} (several enemies named is wrong; "unclear" and "unknown" are wrong). The bar is at least 90% of prompts for each observer.`, ''];
  lines.push('| Observer | Right | Of | Rate | Tanks | Healers | Downs | Result |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const s of summaries) lines.push(`| ${s.observer} | ${s.correct} | ${s.total} | ${pct(s.rate)} | ${s.byKind.tank.correct}/${s.byKind.tank.total} | ${s.byKind.healer.correct}/${s.byKind.healer.total} | ${s.byKind.down.correct}/${s.byKind.down.total} | ${s.pass ? 'PASS' : 'FAIL'} |`);
  for (const s of summaries) {
    lines.push('', `## ${s.observer}`, '');
    lines.push(`By fight: ${s.byFight.map((f) => `fight ${f.fight} ${f.correct}/${f.total}`).join(', ')}${s.unanswered ? `; ${s.unanswered} unanswered` : ''}${s.extraDowns ? `; ${s.extraDowns} listed down(s) matched none of the fight's downs (not counted)` : ''}`, '');
    const wrong = (results.get(s.observer) ?? []).filter((r) => !r.correct);
    if (wrong.length === 0) lines.push('Every prompt right.');
    else {
      lines.push('Wrong or unanswered:', '');
      for (const r of wrong) lines.push(`- fight ${r.fight} \`${r.prompt}\`: "${r.answer.replace(/\s+/g, ' ').slice(0, 120)}" (${r.why})`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const command = argv.find((a) => !a.startsWith('--'));
  const args = parseArgs(argv);
  if (!command || args.has('help')) {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]!.replace(/^\/\*\*\n/, '').replace(/^ \* ?/gm, ''));
    return command ? 0 : 2;
  }
  const visDir = resolveVisDir(stringArg(args, 'run', 'latest'));
  const keys = readKeys(visDir);
  if (keys.length === 0) die(`No keys in ${join(visDir, 'keys')}`);

  if (command === 'sheet') {
    const source = visSourceOf(visDir) === 'mock' ? 'mock' : 'game';
    for (const k of keys) writeFileSync(join(visDir, 'sheets', `fight-${k.fight}.md`), renderObserverSheet(k, source));
    writeFileSync(join(visDir, 'owner-tally.md'), renderTally(keys, source));
    writeFileSync(join(visDir, 'owner-answer-key.md'), renderAnswerKey(keys, source));
    writeFileSync(join(visDir, 'answers-template.json'), `${JSON.stringify(answersTemplate(keys, 'agent-1'), null, 2)}\n`);
    console.log(`wrote the observer sheets, the tally, the answer key and the answers template for ${keys.length} fights in ${visDir}`);
    return 0;
  }
  if (command === 'template') {
    const observer = stringArg(args, 'observer', 'observer-1');
    const out = join(visDir, `answers-${observer}.json`);
    writeFileSync(out, `${JSON.stringify(answersTemplate(keys, observer), null, 2)}\n`);
    console.log(`wrote ${out}`);
    return 0;
  }
  if (command === 'precheck') {
    const results = keys.flatMap((k) => scoreEvidence(k, readCaptures(visDir, k.fight)));
    const summary = summarizeEvidence(results);
    writeFileSync(join(visDir, 'evidence-score.json'), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`roles identifiable on screen: ${summary.roles.identifiable} of ${summary.roles.total}; causes named on screen: ${summary.causes.named} of ${summary.causes.total} (${summary.causes.persistent} still in the feed later)`);
    for (const r of results.filter((x) => !x.identifiable)) console.log(`  not identifiable: fight ${r.fight} ${r.prompt}: ${r.why}`);
    return summary.pass ? 0 : 1;
  }
  if (command === 'score') {
    const files = argv.flatMap((a, i) => (a === '--answers' && argv[i + 1] ? [argv[i + 1]!] : a.startsWith('--answers=') ? [a.slice('--answers='.length)] : []));
    if (files.length === 0) die('score needs at least one --answers <file>');
    const parts: ObserverAnswers[] = [];
    for (const f of files) {
      try {
        parts.push(parseAnswerFile(readFileSync(resolve(f), 'utf8'), basename(f).replace(/\.\w+$/, '')));
      } catch (e) {
        die(`${f}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const strict = args.has('strict-ability');
    const minPct = intArg(args, 'min', 90);
    const summaries: ScoreSummary[] = [];
    const byObserver = new Map<string, PromptResult[]>();
    for (const obs of mergeAnswers(parts)) {
      const { results, summary } = scoreObserver(keys, obs, { strictAbility: strict });
      summaries.push({ ...summary, pass: summary.total > 0 && summary.rate * 100 >= minPct });
      byObserver.set(obs.observer, results);
    }
    mkdirSync(visDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(visDir, `score-${stamp}.md`), scoreMarkdown(summaries, byObserver, strict));
    writeFileSync(join(visDir, `score-${stamp}.json`), `${JSON.stringify({ strictAbility: strict, minPct, summaries, results: Object.fromEntries(byObserver) }, null, 2)}\n`);
    for (const s of summaries) console.log(`${s.observer}: ${s.correct} of ${s.total} right (${pct(s.rate)}): ${s.pass ? 'PASS' : 'FAIL'}`);
    console.log(`score report: ${join(dirname(visDir), 'vis003', `score-${stamp}.md`)}`);
    return summaries.every((s) => s.pass) ? 0 : 1;
  }
  die(`unknown command "${command}" (score, precheck, sheet, template)`);
}

main().then(
  (c) => process.exit(c),
  (e: unknown) => {
    console.error(e);
    process.exit(2);
  },
);
