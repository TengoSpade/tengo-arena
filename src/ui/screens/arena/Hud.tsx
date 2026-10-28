/**
 * The top strip of the arena (04 §4, 05-technical-m2 §A7): crests, score, round pips, clock (amber in overtime),
 * fighters standing, speed and pause, and the calls-left slot (hidden until the calls package). Pure DOM over the
 * viewer's frame: for a live round nothing here reads past the live head.
 */
import type { ReadonlySignal } from '@preact/signals';
import type { ArenaFrameState, Speed } from '../../../render';
import { Crest, crestLetters, Segmented, tipAttrs } from '../../components';
import type { ViewerSnap } from './session';
import { clock, t } from './text';

export interface HudSide {
  name: string;
  shortName: string;
  code: string;
  primary: string;
  secondary: string;
}

/** One pip per round of the match: who won it, the one being played, or still to come. */
export type PipState = 'home' | 'away' | 'current' | 'later';

export interface HudInfo {
  sides: readonly [HudSide, HudSide];
  bestOf: number;
  round: number;
  /** Rounds won before the round shown (a replay shows the score after it once it ended). */
  score: { home: number; away: number };
  pips: readonly PipState[];
  kind: 'live' | 'replay';
}

const TICK_S = 0.05;
const SPEED_OPTIONS = ([1, 2, 4] as const).map((n) => ({ id: String(n) as '1' | '2' | '4', label: t('speedOption', { n }) }));

export function ArenaHud({
  info,
  frame,
  snap,
  onToggle,
  onSpeed,
}: {
  info: HudInfo;
  frame: ReadonlySignal<ArenaFrameState | null>;
  snap: ReadonlySignal<ViewerSnap>;
  onToggle: () => void;
  onSpeed: (speed: Speed) => void;
}) {
  const f = frame.value;
  const sn = snap.value;
  const seconds = f ? f.fightSeconds : sn.tick * TICK_S;
  const overtime = f?.overtime ?? false;
  const [home, away] = info.sides;
  const standing = f?.standing ?? { home: 5, away: 5 };
  return (
    <header class="arena-hud" data-testid="arena-hud">
      <div class="arena-hud__side arena-hud__side--home" data-testid="hud-home">
        <Crest primary={home.primary} secondary={home.secondary} code={crestLetters(home)} size="md" />
        <span class="arena-hud__name">{home.name}</span>
      </div>
      <div class="arena-hud__center">
        <span class="arena-hud__score u-num" data-testid="arena-score" role="img" aria-label={t('hudScoreLabel', { home: home.name, a: info.score.home, away: away.name, b: info.score.away })}>
          {info.score.home}–{info.score.away}
        </span>
        <ol class="arena-hud__pips" aria-label={t('hudBestOf', { n: info.bestOf })} data-testid="arena-pips">
          {info.pips.map((p, i) => (
            <li
              key={i}
              class={`arena-pip arena-pip--${p}`}
              data-state={p}
              aria-label={t('hudPip', {
                n: i + 1,
                outcome: p === 'home' ? t('hudPipWon', { club: home.name }) : p === 'away' ? t('hudPipWon', { club: away.name }) : p === 'current' ? t('hudPipPending') : t('hudPipLater'),
              })}
            />
          ))}
        </ol>
        <span class="arena-hud__round u-xs u-muted">{t('hudRound', { n: info.round, max: info.bestOf })}</span>
        <span class={`arena-hud__clock u-num${overtime ? ' is-overtime' : ''}`} data-testid="arena-clock" data-overtime={overtime ? 'true' : undefined} aria-label={t('hudClock', { time: clock(seconds) })} {...tipAttrs(overtime ? t('hudOvertimeTip') : null)}>
          {clock(seconds)}
          {overtime && <span class="arena-hud__ot"> {t('hudOvertime')}</span>}
        </span>
        <span class="arena-hud__standing u-num" data-testid="arena-standing" role="img" aria-label={t('hudStanding', { home: standing.home, away: standing.away })}>
          {standing.home} v {standing.away}
        </span>
      </div>
      <div class="arena-hud__side arena-hud__side--away" data-testid="hud-away">
        <span class="arena-hud__name">{away.name}</span>
        <Crest primary={away.primary} secondary={away.secondary} code={crestLetters(away)} size="md" />
      </div>
      <div class="arena-hud__transport">
        {/* The calls-left slot (P-01) stays hidden until the calls package lands. */}
        <span class="arena-hud__calls" hidden data-testid="arena-calls" aria-hidden="true">
          {t('hudCallsLeft')}
        </span>
        <span class="tag tag--outline arena-hud__mode" data-testid="arena-mode">
          {info.kind === 'live' ? t('hudLive') : t('hudReplay')}
        </span>
        <Segmented<'1' | '2' | '4'> label={t('speedLabel')} value={String(sn.speed) as '1' | '2' | '4'} onChange={(id) => onSpeed(Number(id) as Speed)} options={SPEED_OPTIONS} />
        <button class="btn btn--primary" type="button" onClick={onToggle} data-testid="arena-play" aria-pressed={sn.playing ? 'true' : 'false'} {...tipAttrs(t('playTip'))}>
          <span class="icon" data-icon="play" aria-hidden="true" />
          {sn.playing ? t('pause') : t('play')} <kbd>Space</kbd>
        </button>
      </div>
    </header>
  );
}
