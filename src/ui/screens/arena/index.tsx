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
import type { FixtureId, GameState } from '../../../core/model';
import type { ArenaViewer } from '../../../render/viewer';
import { afterMatch } from '../../app/after-match';
import { navigate } from '../../app/router';
import type { ScreenProps } from '../../app/routes';
import { Empty, Modal, PageHeader, showToast } from '../../components';
import { MATCH_PAUSED, MATCH_WATCHING, SAVE_ROUND_FAILED, WATCH_MISMATCH, WATCH_NOT_SHOWN, useStore, type AppStore } from '../../store';
import { errorText } from '../../store/messages';
import { effectiveTheme, settings } from '../../store/settings';
import { useArena } from '../../store/arena';
import { t as uiT } from '../../text';
import { registerArenaTicketInfo } from '../../tickets/arena-info';
import { ArenaLayout } from './Arena';
import { buildHud, buildRoundContext, fightInputOf } from './context';
import { readArenaPalette } from './palette';
import { ROUND_END_MS, RoundEndOverlay, resetRoundEnd, roundEnd } from './RoundEnd';
import { useViewerSession, type StopKind } from './session';
import { clock, t } from './text';

const TICK_S = 0.05;

/** The round waiting to be watched, from the committed state. */
export function watchingOf(state: GameState | null): { fixtureId: FixtureId; round: number; cursorTick: number } | null {
  const ms = state?.liveMatch;
  const w = ms?.watch;
  return ms && w && w.mode === 'watch' && w.round !== null ? { fixtureId: ms.fixtureId, round: w.round, cursorTick: w.cursorTick } : null;
}

/** The finished round for the overlay: winner, score (the player's side first) and time, from committed state only. */
function roundOutcome(state: GameState, fixtureId: FixtureId, round: number): NonNullable<ReturnType<typeof roundEnd.peek>>['result'] {
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
  const ours = playerHome || playerAway ? (r.winner === 'home') === playerHome : null;
  const [a, b] = playerAway ? [score.away, score.home] : [score.home, score.away];
  return { winner: (winnerId ? state.clubs[winnerId]?.name : undefined) ?? winnerId ?? '', ours, score: `${a}–${b}`, time: clock(r.durationTicks * TICK_S) };
}

export default function ArenaScreen(_props: ScreenProps) {
  const store = useStore() as AppStore;
  const state = store.game.value;
  const content = store.content.value;
  const over = roundEnd.value;
  // While the committed round's result shows, the round stays mounted (the state under it has already moved on).
  const frozen = useRef<{ fixtureId: FixtureId; round: number } | null>(null);
  const w = watchingOf(state);
  if (over?.phase === 'result' && frozen.current) {
    // keep the frozen round
  } else frozen.current = w ? { fixtureId: w.fixtureId, round: w.round } : null;
  useEffect(() => () => resetRoundEnd(), []);

  const shown = frozen.current;
  return (
    <>
      {state && content && shown ? <LiveArena key={`${shown.fixtureId}:${shown.round}`} store={store} content={content} fixtureId={shown.fixtureId} round={shown.round} /> : <NoRound state={state} />}
      <RoundEndOverlay />
    </>
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

type Loaded = { kind: 'ok'; playback: import('../../../core/game').RoundPlayback; ctx: ReturnType<typeof buildRoundContext>; match: import('../../../core/game').MatchPlayback | null } | { kind: 'stub' } | { kind: 'error'; message: string };

function LiveArena({ store, content, fixtureId, round }: { store: AppStore; content: ContentDB; fixtureId: FixtureId; round: number }) {
  const arena = useArena(store);
  const hostRef = useRef<HTMLElement | null>(null);

  // The round is loaded ONCE per mount: a re-render (the cursor save changes the state) must not simulate it again.
  const loaded = useMemo<Loaded>(() => {
    const state = store.game.value!;
    const r = arena.liveRound(state);
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

function LiveRound({ store, content, fixtureId, round, loaded, hostRef }: { store: AppStore; content: ContentDB; fixtureId: FixtureId; round: number; loaded: Extract<Loaded, { kind: 'ok' }>; hostRef: { current: HTMLElement | null } }) {
  const arena = useArena(store);
  const { playback, ctx, match } = loaded;
  const startTick = playback.startTick;
  const state = store.game.value!;
  const [confirm, setConfirm] = useState<'skip' | 'simulate' | null>(null);
  const [busy, setBusy] = useState(false);
  const resumePlaying = useRef(false);
  const committing = useRef(false);

  // The cursor persisted so far (the resume point at mount). The inspector's probe waits for it: core refuses a tick past it.
  const cursorSaved = useMemo(() => signal(startTick), []);
  const lastSaved = useRef(startTick);

  const persistCursor = (viewer: ArenaViewer): void => {
    // The reveal frontier: an integer tick at or beyond everything shown (tech-019); a rewind never lowers it.
    const head = Math.ceil(viewer.headTick);
    if (head <= lastSaved.current) return;
    const before = lastSaved.current;
    lastSaved.current = head;
    void arena.saveCursor(store.game.value ?? state, head).then((r) => {
      if (r.ok) cursorSaved.value = Math.max(cursorSaved.value, head);
      else lastSaved.current = before;
    });
  };

  /** Show the committed round for 1.5 s, then open what comes next. */
  const showResult = (after: GameState, next: () => void): void => {
    const result = roundOutcome(after, fixtureId, round);
    roundEnd.value = { phase: 'result', round, result, next, retry: null };
  };

  const finish = async (): Promise<void> => {
    if (committing.current) return;
    committing.current = true;
    setBusy(true);
    roundEnd.value = { phase: 'saving', round, result: null, next: null, retry: null };
    // The hash of the log the viewer loaded (never a hash of anything else): the commit compares it in every build.
    const res = await arena.finishRound({ round, logHash: playback.log.hash });
    committing.current = false;
    setBusy(false);
    const after = store.game.value ?? state;
    if (res.ok) return showResult(after, () => afterMatch(after, res.value));
    switch (res.error.code) {
      case MATCH_PAUSED:
        return showResult(after, () => navigate('#/between-rounds'));
      case MATCH_WATCHING:
        return showResult(after, () => navigate('#/arena'));
      case WATCH_MISMATCH:
        roundEnd.value = { phase: 'mismatch', round, result: null, next: null, retry: null, message: res.error.message };
        return;
      case WATCH_NOT_SHOWN:
      case SAVE_ROUND_FAILED:
      default:
        roundEnd.value = { phase: 'failed', round, result: null, next: null, retry: () => void finish(), message: res.error.message };
    }
  };

  const onStopped = (stop: StopKind, viewer: ArenaViewer): void => {
    if (stop.kind === 'end') {
      void finish();
      return;
    }
    persistCursor(viewer);
  };

  const session = useViewerSession(hostRef, {
    playback,
    ctx,
    content,
    autoplay: startTick === 0,
    pauseWhenHidden: settings.value.arena.pauseWhenHidden,
    onStopped,
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

  const hud = useMemo(() => buildHud({ state, ctx, match, kind: 'live' }), []);
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
    const head = Math.ceil(session.snap.peek().head);
    const res = await arena.simulateRest(store.game.value ?? state, head);
    setBusy(false);
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
      overlay={
        <>
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
