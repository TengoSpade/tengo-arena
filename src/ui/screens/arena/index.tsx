/**
 * #/arena: the player's match being watched (05-technical-m2 §A3, §A7; WP-M2E). Opened only after the lock's
 * auto-round write succeeded (the store enforces it), so the round's lineups, presets and seed are saved and its
 * outcome is fixed. The screen loads the round once (core/game liveRoundPlayback), hands the log to the viewer and
 * reads everything else through it (review B1). Playback stops persist the cursor (tech-019); the round's end, or
 * "Skip to end of round", commits it with the hash of the log the viewer loaded; "Simulate the rest" changes the
 * mode first.
 */
import { signal } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import type { MatchPlayback, RoundPlayback } from '../../../core/game';
import type { FixtureId, GameState, WeekReport } from '../../../core/model';
import type { EngineError, Result } from '../../../core/util';
import type { ArenaViewer } from '../../../render/viewer';
import { afterMatch, opensReport } from '../../app/after-match';
import { useMounted } from '../../app/mounted';
import { navigate } from '../../app/router';
import type { ScreenProps } from '../../app/routes';
import { Empty, Modal, PageHeader, showToast } from '../../components';
import { MANUAL_SLOT_IDS, MATCH_PAUSED, MATCH_WATCHING, SAVE_ROUND_FAILED, WATCH_MISMATCH, WATCH_NOT_SHOWN, slotName, useStore, type AppStore } from '../../store';
import { errorText } from '../../store/messages';
import { effectiveTheme, settings } from '../../store/settings';
import { arenaEpoch, savedWatch, useArena, watchKey, watchingMatch } from '../../store/arena';
import { hashString, stableStringify } from '../../../core/util';
import { t as uiT } from '../../text';
import { registerArenaTicketInfo } from '../../tickets/arena-info';
import { ArenaLayout } from './Arena';
import { buildHud, buildRoundContext, fightInputOf } from './context';
import { readArenaPalette } from './palette';
import { ROUND_END_MS, RoundEndOverlay, resetRoundEnd, roundEnd, type RoundEndResult } from './RoundEnd';
import { recallStop, rememberStop, type StopAt } from './resume-cause';
import { useViewerSession, type StopKind } from './session';
import { clock, t, t as uiText } from './text';

const TICK_S = 0.05;

/** The round waiting to be watched, from the committed state. */
export const watchingOf = watchingMatch;

/** The finished round for the card: winner, match score (the player's side first), time and what opens next, from committed state only. */
function roundOutcome(state: GameState, content: ContentDB, fixtureId: FixtureId, round: number, report: WeekReport | null): RoundEndResult | null {
  const ms = state.liveMatch && state.liveMatch.fixtureId === fixtureId ? state.liveMatch : null;
  const result = state.results[fixtureId];
  const rounds = ms ? ms.rounds : (result?.rounds ?? []);
  const score = ms ? ms.score : (result?.score ?? { home: 0, away: 0 });
  const r = rounds[round - 1];
  if (!r) return null;
  const homeId = ms ? ms.home.clubId : result?.homeClubId;
  const awayId = ms ? ms.away.clubId : result?.awayClubId;
  const winnerId = r.winner === 'home' ? homeId : awayId;
  const playerHome = state.playerClubId !== null && state.playerClubId === homeId;
  const playerAway = state.playerClubId !== null && state.playerClubId === awayId;
  const involved = playerHome || playerAway;
  const ours = involved ? (r.winner === 'home') === playerHome : null;
  const [a, b] = playerAway ? [score.away, score.home] : [score.home, score.away];
  const matchOver = ms === null;
  const winnerName = (winnerId ? state.clubs[winnerId]?.name : undefined) ?? winnerId ?? '';
  const seconds = r.durationTicks * TICK_S;
  return {
    winner: winnerName,
    ours,
    score: [a, b],
    winnerFirst: involved ? ours === true : r.winner === 'home',
    time: clock(seconds),
    overtime: seconds >= content.combat.overtime.startS,
    reason: r.endReason,
    standing: r.survivors[r.winner],
    who: involved ? (ours ? uiText('whoOurs') : uiText('whoTheirs')) : ((winnerId ? state.clubs[winnerId]?.shortName : undefined) ?? winnerName),
    matchOver,
    next: matchOver ? (report && opensReport(state, report) ? 'report' : 'home') : ms.watch?.round != null ? 'kickoff' : 'between',
    nextRound: round + 1,
  };
}

