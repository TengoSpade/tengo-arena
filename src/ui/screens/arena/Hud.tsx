/**
 * The top strip of the arena (04 §4, mockups/arena.html `.ahud`; 05-technical-m2 §A7): crests, names with "n of 5
 * standing", rounds won as pips, round and clock (amber with the word Overtime), speed and pause, the hidden calls slot.
 * Pure DOM over the viewer's frame: for a live round nothing here reads past the live head. The player's side is on
 * the same place whichever side the player is on (home left, away right, as the report); the colour-free player cue is the
 * "You" tag and the ring style (solid for ours, double for theirs).
 */
import type { ReadonlySignal } from '@preact/signals';
import type { ArenaFrameState, Speed } from '../../../render';
import { Crest, crestLetters, Icon, Segmented, tipAttrs } from '../../components';
import type { ViewerSnap } from './session';
import { clock, t } from './text';

export interface HudSide {
  name: string;
  shortName: string;
  code: string;
  primary: string;
  secondary: string;
  /** 0 home, 1 away. */
  side: 0 | 1;
  /** The player's side. */
  ours: boolean;
  /** Rounds won so far (the round shown included once it ended, in a replay). */
  wins: number;
}

export interface HudInfo {
  /** Home, whoever the player is. */
  left: HudSide;
  /** Away. */
  right: HudSide;
  bestOf: number;
  round: number;
  kind: 'live' | 'replay';
  /** Row of each unit index, for the fighter strip's order. */
  rows: Readonly<Record<number, 'front' | 'back'>>;
}

const TICK_S = 0.05;
const SPEED_OPTIONS = ([1, 2, 4] as const).map((n) => ({ id: String(n) as '1' | '2' | '4', label: t('speedOption', { n }), tip: undefined }));


export function ArenaHud({
  info,
  frame,
  snap,
  overtime: ot,
  onToggle,
  onSpeed,
  onReport,
  reportLabel,
  onLeave,
}: {
  info: HudInfo;
  frame: ReadonlySignal<ArenaFrameState | null>;
  snap: ReadonlySignal<ViewerSnap>;
  /** Overtime's start and hard cap in seconds (content combat.overtime), for the tooltips. */
  overtime: { startS: number; capS: number };
  onToggle: () => void;
  onSpeed: (speed: Speed) => void;
  /** Replay: back to the report (or the match, for a live match's earlier round). */
  onReport?: () => void;
  reportLabel?: { text: string; tip: string };
  /** Live: leave the arena (a visible control for the pointer; Esc is the key). */
  onLeave?: () => void;
}) {
  const f = frame.value;
  const sn = snap.value;
  const seconds = f ? f.fightSeconds : sn.tick * TICK_S;
  const inOvertime = f?.overtime ?? false;
  const need = Math.ceil(info.bestOf / 2);
  const standingOf = (s: HudSide): number | null => (f ? (s.side === 0 ? f.standing.home : f.standing.away) : null);
  const sideView = (s: HudSide, away: boolean) => {
    const n = standingOf(s);
    return (
      <div class={`ahud__side${away ? ' ahud__side--away' : ''}`} data-side={s.ours ? 'us' : 'them'} data-testid={away ? 'hud-right' : 'hud-left'}>
        <Crest primary={s.primary} secondary={s.secondary} code={crestLetters({ name: s.name, code: s.code })} size="md" />
        <div class="ahud__who">
          <span class="ahud__name">{s.name}</span>
          <span class="ahud__sub">
            {s.ours ? `${t('hudYou')} · ` : ''}
            <span data-testid={away ? 'hud-right-standing' : 'hud-left-standing'}>{n === null ? '' : t('hudStandingOf', { n, max: 5 })}</span>
          </span>
        </div>
        <span class="ahud__pips" role="img" aria-label={t('hudWins', { n: s.wins, need })} data-testid={away ? 'hud-right-pips' : 'hud-left-pips'} {...tipAttrs(t('hudWinsTip', { n: s.wins, need }))}>
          {Array.from({ length: need }, (_, i) => (
            <i key={i} class={`spip${i < s.wins ? ' is-won' : ''}`} />
          ))}
        </span>
      </div>
    );
  };
  return (
    <header class="ahud" aria-label={t('hudAria')} data-testid="arena-hud">
      {sideView(info.left, false)}
      <div class="ahud__center" data-overtime={inOvertime ? 'true' : undefined}>
        <div class="ahud__round">
          <span class="ahud__round-label">{t('hudRound', { n: info.round, max: info.bestOf })}</span>
          <span
            class="ahud__clock"
            role="timer"
            data-testid="arena-clock"
            aria-label={inOvertime ? t('hudClockOt', { time: clock(seconds) }) : t('hudClock', { time: clock(seconds) })}
            {...tipAttrs(inOvertime ? null : t('hudOvertimeTip', { time: clock(ot.startS) }))}
          >
            {clock(seconds)}
          </span>
        </div>
        {inOvertime && (
          <span class="tag tag--warn ahud__ot" data-testid="arena-overtime" {...tipAttrs(t('hudOvertimeTip2', { time: clock(ot.startS), cap: ot.capS }))}>
            <Icon name="clock" />
            {t('hudOvertime')}
          </span>
        )}
      </div>
      {sideView(info.right, true)}
      <div class="ahud__controls">
        {info.kind === 'replay' && (
          <>
            <span class="tag tag--accent" data-testid="arena-mode" {...tipAttrs(t('hudReplayTip'))}>
              <Icon name="play" />
              {t('hudReplay')}
            </span>
            {onReport && (
              <button class="btn btn--sm btn--ghost" type="button" onClick={onReport} data-testid="replay-report-link" {...tipAttrs(reportLabel?.tip ?? t('hudReportTip'))}>
                <Icon name="chevron-left" />
                {reportLabel?.text ?? t('hudReport')} <kbd>Esc</kbd>
              </button>
            )}
          </>
        )}
        {info.kind === 'live' && onLeave && (
          <button class="btn btn--sm btn--ghost" type="button" onClick={onLeave} data-testid="arena-leave" {...tipAttrs(t('hudLeaveTip'))}>
            <Icon name="chevron-left" />
            {t('hudLeave')} <kbd>Esc</kbd>
          </button>
        )}
        {/* The calls-left slot (P-01) stays hidden until the calls package lands. */}
        <span class="ahud__calls" hidden data-testid="arena-calls" aria-hidden="true">
          {t('hudCallsLeft')}
        </span>
        <Segmented<'1' | '2' | '4'> label={t('speedGroup')} value={String(sn.speed) as '1' | '2' | '4'} onChange={(id) => onSpeed(Number(id) as Speed)} options={SPEED_OPTIONS} />
        {sn.playing ? (
          <button class="btn" type="button" onClick={onToggle} data-testid="arena-play" {...tipAttrs(t('pauseTip'))}>
            <Icon name="pause" />
            {t('pause')} <kbd>Space</kbd>
          </button>
        ) : (
          <button class="btn btn--primary" type="button" onClick={onToggle} data-testid="arena-play" {...tipAttrs(`${t('play')} (Space)`)}>
            <Icon name="play" />
            {t('play')} <kbd>Space</kbd>
          </button>
        )}
      </div>
    </header>
  );
}
