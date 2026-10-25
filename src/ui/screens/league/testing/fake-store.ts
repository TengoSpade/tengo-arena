/**
 * A fake GameStore (the fixed src/ui/store contract) for WP7 tests and the
 * local visual preview. Records dispatched commands and save calls; the
 * transitions are canned. Never import from production code.
 */
import { signal } from '@preact/signals';
import type { ContentDB, ContentIssue } from '../../../../core/content';
import type { CommandOutcome } from '../../../../core/game';
import type {
  Blocker,
  ClubId,
  Command,
  FixtureId,
  GameState,
  MatchReport,
  OfferResponse,
  SaveError,
  SaveMeta,
  SeasonEndReport,
  WeekReport,
} from '../../../../core/model';
import { engineError, err, ok, type EngineError, type Result } from '../../../../core/util';
import type { GameStore } from '../../../store';

export interface FakeStoreOptions {
  game: GameState | null;
  content: ContentDB | null;
  matchReport?: (fixtureId: FixtureId) => Result<MatchReport, EngineError>;
  /** Apply a command to the state (default: record it and keep the state). */
  reduce?: (state: GameState, command: Command) => Result<{ state: GameState; response: OfferResponse | null }, EngineError>;
  saves?: SaveMeta[];
  saveError?: SaveError | null;
  loadError?: SaveError | null;
  seasonEndReport?: SeasonEndReport | null;
}

export interface FakeStore extends GameStore {
  readonly commands: Command[];
  readonly calls: { method: string; args: unknown[] }[];
  setGame(state: GameState | null): void;
}

export function createFakeStore(opts: FakeStoreOptions): FakeStore {
  const game = signal<GameState | null>(opts.game);
  const content = signal<ContentDB | null>(opts.content);
  const playerClubId = signal<ClubId | null>(opts.game?.playerClubId ?? null);
  const busy = signal(false);
  const lastError = signal<EngineError | SaveError | null>(null);
  const lastSeasonEndReport = signal<SeasonEndReport | null>(opts.seasonEndReport ?? null);
  const commands: Command[] = [];
  const calls: { method: string; args: unknown[] }[] = [];
  let saves = [...(opts.saves ?? [])];
  const record = (method: string, ...args: unknown[]) => calls.push({ method, args });

  const store: FakeStore = {
    commands,
    calls,
    setGame(state) {
      game.value = state;
      playerClubId.value = state?.playerClubId ?? null;
    },
    content,
    contentIssues: signal<readonly ContentIssue[]>([]),
    game,
    playerClubId,
    busy,
    blockers: signal<readonly Blocker[]>([]),
    lastWeekReport: signal<WeekReport | null>(null),
    lastSeasonEndReport,
    lastError,
    initContent: () => (content.value ? ok(content.value) : err([])),
    newGame: async () => ok(undefined),
    dispatch(command) {
      commands.push(command);
      const state = game.value;
      if (!state) return err(engineError('game.none', 'No game'));
      if (opts.reduce) {
        const r = opts.reduce(state, command);
        if (!r.ok) {
          lastError.value = r.error;
          return r;
        }
        game.value = r.value.state;
        const outcome: CommandOutcome = { state: r.value.state, newsIds: [], response: r.value.response };
        return ok(outcome);
      }
      return ok({ state, newsIds: [], response: command.type === 'offer.make' ? { kind: 'pending' } : null });
    },
    advance: async () => err(engineError('fake', 'advance is not faked')),
    async finishSeason() {
      record('finishSeason');
      if (opts.seasonEndReport) {
        lastSeasonEndReport.value = opts.seasonEndReport;
        return ok(opts.seasonEndReport);
      }
      return err(engineError('fake', 'no season end report'));
    },
    matchReport(fixtureId) {
      return opts.matchReport ? opts.matchReport(fixtureId) : err(engineError('report.none', 'No report'));
    },
    async save(slotId, label) {
      record('save', slotId, label);
      if (opts.saveError) return err(opts.saveError);
      const g = game.value;
      const meta: SaveMeta = {
        slotId,
        kind: slotId.startsWith('auto') ? 'auto' : 'manual',
        label: label ?? slotId,
        savedAt: '2026-10-25T12:00:00.000Z',
        gameVersion: '0.1.0',
        season: g?.calendar.season ?? 1,
        weekIndex: g?.calendar.weekIndex ?? 1,
        weekId: g?.calendar.weekId ?? null,
        phase: g?.calendar.phase ?? 'preseason',
        playerClubId: g?.playerClubId ?? null,
        playerClubName: g?.playerClubId ? (g.clubs[g.playerClubId]?.name ?? null) : null,
        playtimeSec: 3600,
      };
      saves = [...saves.filter((s) => s.slotId !== slotId), meta];
      return ok(meta);
    },
    async load(slotId) {
      record('load', slotId);
      return opts.loadError ? err(opts.loadError) : ok(undefined);
    },
    async listSaves() {
      record('listSaves');
      return [...saves];
    },
    async deleteSave(slotId) {
      record('deleteSave', slotId);
      saves = saves.filter((s) => s.slotId !== slotId);
      return ok(undefined);
    },
    async exportSave(slotId) {
      record('exportSave', slotId);
      return ok(undefined);
    },
    async importSave(file) {
      record('importSave', file);
      if (opts.loadError) return err(opts.loadError);
      const meta = { ...(saves[0] ?? ({} as SaveMeta)), slotId: 'manual-9', label: 'Imported save' };
      saves = [...saves, meta];
      return ok(meta);
    },
    dumpState() {
      record('dumpState');
    },
  };
  return store;
}
