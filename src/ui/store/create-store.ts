/**
 * createGameStore: the signals store behind the fixed GameStore contract.
 *
 * - One committed GameState in a signal; dev builds deep-freeze it (catches
 *   accidental mutation by a screen).
 * - dispatch(command) -> engine.applyCommand; on failure lastError (the app
 *   shows a toast with the mapped text).
 * - advance() / finishSeason() are busy-guarded (no double advance), yield
 *   one task so the "Simulating" state paints, commit atomically, then
 *   autosave into the rotating slots auto-1..3 (oldest overwritten).
 * - Every thrown error from core (a stub, a broken invariant) becomes an
 *   EngineError, never an uncaught exception in a screen.
 * - Command log since the last save, plus the last 20 for the debug overlay.
 */
import { batch, computed, signal, type ReadonlySignal } from '@preact/signals';
import { loadContent, type ContentDB, type ContentIssue } from '../../core/content';
import type { CommandOutcome } from '../../core/game';
import {
  SAVE_FORMAT,
  STATE_SCHEMA_VERSION,
  type Blocker,
  type ClubId,
  type Command,
  type CommandLogEntry,
  type FixtureId,
  type GameState,
  type MatchReport,
  type SaveEnvelope,
  type SaveError,
  type SaveErrorCode,
  type SaveMeta,
  type SeasonEndReport,
  type WeekReport,
} from '../../core/model';
import { isValidSeed, seedFromEntropy } from '../../core/rng';
import { ENGINE_VERSION } from '../../core/sim';
import { deepFreeze, engineError, err, NotImplementedError, ok, type EngineError, type Result } from '../../core/util';
import { AUTOSAVE_SLOTS, MANUAL_SLOT_COUNT } from '../../platform/save-store';
import { showToast } from '../components/Toast';
import { configureFormat } from '../format';
import { t } from '../text';
import type { GameStore, StorePlatform } from './contract';
import { coreEngine, type GameEngine } from './engine';

/** Manual slot ids "manual-1" .. "manual-10" (TUNABLE (tech): 10). */
export const MANUAL_SLOT_IDS: readonly string[] = Array.from({ length: MANUAL_SLOT_COUNT }, (_, i) => `manual-${i + 1}`);
export { AUTOSAVE_SLOTS };

/** Player-facing slot name: "slot 3", "autosave 2". */
export function slotName(slotId: string): string {
  const n = slotId.slice(slotId.lastIndexOf('-') + 1);
  if (slotId.startsWith('auto-')) return t('save.slotAuto', { n });
  if (slotId.startsWith('manual-')) return t('save.slotManual', { n });
  return slotId;
}

/** Slots written by `?ticket=<id>` reproductions ("ticket-<id>"): never autosaved over, listed apart. */
export function isTicketSlot(slotId: string | null | undefined): boolean {
  return typeof slotId === 'string' && slotId.startsWith('ticket-');
}

export function isAutosaveSlot(slotId: string): boolean {
  return (AUTOSAVE_SLOTS as readonly string[]).includes(slotId);
}

/** Map anything thrown by core into an EngineError (05 §2: no uncaught errors for expected gaps). */
export function engineErrorFrom(e: unknown): EngineError {
  if (e instanceof NotImplementedError) return engineError('engine.not-implemented', e.message, { what: e.message.replace(/^Not implemented yet: /, '') });
  const message = e instanceof Error ? e.message : String(e);
  return engineError('engine.crash', message);
}

