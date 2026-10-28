/**
 * #/replay/:fixtureId (?round=2&tick=340): a played match in the arena viewer (05-technical-m2 §A3, §A4, §A7).
 * A replay re-simulates stored inputs through core/game roundPlayback (checksum-verified), so what is shown is the
 * recorded result. Free seeking, key-moment marks, round tabs; the report's key moments jump here, starting 2 s
 * before the moment. The live match's earlier rounds replay here too (the between-round screen's "Replay round n").
 * A replay that does not reproduce its checksum is a defect: it is reported, never shown.
 */
import { useMemo, useRef, useState } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import type { MatchPlayback, ReplayUnavailableReason, RoundPlayback } from '../../../core/game';
import type { FixtureId, GameState } from '../../../core/model';
import type { EngineError, Result } from '../../../core/util';
import { navigate } from '../../app/router';
import type { ScreenProps } from '../../app/routes';
import type { ShortcutHandler, ShortcutMap } from '../../app/shortcuts';
import { Callout, Empty, PageHeader } from '../../components';
import { useStore, type AppStore } from '../../store';
import { errorText } from '../../store/messages';
import { effectiveTheme, settings } from '../../store/settings';
import { useArena, watchingMatch } from '../../store/arena';
import { tipAttrs } from '../../components';
import { registerArenaTicketInfo } from '../../tickets/arena-info';
import { useEffect } from 'preact/hooks';
import { ArenaLayout } from './Arena';
import { buildHud, buildRoundContext, fightInputOf } from './context';
import { hookSlot } from './hook-registry';
import { readArenaPalette } from './palette';
import { useViewerSession, type ArenaSession } from './session';
import { clock, t } from './text';

const TICK_S = 0.05;

function reasonText(reason: ReplayUnavailableReason): string {
  switch (reason) {
    case 'compacted':
      return t('replayCompacted');
    case 'other-build':
      return t('replayOtherBuild');
    case 'live':
      return t('replayLive');
    case 'not-played':
      return t('replayNotPlayed');
  }
}

export default function ReplayScreen({ params }: ScreenProps) {
  const store = useStore() as AppStore;
  const state = store.game.value;
  const content = store.content.value;
  const fixtureId = (params['fixtureId'] ?? '') as FixtureId;
  if (!state || !content) return <section class="page" data-testid="screen-replay" aria-busy="true" />;
  const round = Number(params['round']);
  const tick = Number(params['tick']);
  return (
    <ReplayMatch
      key={fixtureId}
      store={store}
      state={state}
      content={content}
      fixtureId={fixtureId}
      initialRound={Number.isInteger(round) && round >= 1 ? round : 1}
      initialTick={Number.isFinite(tick) && tick > 0 ? Math.floor(tick) : 0}
    />
  );
}

function Unavailable({ title, text }: { title: string; text: string }) {
  return (
    <section class="page" data-testid="screen-replay">
      <PageHeader eyebrow={t('eyebrowReplay')} title={t('title')} />
      <Empty
        icon="swords"
        title={title}
        text={text}
        actions={
          <a class="btn" href="#/fixtures">
            {t('replayAvailBack')}
          </a>
        }
      />
    </section>
  );
}

