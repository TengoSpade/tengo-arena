import type { ContentDB } from '../../../src/core/content';
import type { CdpClient } from '../lib/cdp';
import type { PerfContext } from '../lib/checks';
import type { HeadlessRound } from '../lib/headless';
import type { PageDriver } from '../lib/page';
import type { GameState } from '../../../src/core/model';
import type { Recorder } from '../lib/recorder';
import type { RunOptions } from '../lib/options';

/** What every journey is given. */
export interface JourneyEnv {
  rec: Recorder;
  client: CdpClient;
  /** Where the build is served, no trailing slash. */
  baseUrl: string;
  /** The run folder (reports/smoke/<run id>). */
  outDir: string;
  opts: RunOptions;
  perf: PerfContext;
  content: ContentDB;
  /** Short git commit of the working tree under test (recorded in the vis-003 manifest). */
  commit: string;
  /** The headless reference for the viewed round; default core/game's playback (the self-test substitutes its own). */
  headless?: (state: GameState) => HeadlessRound;
  /** Collect a page's console records (call before closing it). */
  collectConsole(page: PageDriver): void;
}
