/**
 * The transport row under the canvas: frame steps, the scrubber with its key-moment marks, Live, Skip to end of
 * round, Simulate the rest, the inspector and the names toggle. Pure DOM over the session. For a live round the
 * scrubber spans 0 to the live head (never shows the end, never marks beyond the head); a replay spans the round.
 */
import type { ReadonlySignal } from '@preact/signals';
import type { KeyMoment } from '../../../render';
import { Icon, tipAttrs } from '../../components';
import type { ArenaSession, ViewerSnap } from './session';
import { clock, t } from './text';

const TICK_S = 0.05;

export function ArenaControls({
  session,
  kind,
  marks,
  inspectorOpen,
  labels,
  onToggleInspector,
  onSkip,
  onSimulateRest,
  busy,
}: {
  session: ArenaSession;
  kind: 'live' | 'replay';
  /** Key moments up to the head (live) or all (replay): the scrubber marks. */
  marks: ReadonlySignal<readonly KeyMoment[]>;
  inspectorOpen: boolean;
  labels: 'off' | 'selected' | 'all';
  onToggleInspector: () => void;
  onSkip: () => void;
  onSimulateRest?: () => void;
  /** A commit is running: the actions that commit are disabled. */
  busy: boolean;
}) {
  const sn: ViewerSnap = session.snap.value;
  const head = Math.max(sn.head, 0);
  const tick = Math.min(sn.tick, head);
  const behind = kind === 'live' && head - tick > 1;
  const ready = session.status.value === 'ready';
  const pct = (n: number) => (head > 0 ? `${Math.min(100, (n / head) * 100)}%` : '0%');
  return (
    <div class="arena-controls" data-testid="arena-controls" role="group" aria-label={t('controlsLabel')}>
      <button class="icon-btn" type="button" onClick={() => session.step(-2)} disabled={!ready || sn.playing} aria-label={t('frameBack')} data-testid="arena-frame-back">
        <Icon name="chevron-left" />
      </button>
      <button class="icon-btn" type="button" onClick={() => session.step(2)} disabled={!ready || sn.playing} aria-label={t('frameForward')} data-testid="arena-frame-forward">
        <Icon name="chevron-right" />
      </button>
      <div class="arena-scrub">
        <input
          class="range arena-scrub__input"
          type="range"
          min={0}
          max={head}
          step={1}
          value={Math.floor(tick)}
          disabled={!ready}
          aria-label={t('scrubber')}
          aria-valuetext={kind === 'live' ? t('scrubberLive', { time: clock(tick * TICK_S), head: clock(head * TICK_S) }) : t('scrubberValue', { time: clock(tick * TICK_S), head: clock(head * TICK_S) })}
          data-testid="arena-scrubber"
          onInput={(e) => session.seek(Number((e.target as HTMLInputElement).value))}
        />
        <div class="arena-scrub__marks" aria-hidden="true" data-testid="arena-marks">
          {marks.value
            .filter((m) => m.tick <= head && m.kind !== 'end')
            .map((m) => (
              <span key={m.seq} class={`arena-scrub__mark arena-scrub__mark--${m.kind}`} data-kind={m.kind} data-tick={m.tick} style={{ left: pct(m.tick) }} />
            ))}
        </div>
      </div>
      {kind === 'live' && (
        <button class="btn btn--sm" type="button" onClick={() => session.live()} disabled={!ready || !behind} data-testid="arena-live" {...tipAttrs(t('goLiveTip'))}>
          {t('goLive')} <kbd>End</kbd>
        </button>
      )}
      <button class="btn btn--sm" type="button" onClick={onSkip} disabled={!ready || busy} data-testid="arena-skip" {...tipAttrs(t('skipRoundTip'))}>
        {t('skipRound')} <kbd>Shift S</kbd>
      </button>
      {onSimulateRest && (
        <button class="btn btn--sm" type="button" onClick={onSimulateRest} disabled={!ready || busy} data-testid="arena-simulate-rest" {...tipAttrs(t('simulateRestTip'))}>
          {t('simulateRest')}
        </button>
      )}
      <button class="btn btn--sm btn--ghost" type="button" aria-pressed={inspectorOpen ? 'true' : 'false'} onClick={onToggleInspector} data-testid="arena-inspector-toggle" {...tipAttrs(t('inspectorTip'))}>
        {t('inspector')} <kbd>I</kbd>
      </button>
      <button class="btn btn--sm btn--ghost" type="button" onClick={() => session.cycleLabels()} data-testid="arena-labels" {...tipAttrs(t('labelsTip'))}>
        {labels === 'off' ? t('labelsOff') : labels === 'all' ? t('labelsAll') : t('labelsSelected')} <kbd>L</kbd>
      </button>
    </div>
  );
}