/**
 * A live round's playback is a full sim (WP-M2B: cache it per round): coming back to the arena (a click on Home, the
 * resume after the between-round screen's Replay) must not simulate it again. One entry, keyed by what fixes the round:
 * a hash of the LOCKED INPUTS (both sides' squads and rows, every fighter's lock-time input, the rounds played with their
 * lineups, the calls) plus the match seed, the round and the world epoch (bumped by a load, a new game and a rollback).
 * The match seed alone does not depend on the lineup, so after a load and a re-lock with another lineup it would hit.
 * Only the resume point is taken fresh from the state.
 */
let liveCache: { key: string; playback: RoundPlayback } | null = null;
function lockKey(state: GameState): string | null {
  const ms = state.liveMatch;
  const round = ms?.watch?.round;
  if (!ms || !round) return null;
  const locked = hashString(stableStringify({ home: ms.home, away: ms.away, inputsById: ms.inputsById, roundLineups: ms.roundLineups, calls: ms.watch!.calls }));
  return `${arenaEpoch.peek()}|${state.rng.root}|${ms.fixtureId}|${ms.seed}|${round}|${ms.rounds.length}|${locked}`;
}
function cachedLiveRound(state: GameState, load: () => Result<RoundPlayback, EngineError> | null): Result<RoundPlayback, EngineError> | null {
  const key = lockKey(state);
  if (key === null) return load();
  if (liveCache?.key === key) return { ok: true, value: { ...liveCache.playback, startTick: state.liveMatch!.watch!.cursorTick } };
  const r = load();
  if (r?.ok) liveCache = { key, playback: r.value };
  return r;
}

/** Forget the cached round (tests; a changed lock such as a call, later). */
export function resetLiveRoundCache(): void {
  liveCache = null;
}

export default function ArenaScreen(_props: ScreenProps) {
  const store = useStore() as AppStore;
  const state = store.game.value;
  const content = store.content.value;
  // A card left in the module signal by an earlier screen (a commit that finished after its screen was gone) must neither show
  // nor run its next step here: reset at MOUNT, before the first read below (the unmount reset alone left that window open).
  const fresh = useRef(true);
  if (fresh.current) {
    fresh.current = false;
    resetRoundEnd();
  }
  const over = roundEnd.value;
  // While the round is being committed and its result shows, the round stays mounted (the state under it moves on at
  // the commit, before the card is up, and the card lives inside the round's screen).
  const frozen = useRef<{ fixtureId: FixtureId; round: number } | null>(null);
  const w = watchingOf(state);
  // The arena opens only for a round whose lock is SAVED (the store sets the gate after the required write): the lock is
  // in memory before then, and showing the round meanwhile would be a peek that a failed write rerolls (A3).
  const saved = w !== null && savedWatch.value === watchKey(w);
  if ((over?.phase === 'result' || over?.phase === 'saving') && frozen.current) {
    // keep the frozen round
  } else frozen.current = w && saved ? { fixtureId: w.fixtureId, round: w.round } : null;
  useEffect(() => () => resetRoundEnd(), []);

  const shown = frozen.current;
  if (w && !saved && !shown) return <SavingLock />;
  return state && content && shown ? <LiveArena key={`${shown.fixtureId}:${shown.round}`} store={store} content={content} fixtureId={shown.fixtureId} round={shown.round} /> : <NoRound state={state} />;
}

/** The lock is being saved: nothing of the round is shown until the write has succeeded. */
function SavingLock() {
  return (
    <section class="page" data-testid="screen-arena-saving" aria-busy="true">
      <PageHeader eyebrow={t('eyebrowLive')} title={t('title')} />
      <p class="u-muted" role="status">
        {t('savingLock')}
      </p>
    </section>
  );
}

function NoRound({ state }: { state: GameState | null }) {
  const between = state?.liveMatch && state.liveMatch.phase === 'between_rounds';
  return (
    <section class="page" data-testid="screen-arena">
      <PageHeader eyebrow={t('eyebrowLive')} title={t('title')} />
      <Empty
        icon="swords"
        title={t('noMatch')}
        text={t('noMatchText')}
        actions={
          between ? (
            <a class="btn btn--primary" href="#/between-rounds">
              {uiT('continue.toMatch')}
            </a>
          ) : (
            <a class="btn" href="#/home">
              {t('home')}
            </a>
          )
        }
      />
    </section>
  );
}