function ReplayMatch({ store, state, content, fixtureId, initialRound, initialTick }: { store: AppStore; state: GameState; content: ContentDB; fixtureId: FixtureId; initialRound: number; initialTick: number }) {
  const arena = useArena(store);
  const hooked = hookSlot.fixture && hookSlot.fixture.fixtureId === fixtureId ? hookSlot.fixture : null;
  // The match's playable rounds: committed rounds only (the live match's current round is watched, not replayed).
  const mp = useMemo<Result<MatchPlayback, EngineError> | null>(() => (hooked ? null : arena.matchPlayback(state, fixtureId)), [fixtureId]);
  const rounds = hooked ? [hooked.playback.round] : mp && mp.ok ? mp.value.rounds.filter((r) => r.winner !== null).map((r) => r.round) : [];
  const [round, setRound] = useState(initialRound);
  // The tick the replay starts at applies to the first round shown only.
  const firstTick = useRef(initialTick);

  if (!hooked && mp === null) return <Unavailable title={t('stubTitle')} text={t('stubText')} />;
  if (!hooked && mp && !mp.ok) {
    const reason = (mp.error.details as { reason?: ReplayUnavailableReason } | undefined)?.reason;
    return <Unavailable title={t('replayUnavailable')} text={reason ? reasonText(reason) : errorText(mp.error)} />;
  }
  if (rounds.length === 0) return <Unavailable title={t('replayUnavailable')} text={t('replayNotPlayed')} />;
  const shown = rounds.includes(round) ? round : rounds[0]!;
  return (
    <ReplayRound
      store={store}
      state={state}
      content={content}
      fixtureId={fixtureId}
      match={hooked ? null : mp && mp.ok ? mp.value : null}
      rounds={rounds}
      round={shown}
      startTick={shown === initialRound ? firstTick.current : 0}
      onRound={(n) => {
        firstTick.current = 0;
        setRound(n);
      }}
      hooked={hooked?.playback ?? null}
    />
  );
}

function ReplayRound({
  store,
  state,
  content,
  fixtureId,
  match,
  rounds,
  round,
  startTick,
  onRound,
  hooked,
}: {
  store: AppStore;
  state: GameState;
  content: ContentDB;
  fixtureId: FixtureId;
  match: MatchPlayback | null;
  rounds: number[];
  round: number;
  startTick: number;
  onRound: (n: number) => void;
  hooked: RoundPlayback | null;
}) {
  const arena = useArena(store);
  const hostRef = useRef<HTMLElement | null>(null);
  const loaded = useMemo(() => {
    const r: Result<RoundPlayback, EngineError> | null = hooked ? { ok: true, value: hooked } : arena.replayRound(state, fixtureId, round);
    if (r === null || !r.ok) return { playback: null, error: r === null ? t('stubText') : r.error };
    const palette = readArenaPalette(effectiveTheme(settings.value));
    const start = Math.max(0, startTick - 0);
    return { playback: r.value, error: null, ctx: buildRoundContext({ state, content, playback: r.value, match, palette, startTick: start }) };
  }, [fixtureId, round]);

  const tabs = (
    <div class="segmented" role="tablist" aria-label={t('roundTabs')} data-testid="arena-round-tabs">
      {rounds.map((n) => {
        const w = match?.rounds.find((r) => r.round === n)?.winner ?? null;
        const ours = w === null || match?.playerSide == null ? null : w === match.playerSide;
        return (
          <button key={n} type="button" role="tab" aria-pressed={n === round ? 'true' : 'false'} aria-selected={n === round ? 'true' : 'false'} onClick={() => onRound(n)} {...tipAttrs(`Alt ${n}`)}>
            R{n} {ours !== null && <span class="u-faint">{ours ? t('replayWon') : t('replayLost')}</span>}
          </button>
        );
      })}
    </div>
  );
  const keys: Record<string, ShortcutHandler> = {};
  for (const n of rounds) keys[`alt+${n}`] = () => (onRound(n), true);

  if (!loaded.playback) {
    const err = loaded.error;
    const mismatch = typeof err !== 'string' && err.code === 'replay.mismatch';
    const reason = typeof err !== 'string' ? (err.details as { reason?: ReplayUnavailableReason } | undefined)?.reason : undefined;
    return (
      <section class="page" data-testid="screen-replay">
        <PageHeader eyebrow={t('eyebrowReplay')} title={t('title')} />
        {tabs}
        {mismatch ? (
          <Callout kind="bad" title={t('roundError')}>
            {t('roundErrorMismatch')}
          </Callout>
        ) : (
          <Empty icon="warning" title={t('roundError')} text={typeof err === 'string' ? err : reason ? reasonText(reason) : errorText(err)} />
        )}
      </section>
    );
  }
  return <ReplayStage store={store} state={state} content={content} fixtureId={fixtureId} match={match} round={round} rounds={rounds} loaded={loaded as Required<typeof loaded> & { playback: RoundPlayback }} hostRef={hostRef} tabs={tabs} keys={keys} onRound={onRound} />;
}