function saveErrorFrom(e: unknown, code: SaveErrorCode = 'save.storage'): SaveError {
  if (e instanceof NotImplementedError) return { code, message: e.message, details: { notImplemented: true } };
  return { code, message: e instanceof Error ? e.message : String(e) };
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Store implementation: the contract plus a few additive members for the app frame and dev tools. */
export interface AppStore extends GameStore {
  readonly engine: GameEngine;
  /** Commands since the last save (state dumps). */
  readonly commandLog: ReadonlySignal<readonly CommandLogEntry[]>;
  /** The last 20 commands (debug overlay). */
  readonly recentCommands: ReadonlySignal<readonly CommandLogEntry[]>;
  /** Duration of the last advance in ms (debug overlay, 05 §8 week budget). */
  readonly lastAdvanceMs: ReadonlySignal<number | null>;
  /** Unsaved progress since the last save or load (Load asks once when true). */
  readonly dirty: ReadonlySignal<boolean>;
  /** Slot of the last manual save or load (Ctrl S saves there). */
  readonly currentSlot: ReadonlySignal<string | null>;
  /** Slot the running career was loaded from (null after a new career); a ticket-* slot means a reproduction. */
  readonly loadedSlot: ReadonlySignal<string | null>;
  /** This career's id (kept in its saves; legacy saves get one derived from seed and club). */
  readonly careerId: ReadonlySignal<string | null>;
  readonly platform: StorePlatform;
  /** Ctrl S: save to the current manual slot, or the first free one. */
  quickSave(): Promise<Result<SaveMeta, SaveError>>;
  /** Clear lastError after it was shown. */
  clearError(): void;
  /** Dev tooling only: replace the world and content (dev fixture world). */
  replaceWorld(state: GameState, content?: ContentDB, reports?: { seasonEnd?: SeasonEndReport | null }): void;
  /** Default save label for the current state. */
  defaultSaveLabel(): string;
}

export function createGameStore(platform: StorePlatform): AppStore {
  const engine = platform.engine ?? coreEngine;
  const content = signal<ContentDB | null>(null);
  const contentIssues = signal<readonly ContentIssue[]>([]);
  const game = signal<GameState | null>(null);
  const busy = signal(false);
  const lastWeekReport = signal<WeekReport | null>(null);
  const lastSeasonEndReport = signal<SeasonEndReport | null>(null);
  const lastError = signal<EngineError | SaveError | null>(null);
  const commandLog = signal<readonly CommandLogEntry[]>([]);
  const recentCommands = signal<readonly CommandLogEntry[]>([]);
  const lastAdvanceMs = signal<number | null>(null);
  const dirty = signal(false);
  const currentSlot = signal<string | null>(null);
  const loadedSlot = signal<string | null>(null);
  const ownCareerId = signal<string | null>(null);
  const careerId = computed(() => {
    const g = game.value;
    return g ? (ownCareerId.value ?? `seed-${g.rng.root}-${g.playerClubId ?? 'none'}`) : null;
  });
  let commandSeq = 1;
  let playtimeBase = 0;
  let sessionStartMs = platform.clock.nowMs();

  const playerClubId = computed<ClubId | null>(() => game.value?.playerClubId ?? null);
  const blockers = computed<readonly Blocker[]>(() => {
    const g = game.value;
    const c = content.value;
    if (!g || !c) return [];
    try {
      return engine.getBlockers(g, c);
    } catch {
      return [];
    }
  });

  const commit = (state: GameState): void => {
    game.value = platform.dev ? deepFreeze(state) : state;
  };

  const fail = <E extends EngineError | SaveError>(error: E): { readonly ok: false; readonly error: E } => {
    lastError.value = error;
    return err(error);
  };

  const playtimeSec = (): number => playtimeBase + Math.max(0, Math.floor((platform.clock.nowMs() - sessionStartMs) / 1000));

  const logCommand = (state: GameState, command: Command): void => {
    const entry: CommandLogEntry = { seq: commandSeq++, season: state.calendar.season, weekIndex: state.calendar.weekIndex, command };
    commandLog.value = [...commandLog.value, entry];
    recentCommands.value = [...recentCommands.value, entry].slice(-20);
  };

  const defaultSaveLabel = (): string => {
    const g = game.value;
    if (!g) return '';
    const club = g.playerClubId ? g.clubs[g.playerClubId] : undefined;
    const week = g.calendar.weekId ?? 'end';
    return `${club?.name ?? '—'} · S${g.calendar.season} ${week}`;
  };

  // ---- lifecycle ------------------------------------------------------------------------------------

  const initContent: GameStore['initContent'] = (themeId) => {
    let raw;
    try {
      raw = platform.loadTheme(themeId);
    } catch (e) {
      const issues: ContentIssue[] = [{ file: themeId, path: '', message: e instanceof Error ? e.message : String(e), severity: 'error' }];
      contentIssues.value = issues;
      return err(issues);
    }
    // The 'fixture' theme (tests, dev) is a deliberate subset: validate it with the fixture profile.
    const result = loadContent(themeId, raw, { profile: themeId === 'fixture' ? 'fixture' : 'theme' });
    if (!result.ok) {
      contentIssues.value = result.error;
      return result;
    }
    batch(() => {
      contentIssues.value = [];
      content.value = result.value;
    });
    configureFormat(result.value);
    return result;
  };

  const newGame: GameStore['newGame'] = async (params) => {
    const c = content.value;
    if (!c) return fail(engineError('engine.no-content', 'content not loaded'));
    if (busy.value) return fail(engineError('engine.busy', 'busy'));
    const seed = params?.seed?.trim();
    if (seed !== undefined && seed !== '' && !isValidSeed(seed)) return fail(engineError('seed.invalid', 'invalid seed'));
    busy.value = true;
    try {
      await yieldToUi();
      const rootSeed = seed ? seed : seedFromEntropy(platform.entropy());
      let result;
      try {
        result = engine.createWorld(c, { rootSeed });
      } catch (e) {
        return fail(engineErrorFrom(e));
      }
      if (!result.ok) return fail(result.error);
      batch(() => {
        commit(result.value);
        lastWeekReport.value = null;
        lastSeasonEndReport.value = null;
        commandLog.value = [];
        recentCommands.value = [];
        currentSlot.value = null;
        loadedSlot.value = null;
        ownCareerId.value = `c-${seedFromEntropy([...platform.entropy(), platform.clock.nowMs()])}`;
        dirty.value = true;
      });
      playtimeBase = 0;
      sessionStartMs = platform.clock.nowMs();
      return ok(undefined);
    } finally {
      busy.value = false;
    }
  };

  const dispatch: GameStore['dispatch'] = (command) => {
    const g = game.value;
    const c = content.value;
    if (!g || !c) return fail(engineError('engine.no-game', 'no game'));
    if (busy.value) return fail(engineError('engine.busy', 'busy'));
    let result: Result<CommandOutcome, EngineError>;
    try {
      result = engine.applyCommand(g, command, c);
    } catch (e) {
      return fail(engineErrorFrom(e));
    }
    if (!result.ok) return fail(result.error);
    batch(() => {
      commit(result.value.state);
      logCommand(g, command);
      dirty.value = true;
    });
    if (command.type === 'club.choose') void autosave();
    return result;
  };

  const advance: GameStore['advance'] = async () => {
    const g = game.value;
    const c = content.value;
    if (!g || !c) return fail(engineError('engine.no-game', 'no game'));
    if (busy.value) return fail(engineError('engine.busy', 'busy'));
    busy.value = true;
    try {
      await yieldToUi();
      const t0 = platform.clock.nowMs();
      let result;
      try {
        result = engine.advanceWeek(g, c);
      } catch (e) {
        return fail(engineErrorFrom(e));
      }
      if (!result.ok) return fail(result.error);
      const { state, report } = result.value;
      batch(() => {
        commit(state);
        lastWeekReport.value = report;
        lastAdvanceMs.value = platform.clock.nowMs() - t0;
        dirty.value = true;
      });
      await autosave();
      return ok(report);
    } finally {
      busy.value = false;
    }
  };

  const finishSeason: GameStore['finishSeason'] = async () => {
    const g = game.value;
    const c = content.value;
    if (!g || !c) return fail(engineError('engine.no-game', 'no game'));
    if (busy.value) return fail(engineError('engine.busy', 'busy'));
    busy.value = true;
    try {
      await yieldToUi();
      let result;
      try {
        result = engine.runSeasonEnd(g, c);
      } catch (e) {
        return fail(engineErrorFrom(e));
      }
      if (!result.ok) return fail(result.error);
      const { state, report } = result.value;
      batch(() => {
        commit(state);
        lastSeasonEndReport.value = report;
        lastWeekReport.value = null;
        dirty.value = true;
      });
      await autosave();
      return ok(report);
    } finally {
      busy.value = false;
    }
  };

  const matchReport: GameStore['matchReport'] = (fixtureId: FixtureId) => {
    const g = game.value;
    const c = content.value;
    if (!g || !c) return err(engineError('engine.no-game', 'no game'));
    try {
      return engine.buildMatchReport(g, fixtureId, c) as Result<MatchReport, EngineError>;
    } catch (e) {
      return err(engineErrorFrom(e));
    }
  };

  // ---- saves ---------------------------------------------------------------------------------------------

  const writeSlot = async (slotId: string, label: string | undefined, kind: 'manual' | 'auto'): Promise<Result<SaveMeta, SaveError>> => {
    const g = game.value;
    if (!g) return fail({ code: 'save.storage', message: 'no game' });
    let meta: SaveMeta;
    let json: string;
    try {
      meta = engine.saveMetaFor(g, {
        slotId,
        kind,
        label: label ?? defaultSaveLabel(),
        savedAt: platform.clock.nowIso(),
        playtimeSec: playtimeSec(),
        gameVersion: platform.gameVersion,
      });
      if (careerId.value) meta = { ...meta, careerId: careerId.value };
      const envelope = engine.createSave(g, meta, { engineVersion: ENGINE_VERSION }, commandLog.value);
      json = engine.serializeSave(envelope);
    } catch (e) {
      return fail(saveErrorFrom(e));
    }
    try {
      await platform.saves.write(slotId, json, meta);
    } catch (e) {
      return fail(saveErrorFrom(e));
    }
    batch(() => {
      commandLog.value = [];
      dirty.value = false;
      if (kind === 'manual') currentSlot.value = slotId;
    });
    return ok(meta);
  };

  const save: GameStore['save'] = async (slotId, label) => {
    if (busy.value) return fail({ code: 'save.storage', message: 'busy' });
    busy.value = true;
    try {
      return await writeSlot(slotId, label, isAutosaveSlot(slotId) ? 'auto' : 'manual');
    } finally {
      busy.value = false;
    }
  };

  const listSaves: GameStore['listSaves'] = async () => {
    try {
      const metas = await platform.saves.list();
      return [...metas].sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : a.slotId < b.slotId ? -1 : 1));
    } catch {
      return [];
    }
  };

  /** Rotate over auto-1..3: first empty slot, else the oldest. Never during a running write. */
  const autosave = async (): Promise<void> => {
    // A ticket reproduction never writes the shared autosave slots (they hold real careers).
    if (!game.value || isTicketSlot(loadedSlot.value)) return;
    let metas: SaveMeta[];
    try {
      metas = await platform.saves.list();
    } catch {
      metas = [];
    }
    const autos = metas.filter((m) => isAutosaveSlot(m.slotId));
    const free = AUTOSAVE_SLOTS.find((id) => !autos.some((m) => m.slotId === id));
    const oldest = [...autos].sort((a, b) => (a.savedAt < b.savedAt ? -1 : a.savedAt > b.savedAt ? 1 : a.slotId < b.slotId ? -1 : 1))[0];
    const slot = free ?? oldest?.slotId ?? AUTOSAVE_SLOTS[0];
    await writeSlot(slot, undefined, 'auto');
  };

  const load: GameStore['load'] = async (slotId) => {
    const c = content.value;
    if (!c) return fail({ code: 'save.content-missing', message: 'content not loaded' });
    if (busy.value) return fail({ code: 'save.storage', message: 'busy' });
    busy.value = true;
    try {
      let json: string | null;
      try {
        json = await platform.saves.read(slotId);
      } catch (e) {
        return fail(saveErrorFrom(e));
      }
      if (json === null) return fail({ code: 'save.storage', message: 'empty slot', details: { empty: true, slotId } });
      let parsed;
      try {
        parsed = engine.parseSave(json, c);
      } catch (e) {
        return fail(saveErrorFrom(e));
      }
      if (!parsed.ok) return fail(parsed.error);
      const envelope = parsed.value.envelope;
      batch(() => {
        commit(envelope.state);
        lastWeekReport.value = null;
        lastSeasonEndReport.value = null;
        commandLog.value = [];
        recentCommands.value = [];
        dirty.value = false;
        // Only a manual slot becomes the Ctrl S target. Loading an autosave (possibly another career)
        // clears it, so a quick save can never overwrite a different career's manual slot; a ticket
        // reproduction is not a target either (it stays as filed).
        currentSlot.value = envelope.meta.kind === 'manual' && !isTicketSlot(slotId) ? slotId : null;
        loadedSlot.value = slotId;
        ownCareerId.value = envelope.meta.careerId ?? null;
      });
      playtimeBase = envelope.meta.playtimeSec;
      sessionStartMs = platform.clock.nowMs();
      // Content changed since the save (core parseSave warnings): say so once, the save still loads.
      if (parsed.value.warnings.length > 0) showToast({ kind: 'info', title: t('save.contentChanged'), sub: t('save.contentChangedSub') });
      return ok(undefined);
    } finally {
      busy.value = false;
    }
  };

  const deleteSave: GameStore['deleteSave'] = async (slotId) => {
    try {
      await platform.saves.remove(slotId);
      if (currentSlot.value === slotId) currentSlot.value = null;
      return ok(undefined);
    } catch (e) {
      return fail(saveErrorFrom(e));
    }
  };

  const exportSave: GameStore['exportSave'] = async (slotId) => {
    try {
      const json = await platform.saves.read(slotId);
      if (json === null) return fail({ code: 'save.storage', message: 'empty slot', details: { empty: true, slotId } });
      const metas = await platform.saves.list();
      const label = metas.find((m) => m.slotId === slotId)?.label ?? slotId;
      platform.files.download(`${fileSafe(label)}.json`, json);
      return ok(undefined);
    } catch (e) {
      return fail(saveErrorFrom(e));
    }
  };

  const importSave: GameStore['importSave'] = async (file) => {
    const c = content.value;
    if (!c) return fail({ code: 'save.content-missing', message: 'content not loaded' });
    // Saves are a few MB (up to ~10 MB late in a long career); refuse anything far larger before reading it.
    if (file.size > MAX_IMPORT_BYTES) return fail({ code: 'save.storage', message: 'file too large', details: { tooLarge: true, sizeMb: Math.round(file.size / 1e6) } });
    let text: string;
    try {
      text = await platform.files.readText(file);
    } catch (e) {
      return fail(saveErrorFrom(e));
    }
    let parsed;
    try {
      parsed = engine.parseSave(text, c);
    } catch (e) {
      return fail(saveErrorFrom(e));
    }
    if (!parsed.ok) return fail(parsed.error);
    let metas: SaveMeta[];
    try {
      metas = await platform.saves.list();
    } catch (e) {
      return fail(saveErrorFrom(e));
    }
    const slotId = MANUAL_SLOT_IDS.find((id) => !metas.some((m) => m.slotId === id));
    if (!slotId) return fail({ code: 'save.storage', message: 'no free slot', details: { full: true } });
    const envelope: SaveEnvelope = { ...parsed.value.envelope, meta: { ...parsed.value.envelope.meta, slotId, kind: 'manual' } };
    try {
      await platform.saves.write(slotId, engine.serializeSave(envelope), envelope.meta);
    } catch (e) {
      return fail(saveErrorFrom(e));
    }
    return ok(envelope.meta);
  };

  /** Save to the current manual slot. Without one (new career, an autosave loaded) the caller asks for a slot. */
  const quickSave = async (): Promise<Result<SaveMeta, SaveError>> => {
    const slot = currentSlot.value;
    if (!slot) return fail({ code: 'save.storage', message: 'no current slot', details: { noSlot: true } });
    return save(slot);
  };

  // ---- diagnostics -----------------------------------------------------------------------------------------

  const dumpState: GameStore['dumpState'] = () => {
    const g = game.value;
    if (!g) return;
    let envelope: unknown;
    try {
      const meta = engine.saveMetaFor(g, {
        slotId: 'dump',
        kind: 'manual',
        label: defaultSaveLabel(),
        savedAt: platform.clock.nowIso(),
        playtimeSec: playtimeSec(),
        gameVersion: platform.gameVersion,
      });
      envelope = engine.createSave(g, meta, { engineVersion: ENGINE_VERSION }, commandLog.value);
    } catch {
      // core/save not available: dump the raw state in an envelope-like shape.
      envelope = { format: SAVE_FORMAT, schemaVersion: STATE_SCHEMA_VERSION, engineVersion: ENGINE_VERSION, content: g.content, state: g };
    }
    const payload = {
      format: 'arena-league-state-dump',
      envelope,
      commandLog: commandLog.value,
      build: { gameVersion: platform.gameVersion, engineVersion: ENGINE_VERSION, schemaVersion: STATE_SCHEMA_VERSION, content: g.content },
      userAgent: platform.userAgent ?? '',
      dumpedAt: platform.clock.nowIso(),
    };
    const club = g.playerClubId ?? 'no-club';
    platform.files.download(`${club}-s${g.calendar.season}w${g.calendar.weekIndex}.state-dump.json`, JSON.stringify(payload, null, 1));
  };

  const replaceWorld = (state: GameState, newContent?: ContentDB, reports?: { seasonEnd?: SeasonEndReport | null }): void => {
    batch(() => {
      if (newContent) {
        content.value = newContent;
        configureFormat(newContent);
      }
      commit(state);
      lastWeekReport.value = null;
      lastSeasonEndReport.value = reports?.seasonEnd ?? null;
      commandLog.value = [];
      recentCommands.value = [];
      dirty.value = false;
      currentSlot.value = null;
      loadedSlot.value = null;
      ownCareerId.value = null;
    });
  };

  const store: AppStore = {
    content,
    contentIssues,
    game,
    playerClubId,
    busy,
    blockers,
    lastWeekReport,
    lastSeasonEndReport,
    lastError,
    initContent,
    newGame,
    dispatch,
    advance,
    finishSeason,
    matchReport,
    save,
    load,
    listSaves,
    deleteSave,
    exportSave,
    importSave,
    dumpState,
    engine,
    commandLog,
    recentCommands,
    lastAdvanceMs,
    dirty,
    currentSlot,
    loadedSlot,
    careerId,
    platform,
    quickSave,
    clearError: () => {
      lastError.value = null;
    },
    replaceWorld,
    defaultSaveLabel,
  };

  if (platform.dev && typeof window !== 'undefined') {
    (window as unknown as { __arena?: unknown }).__arena = {
      store,
      state: () => game.value,
      dispatch,
      advance: async (n = 1) => {
        let last: Result<WeekReport, EngineError> | null = null;
        for (let i = 0; i < n; i++) {
          last = await advance();
          if (!last.ok) break;
        }
        return last;
      },
      finishSeason,
      dump: dumpState,
    };
  }

  return store;
}

/** Largest save file Import reads (saves are up to ~10 MB). */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

function fileSafe(label: string): string {
  return label.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'save';
}