type Loaded = { kind: 'ok'; playback: RoundPlayback; ctx: ReturnType<typeof buildRoundContext>; match: MatchPlayback | null } | { kind: 'stub' } | { kind: 'error'; message: string };

function LiveArena({ store, content, fixtureId, round }: { store: AppStore; content: ContentDB; fixtureId: FixtureId; round: number }) {
  const arena = useArena(store);
  const hostRef = useRef<HTMLElement | null>(null);

  // The round is loaded ONCE per mount: a re-render (the cursor save changes the state) must not simulate it again.
  const loaded = useMemo<Loaded>(() => {
    const state = store.game.value!;
    const r = cachedLiveRound(state, () => arena.liveRound(state));
    if (r === null) return { kind: 'stub' };
    if (!r.ok) return { kind: 'error', message: errorText(r.error) };
    const mp = arena.matchPlayback(state, fixtureId);
    const match = mp && mp.ok ? mp.value : null;
    const palette = readArenaPalette(effectiveTheme(settings.value));
    const ctx = buildRoundContext({ state, content, playback: r.value, match, palette, startTick: r.value.startTick });
    return { kind: 'ok', playback: r.value, ctx, match };
  }, []);

  if (loaded.kind === 'stub') {
    return (
      <section class="page" data-testid="screen-arena">
        <PageHeader eyebrow={t('eyebrowLive')} title={t('title')} />
        <Empty icon="swords" title={t('stubTitle')} text={t('stubText')} actions={<a class="btn" href="#/home">{t('home')}</a>} />
      </section>
    );
  }
  if (loaded.kind === 'error') {
    return (
      <section class="page" data-testid="screen-arena">
        <PageHeader eyebrow={t('eyebrowLive')} title={t('title')} />
        <Empty icon="warning" title={t('roundError')} text={loaded.message} actions={<a class="btn" href="#/home">{t('home')}</a>} />
      </section>
    );
  }
  return <LiveRound store={store} content={content} fixtureId={fixtureId} round={round} loaded={loaded} hostRef={hostRef} />;
}

/** Ctrl S in the arena (while paused; the pause has saved the cursor): the current manual slot, else the first free one, else say so. */
async function saveFromArena(store: AppStore): Promise<void> {
  if (store.currentSlot.value) {
    const r = await store.quickSave();
    if (r.ok) showToast({ kind: 'good', title: uiT('save.saved', { slot: slotName(r.value.slotId) }), sub: r.value.label });
    return;
  }
  const metas = await store.listSaves();
  const slot = MANUAL_SLOT_IDS.find((id) => !metas.some((m) => m.slotId === id));
  if (!slot) {
    showToast({ kind: 'bad', title: t('saveNoSlot') });
    return;
  }
  const r = await store.save(slot);
  if (r.ok) showToast({ kind: 'good', title: uiT('save.saved', { slot: slotName(slot) }), sub: r.value.label });
  else showToast({ kind: 'bad', title: uiT('error.title'), sub: errorText(r.error) });
}

