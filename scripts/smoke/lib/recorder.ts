/**
 * Collects what a run produces (steps, checks, screenshots, measurements, blocked pieces) and runs journeys so
 * that one broken or missing piece stops its own journey only.
 */
import type { ConsoleRecord } from './checks';
import { SmokeFailure } from './page';
import type { BlockedInfo, CheckResult, ScreenshotRecord, StepRecord } from './report';

/** Thrown to end a journey after its failure or block has been recorded. */
export class JourneyStop extends Error {
  constructor(readonly journey: string) {
    super(`journey ${journey} stopped`);
    this.name = 'JourneyStop';
  }
}

export class Recorder {
  readonly steps: StepRecord[] = [];
  readonly checks: CheckResult[] = [];
  readonly screenshots: ScreenshotRecord[] = [];
  readonly measurements: Record<string, unknown> = {};
  readonly blocked: BlockedInfo[] = [];
  readonly artifacts: string[] = [];
  /** Console messages of every page the run opened. */
  readonly console: ConsoleRecord[] = [];
  private currentJourney = '';

  constructor(private readonly log: (line: string) => void = () => {}) {}

  say(line: string): void {
    this.log(line);
  }

  check(c: CheckResult): void {
    this.checks.push(c);
    this.log(`  [${c.status.toUpperCase()}] ${c.title}${c.status === 'pass' ? '' : `: ${c.actual ?? ''}`}`);
  }

  /** Replace a check recorded earlier with the same id (a later, better measurement). */
  upsertCheck(c: CheckResult): void {
    const i = this.checks.findIndex((x) => x.id === c.id);
    if (i >= 0) this.checks[i] = c;
    else this.checks.push(c);
  }

  /** Note a missing piece without ending the journey (the check that needed it is skipped by the caller). */
  block(code: string, message: string, step: string): void {
    this.blocked.push({ code, message, step });
    this.log(`  BLOCKED (${code}): ${message.split('\n')[0]}`);
  }

  /** A check the run could not make because a piece is missing. */
  skipCheck(id: string, title: string, why: string, ref?: string, pending = false): void {
    this.checks.push({ id, title, status: 'skip', ...(ref ? { ref } : {}), detail: why, ...(pending ? { pending: true } : {}) });
  }

  /**
   * Run one step. A SmokeFailure marked `blocked` records the missing piece and ends the journey; any other failure is a
   * failed step, recorded as a failed check, and also ends the journey (the next steps depend on this one).
   */
  async step<T>(id: string, title: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    this.log(`- ${title}`);
    try {
      const out = await fn();
      this.steps.push({ id, title, status: 'pass', ms: Date.now() - t0 });
      return out;
    } catch (e) {
      const ms = Date.now() - t0;
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof SmokeFailure && e.blocked) {
        this.steps.push({ id, title, status: 'blocked', ms, detail: e.message.split('\n')[0] ?? e.message });
        this.blocked.push({ code: e.code, message: e.message, step: id });
        this.log(`  BLOCKED (${e.code}): ${e.message.split('\n')[0]}`);
      } else {
        this.steps.push({ id, title, status: 'fail', ms, detail: message.split('\n')[0] ?? message });
        this.checks.push({ id: `step.${id}`, title: `Step: ${title}`, status: 'fail', actual: message.slice(0, 600) });
        this.log(`  FAILED: ${message.split('\n')[0]}`);
      }
      throw new JourneyStop(this.currentJourney || id);
    }
  }

  /** Run a journey; a JourneyStop (already recorded) ends it quietly, anything unexpected becomes a failed check. */
  async journey(name: string, fn: () => Promise<void>): Promise<void> {
    this.currentJourney = name;
    this.log(`\n== ${name}`);
    try {
      await fn();
    } catch (e) {
      if (e instanceof JourneyStop) return;
      const message = e instanceof Error ? (e.stack ?? e.message) : String(e);
      this.checks.push({ id: `journey.${name}`, title: `Journey ${name} crashed`, status: 'fail', actual: message.slice(0, 600) });
      this.log(`  CRASHED: ${message.split('\n')[0]}`);
    } finally {
      this.currentJourney = '';
    }
  }
}
