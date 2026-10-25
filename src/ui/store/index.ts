/**
 * ui/store — the UI's facade over core/game. Owner: WP6 (UI foundation).
 * CONTRACT: the GameStore interface, StoreContext and useStore() are fixed so
 * screens (WP6 and WP7) can be built in parallel; createGameStore() is a stub.
 *
 * Screens READ signals and call actions; they never mutate GameState or call
 * core transitions directly. All writes go through dispatch(command),
 * advance() and finishSeason(). The store keeps a busy flag (no double
 * advance), autosaves after every committed advance and season end
 * (open-016), deep-freezes committed states in dev builds, and records the
 * command log for state dumps.
 */
import { signal, type ReadonlySignal } from '@preact/signals';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { ContentDB, ContentIssue, RawContentFiles } from '../../core/content';
import type { CommandOutcome } from '../../core/game';
import type {
  Blocker,
  ClubId,
  Command,
  FixtureId,
  GameState,
  MatchReport,
  SaveError,
  SaveMeta,
  SeasonEndReport,
  WeekReport,
} from '../../core/model';
import { notImplemented, type EngineError, type Result } from '../../core/util';
import type { Clock, FileIO, SaveStore } from '../../platform/save-store';

export interface GameStore {
  // ---- state (read-only signals) ----------------------------------------------------------
  readonly content: ReadonlySignal<ContentDB | null>;
  /** Content problems found at startup (the app shows a blocking content-error screen). */
  readonly contentIssues: ReadonlySignal<readonly ContentIssue[]>;
  /** The committed career state, or null before a game is started or loaded. */
  readonly game: ReadonlySignal<GameState | null>;
  readonly playerClubId: ReadonlySignal<ClubId | null>;
  /** True while a transition, save or load runs. */
  readonly busy: ReadonlySignal<boolean>;
  /** Why Continue is disabled (empty when the player can advance). */
  readonly blockers: ReadonlySignal<readonly Blocker[]>;
  readonly lastWeekReport: ReadonlySignal<WeekReport | null>;
  readonly lastSeasonEndReport: ReadonlySignal<SeasonEndReport | null>;
  /** Last failed action (shown as a toast). */
  readonly lastError: ReadonlySignal<EngineError | SaveError | null>;

  // ---- lifecycle ------------------------------------------------------------------------------
  /** Load and validate a theme's content (startup). */
  initContent(themeId: string): Result<ContentDB, ContentIssue[]>;
  /** createWorld with a fresh seed (or a typed custom seed); the player then chooses a club. */
  newGame(params?: { seed?: string }): Promise<Result<void, EngineError>>;
  /** Apply one command for the player's club (or 'club.choose'). */
  dispatch(command: Command): Result<CommandOutcome, EngineError>;
  /** advanceWeek + autosave. */
  advance(): Promise<Result<WeekReport, EngineError>>;
  /** runSeasonEnd + autosave. */
  finishSeason(): Promise<Result<SeasonEndReport, EngineError>>;
  /** Read-only match report for a played fixture. */
  matchReport(fixtureId: FixtureId): Result<MatchReport, EngineError>;

  // ---- saves ------------------------------------------------------------------------------------------
  save(slotId: string, label?: string): Promise<Result<SaveMeta, SaveError>>;
  load(slotId: string): Promise<Result<void, SaveError>>;
  listSaves(): Promise<SaveMeta[]>;
  deleteSave(slotId: string): Promise<Result<void, SaveError>>;
  exportSave(slotId: string): Promise<Result<void, SaveError>>;
  importSave(file: Blob): Promise<Result<SaveMeta, SaveError>>;

  // ---- diagnostics --------------------------------------------------------------------------------------
  /** Download a state dump (save envelope + command log + build info). */
  dumpState(): void;
}

/** What the store needs from the environment (src/platform implementations). */
export interface StorePlatform {
  saves: SaveStore;
  clock: Clock;
  files: FileIO;
  /** Words of entropy for a new root seed (crypto.getRandomValues). */
  entropy(): number[];
  /** Raw content files of a theme (Vite glob in the browser). */
  loadTheme(themeId: string): RawContentFiles;
  /** package.json version. */
  gameVersion: string;
  /** Dev build: freeze committed states, expose window.__arena. */
  dev: boolean;
}

/** STUB (WP6 implements). Signals exist so screens can render against them. */
export function createGameStore(platform: StorePlatform): GameStore {
  const content = signal<ContentDB | null>(null);
  const game = signal<GameState | null>(null);
  const stub = (what: string): never => notImplemented(`ui.store.${what}`, platform);
  return {
    content,
    contentIssues: signal<readonly ContentIssue[]>([]),
    game,
    playerClubId: signal<ClubId | null>(null),
    busy: signal(false),
    blockers: signal<readonly Blocker[]>([]),
    lastWeekReport: signal<WeekReport | null>(null),
    lastSeasonEndReport: signal<SeasonEndReport | null>(null),
    lastError: signal<EngineError | SaveError | null>(null),
    initContent: () => stub('initContent'),
    newGame: () => stub('newGame'),
    dispatch: () => stub('dispatch'),
    advance: () => stub('advance'),
    finishSeason: () => stub('finishSeason'),
    matchReport: () => stub('matchReport'),
    save: () => stub('save'),
    load: () => stub('load'),
    listSaves: () => stub('listSaves'),
    deleteSave: () => stub('deleteSave'),
    exportSave: () => stub('exportSave'),
    importSave: () => stub('importSave'),
    dumpState: () => stub('dumpState'),
  };
}

export const StoreContext = createContext<GameStore | null>(null);

/** The store provided by the app root (tests provide their own via StoreContext). */
export function useStore(): GameStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore() needs <StoreContext.Provider value={store}>');
  return store;
}