function LiveRound({ store, content, fixtureId, round, loaded, hostRef }: { store: AppStore; content: ContentDB; fixtureId: FixtureId; round: number; loaded: Extract<Loaded, { kind: 'ok' }>; hostRef: { current: HTMLElement | null } }) {
  const arena = useArena(store);
  const { playback, ctx, match } = loaded;
  const startTick = playback.startTick;
  const state = store.game.value!;
  const [confirm, setConfirm] = useState<'skip' | 'simulate' | 'leave' | null>(null);
  const [busy, setBusy] = useState(false);
  const resumePlaying = useRef(false);
  const committing = useRef(false);
  // Back, Leave or another screen while a commit or the simulated rest runs: the step must not open a card, route or toast after.
  const mounted = useMounted();

  // The cursor persisted so far (the resume point at mount). The inspector's probe waits for it: core refuses a tick past it.
  const cursorSaved = useMemo(() => signal(startTick), []);
  const lastSaved = useRef(startTick);

  const stopAt = (cursor: number): StopAt => ({ career: String(state.rng.root), fixtureId, round, cursor });
  const resumedStop = useMemo(() => (startTick > 0 ? recallStop(stopAt(startTick)) : null), []);

  const persistCursor = (viewer: ArenaViewer, stop: StopKind): void => {
    // The reveal frontier: an integer tick at or beyond everything shown (tech-019); a rewind never lowers it.
    const head = Math.ceil(viewer.headTick);
    if (head <= lastSaved.current) return;
    const before = lastSaved.current;
    lastSaved.current = head;
    void arena.saveCursor(store.game.value ?? state, head).then((r) => {
      if (r.ok) {
        cursorSaved.value = Math.max(cursorSaved.value, head);
        // The cause travels with the cursor it belongs to: an automatic pause is recalled on resume, any other stop clears it.
        rememberStop(stopAt(head), stop.kind === 'auto' ? stop.stop : null);
      } else lastSaved.current = before;
    });
  };

  /** Show the committed round for 1.5 s, then open what comes next. */
  const showResult = (after: GameState, next: () => void, report: WeekReport | null = null): void => {
    const result = roundOutcome(after, content, fixtureId, round, report);
    roundEnd.value = { phase: 'result', round, bestOf: ctx.bestOf, result, next, retry: null };
  };

  const finish = async (): Promise<void> => {
    if (committing.current) return;
    committing.current = true;
    setBusy(true);
    roundEnd.value = { phase: 'saving', round, bestOf: ctx.bestOf, result: null, next: null, retry: null };
    // The hash of the log the viewer loaded (never a hash of anything else): the commit compares it in every build.
    const res = await arena.finishRound({ round, logHash: playback.log.hash });
    committing.current = false;
    if (!mounted.current) return; // the commit stands in the state; no card, no route from a screen that is gone
    setBusy(false);
    const after = store.game.value ?? state;
    if (res.ok) return showResult(after, () => afterMatch(after, res.value), res.value);
    switch (res.error.code) {
      case MATCH_PAUSED:
        return showResult(after, () => navigate('#/between-rounds'));
      case MATCH_WATCHING:
        return showResult(after, () => navigate('#/arena'));
      case WATCH_MISMATCH: {
        // reason 'round': the round is already committed (a stale tab, a second press). Not a defect and never retried:
        // go where the committed state says.
        if ((res.error.details as { reason?: string } | undefined)?.reason === 'round') {
          roundEnd.value = null;
          const w = watchingOf(after);
          navigate(w ? '#/arena' : after.liveMatch?.phase === 'between_rounds' ? '#/between-rounds' : '#/home');
          return;
        }
        roundEnd.value = { phase: 'mismatch', round, bestOf: ctx.bestOf, result: null, next: null, retry: null, message: res.error.message };
        return;
      }
      case WATCH_NOT_SHOWN:
      case SAVE_ROUND_FAILED:
      default:
        roundEnd.value = { phase: 'failed', round, bestOf: ctx.bestOf, result: null, next: null, retry: () => void finish(), message: res.error.message };
    }
  };

  const onStopped = (stop: StopKind, viewer: ArenaViewer): void => {
    if (stop.kind === 'end') {
      void finish();
      return;
    }
    persistCursor(viewer, stop);
  };

  const session = useViewerSession(hostRef, {
    playback,
    ctx,
    content,
    autoplay: startTick === 0,
    pauseWhenHidden: settings.value.arena.pauseWhenHidden,
    onStopped,
    resumedStop,
    onLoaded: () => {
      if (startTick > 0) showToast({ kind: 'info', title: t('resumed'), sub: t('resumedSub', { time: clock(startTick * TICK_S) }) });
    },
  });

  useEffect(
    () =>
      registerArenaTicketInfo(() => {
        const s = session.snap.peek();
        return { kind: 'live', fixtureId, round, tick: s.tick, headTick: s.head, speed: s.speed, playing: s.playing };
      }),
    [],
  );

  const hud = useMemo(() => buildHud({ state, ctx, playback, kind: 'live' }), []);
  void match;
  const roleName = (r: string) => content.combat.archetypes.find((a) => a.id === r)?.name ?? r;

  const askSkip = () => {
    if (session.status.value !== 'ready' || committing.current) return;
    resumePlaying.current = session.snap.peek().playing;
    session.pause();
    setConfirm('skip');
  };
  const askSimulate = () => {
    if (session.status.value !== 'ready' || committing.current) return;
    resumePlaying.current = session.snap.peek().playing;
    session.pause();
    setConfirm('simulate');
  };
  const askLeave = () => {
    if (committing.current) return;
    resumePlaying.current = session.snap.peek().playing;
    session.pause(); // a stop: the cursor is saved
    setConfirm('leave');
  };
  const doLeave = () => {
    setConfirm(null);
    navigate('#/home'); // the match stays live: Continue reads Resume watching
  };
  const cancel = () => {
    setConfirm(null);
    if (resumePlaying.current) session.play();
  };
  const doSkip = () => {
    setConfirm(null);
    // The viewer stops without a cursor save: the commit replaces the cursor.
    session.viewer()?.pause();
    void finish();
  };
  const doSimulate = async () => {
    setConfirm(null);
    setBusy(true);
    // A card keeps this round on screen while the mode switches and the rest is played (the state moves on under it).
    roundEnd.value = { phase: 'saving', round, bestOf: ctx.bestOf, result: null, next: null, retry: null, message: 'simulating' };
    const head = Math.ceil(session.snap.peek().head);
    const res = await arena.simulateRest(store.game.value ?? state, head);
    if (!mounted.current) return;
    setBusy(false);
    roundEnd.value = null;
    if (res.ok) afterMatch(store.game.value, res.value);
    else if (res.error.code === MATCH_PAUSED) navigate('#/between-rounds');
    else showToast({ kind: 'bad', title: uiT('error.title'), sub: errorText(res.error) });
  };

  return (
    <ArenaLayout
      session={session}
      hostRef={hostRef}
      ctx={ctx}
      hud={hud}
      kind="live"
      content={content}
      roleName={roleName}
      inputOf={(id) => fightInputOf(store.game.value ?? state, fixtureId, id)}
      probe={(tick) => arena.inspect(store.game.value ?? state, fixtureId, round, tick)}
      cursorSaved={cursorSaved}
      busy={busy}
      onSkip={askSkip}
      onSimulateRest={askSimulate}
      onEscape={askLeave}
      onSave={() => void saveFromArena(store)}
      roundOver={roundEnd.value?.phase === 'result'}
      overlay={
        <>
          <RoundEndOverlay />
          <Modal
            open={confirm === 'leave'}
            onClose={cancel}
            title={t('leaveTitle')}
            icon="info"
            onEnter={doLeave}
            footer={
              <>
                <button class="btn" type="button" onClick={cancel} data-testid="leave-stay">
                  {t('leaveStay')} <kbd>Esc</kbd>
                </button>
                <button class="btn btn--primary" type="button" onClick={doLeave} data-autofocus data-testid="confirm-leave">
                  {t('leaveConfirm')} <kbd>Enter</kbd>
                </button>
              </>
            }
            testId="dialog-leave"
          >
            <p>{t('leaveText')}</p>
          </Modal>
          <Modal
            open={confirm === 'skip'}
            onClose={cancel}
            title={t('skipTitle')}
            icon="warning"
            onEnter={doSkip}
            footer={
              <>
                <button class="btn" type="button" onClick={cancel}>
                  {uiT('common.cancel')} <kbd>Esc</kbd>
                </button>
                <button class="btn btn--primary" type="button" onClick={doSkip} data-autofocus data-testid="confirm-skip">
                  {t('skipConfirm')} <kbd>Enter</kbd>
                </button>
              </>
            }
            testId="dialog-skip"
          >
            <p>{t('skipText')}</p>
          </Modal>
          <Modal
            open={confirm === 'simulate'}
            onClose={cancel}
            title={t('simTitle')}
            icon="warning"
            onEnter={() => void doSimulate()}
            footer={
              <>
                <button class="btn" type="button" onClick={cancel}>
                  {uiT('common.cancel')} <kbd>Esc</kbd>
                </button>
                <button class="btn btn--primary" type="button" onClick={() => void doSimulate()} data-autofocus data-testid="confirm-simulate">
                  {t('simConfirm')} <kbd>Enter</kbd>
                </button>
              </>
            }
            testId="dialog-simulate"
          >
            <p>{t('simText')}</p>
          </Modal>
        </>
      }
    />
  );
}

export { ROUND_END_MS };