function ReplayStage({
  store,
  state,
  content,
  fixtureId,
  match,
  round,
  rounds,
  loaded,
  hostRef,
  tabs,
  keys,
  onRound,
}: {
  store: AppStore;
  state: GameState;
  content: ContentDB;
  fixtureId: FixtureId;
  match: MatchPlayback | null;
  round: number;
  rounds: number[];
  loaded: { playback: RoundPlayback; ctx: ReturnType<typeof buildRoundContext> };
  hostRef: { current: HTMLElement | null };
  tabs: preact.ComponentChildren;
  keys: ShortcutMap;
  onRound: (n: number) => void;
}) {
  const arena = useArena(store);
  const { playback, ctx } = loaded;
  const session = useViewerSession(hostRef, { playback, ctx, content, autoplay: true, pauseWhenHidden: false });

  useEffect(
    () =>
      registerArenaTicketInfo(() => {
        const s = session.snap.peek();
        return { kind: 'replay', fixtureId, round, tick: s.tick, headTick: s.head, speed: s.speed, playing: s.playing };
      }),
    [round],
  );

  const snap = session.snap.value;
  const ended = snap.end !== null && snap.tick >= snap.end && !snap.playing;
  // After the round: the score including it (the recorded result), else the score before.
  const score = useMemo(() => {
    const before = playback.scoreBefore;
    const w = ended ? playback.result?.winner : null;
    return w ? { home: before.home + (w === 'home' ? 1 : 0), away: before.away + (w === 'away' ? 1 : 0) } : before;
  }, [playback, ended]);
  const hud = useMemo(() => buildHud({ state, ctx, playback, kind: 'replay', score }), [playback, ended]);
  void match;
  const roleName = (r: string) => content.combat.archetypes.find((a) => a.id === r)?.name ?? r;
  const next = rounds[rounds.indexOf(round) + 1];
  // Esc and the Report button: back to the match report. A round of the match still being played has no report yet: back to the
  // match (the between-round screen, or the arena when a round waits); the test hook's fixture round has none: Home.
  const liveMatch = state.liveMatch?.fixtureId === fixtureId;
  const toReport = () =>
    navigate(hookSlot.fixture?.fixtureId === fixtureId ? '#/home' : liveMatch ? (watchingMatch(store.game.value ?? state) ? '#/arena' : '#/between-rounds') : `#/match/${encodeURIComponent(fixtureId)}`);

  return (
    <ArenaLayout
      session={session as ArenaSession}
      hostRef={hostRef}
      ctx={ctx}
      hud={hud}
      kind="replay"
      content={content}
      roleName={roleName}
      inputOf={(id) => fightInputOf(state, fixtureId, id)}
      probe={(tick) => arena.inspect(state, fixtureId, round, tick)}
      busy={false}
      onSkip={() => session.seek(snap.end ?? snap.head)}
      statusSlot={tabs}
      onReport={toReport}
      reportLabel={liveMatch ? { text: t('hudBackMatch'), tip: t('hudBackMatchTip') } : undefined}
      onEscape={toReport}
      extraKeys={keys}
      overlay={
        ended ? (
          <div class="around" role="status" data-testid="replay-end">
            <div class="around__card">
              <span class="around__title">{t('endReplayTitle', { n: round })}</span>
              <span class="around__sub u-num">{clock((snap.end ?? 0) * TICK_S)}</span>
              <span class="around__foot">
                <button
                  class="btn btn--sm"
                  type="button"
                  onClick={() => {
                    session.seek(0);
                    session.play();
                  }}
                  data-testid="replay-again"
                >
                  {t('endReplayAgain')}
                </button>
                {next !== undefined && (
                  <button class="btn btn--sm btn--primary" type="button" onClick={() => onRound(next)} data-testid="replay-next">
                    {t('endReplayNext')}
                  </button>
                )}
                <button class="btn btn--sm btn--ghost" type="button" onClick={toReport}>
                  {t('endReplayReport')}
                </button>
              </span>
            </div>
          </div>
        ) : null
      }
    />
  );
}
