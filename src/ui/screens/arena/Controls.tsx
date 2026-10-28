/**
 * The transport bar under the stage (mockups/arena.html `.atransport`; 05-technical-m2 §A7, §A18): the status (Live,
 * Paused automatically with its cause, Round over; a replay's round tabs), the scrubber with its key-moment marks, the
 * time, frame steps, Live, Skip to end of round and Simulate the rest.
 *
 * The LIVE scrubber is a fixed 0 to time-cap track (75 s, a known constant, so its length tells nothing about the
 * round): the part past the head is empty and not seekable and marks never drift (A18). A replay's track is the round,
 * its marks after the playhead dimmed. Ours sit above the track, theirs below (the mark's place carries the side).
 */
import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { Icon, tipAttrs } from '../../components';
import type { FeedItem } from './feed';
import { mergeMarks, type MarkGroup } from './marks';
import { useElementWidth } from './responsive';
import type { ArenaSession, ViewerSnap } from './session';
import { clock, t } from './text';

const TICK_S = 0.05;

export function ArenaControls({
  session,
  kind,
  capTicks,
  marks,
  statusNote,
  statusSlot,
  dockOpen,
  onToggleDock,
  onSkip,
  onSimulateRest,
  busy,
}: {
  session: ArenaSession;
  kind: 'live' | 'replay';
  /** The live track's fixed length: the hard time cap in ticks (content combat.overtime.hardCapS). */
  capTicks: number;
  /** Key moments up to the head (live) or all (replay). */
  marks: readonly FeedItem[];
  /** "Kael Dunmere was downed": the cause of an automatic pause, shown beside its tag. */
  statusNote: string | null;
  /** A replay's round tabs. */
  statusSlot?: ComponentChildren;
  dockOpen: boolean;
  onToggleDock: () => void;
  onSkip: () => void;
  onSimulateRest?: () => void;
  /** A commit is running: the actions that commit are disabled. */
  busy: boolean;
}) {
  const sn: ViewerSnap = session.snap.value;
  const stop = session.lastStop.value;
  const ready = session.status.value === 'ready';
  const live = kind === 'live';
  const head = Math.max(sn.head, 0);
  const span = live ? capTicks : Math.max(sn.end ?? head, 1);
  const tick = Math.min(sn.tick, live ? head : span);
  const at = (n: number): number => Math.max(0, Math.min(1, n / span));
  const over = !live && sn.end !== null && tick >= sn.end;
  const behind = live && head - tick > 1;
  // Marks that would touch on the track (closer than 12 px) are one.
  const scrub = useRef<HTMLDivElement>(null);
  const trackPx = useElementWidth(scrub);
  const shown = marks.filter((m) => !live || m.tick <= head);
  const groups = mergeMarks(shown, at, trackPx);

  // Pointer seeking: the track maps to ticks 0..span; a live seek never passes the head (the session clamps it).
  const seekFrom = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return;
    session.seek(Math.round(((e.clientX - r.left) / r.width) * span));
  };

  const status = (
    <div class="atransport__status" data-testid="transport-status">
      {statusSlot ??
        (live ? (
          stop && !sn.playing && stop.kind === 'auto' ? (
            <>
              <span class="tag tag--warn" data-testid="status-auto">
                <Icon name="pause" size="sm" />
                {t('statusAuto')}
              </span>
              {statusNote && <span data-testid="status-note">{statusNote}</span>}
            </>
          ) : stop?.kind === 'end' ? (
            <>
              <span class="tag">
                <Icon name="check" size="sm" />
                {t('statusOver')}
              </span>
              {statusNote && <span data-testid="status-note">{statusNote}</span>}
            </>
          ) : sn.playing ? (
            <span class="tag tag--good" data-testid="status-live">
              <Icon name="eye" size="sm" />
              {t('statusLive')}
            </span>
          ) : (
            <>
              <span class="tag" data-testid="status-paused">
                <Icon name="pause" size="sm" />
                {t('statusPaused')}
              </span>
              <span class="col-wide u-faint">{t('statusSelect')}</span>
            </>
          )
        ) : null)}
    </div>
  );

  return (
    <div class="atransport" data-testid="arena-controls" role="group" aria-label={t('controlsLabel')}>
      {status}
      <div
        ref={scrub}
        class="ascrub"
        role="slider"
        tabIndex={0}
        aria-label={live ? t('scrubLive') : t('scrubber')}
        aria-valuemin={0}
        aria-valuemax={Math.round(span * TICK_S)}
        aria-valuenow={Math.round(tick * TICK_S)}
        aria-valuetext={live ? t('scrubLiveValue', { time: clock(tick * TICK_S) }) : t('scrubReplayValue', { time: clock(tick * TICK_S), end: clock(span * TICK_S) })}
        aria-disabled={ready ? undefined : 'true'}
        data-testid="arena-scrubber"
        data-span={Math.round(span)}
        style={{ '--at': at(tick) } as Record<string, number>}
        onPointerDown={(e) => {
          if (!ready) return;
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          seekFrom(e);
        }}
        onPointerMove={(e) => {
          if (ready && (e.buttons & 1) === 1) seekFrom(e);
        }}
      >
        <span class="ascrub__track">
          {/* Live: the revealed part (to the head); a replay fills to the playhead. */}
          <span class="ascrub__fill" style={{ '--at': at(live ? head : tick) } as Record<string, number>} />
        </span>
        <span data-testid="arena-marks" style={{ display: 'contents' }}>
          {groups.map((g) => (
            <i
              key={g.key}
              class={`amark${!live && g.items.every((m) => m.tick > tick) ? ' is-future' : ''}`}
              data-side={g.lane}
              data-kind={g.lead.kind}
              data-tick={g.tick}
              data-count={g.items.length > 1 ? g.items.length : undefined}
              style={{ '--at': at(g.tick) } as Record<string, number>}
              {...tipAttrs(markTip(g))}
            />
          ))}
        </span>
        <span class="ascrub__thumb" />
      </div>
      <div class="atransport__right">
        <span class="ascrub__end" data-testid="arena-time">
          {live ? clock(head * TICK_S) : clock(tick * TICK_S)}
          {!live && <small> / {clock(span * TICK_S)}</small>}
        </span>
        <button class="btn btn--sm btn--ghost btn--icon" type="button" onClick={() => session.step(-2)} disabled={!ready || sn.playing} aria-label={t('frameBack')} data-testid="arena-frame-back" {...tipAttrs(t('frameBackTip'))}>
          <Icon name="step-back" />
        </button>
        <button class="btn btn--sm btn--ghost btn--icon" type="button" onClick={() => session.step(2)} disabled={!ready || sn.playing} aria-label={t('frameForward')} data-testid="arena-frame-forward" {...tipAttrs(t(live ? 'frameFwdLiveTip' : 'frameFwdTip'))}>
          <Icon name="step-fwd" />
        </button>
        {live && (
          <button class="btn btn--sm" type="button" onClick={() => session.live()} disabled={!ready || !behind} data-testid="arena-live" {...tipAttrs(t('goLiveTip'))}>
            <Icon name="eye" size="sm" />
            {t('goLive')} <kbd>End</kbd>
          </button>
        )}
        {/* Below 1600 px the designer's CSS collapses these three to their icon (.btn--collapse hides the label and the key hint),
            so each carries its full name for the screen reader. */}
        {live && (
          <button class="btn btn--sm btn--ghost btn--collapse" type="button" onClick={onSkip} disabled={!ready || busy} aria-label={t('skipRound')} aria-keyshortcuts="Shift+S" data-testid="arena-skip" {...tipAttrs(`${t('skipRoundTip')} (Shift S)`)}>
            <Icon name="skip-end" />
            <span class="btn__label">{t('skipRound')}</span> <kbd>Shift S</kbd>
          </button>
        )}
        {onSimulateRest && (
          <button class="btn btn--sm btn--ghost btn--collapse" type="button" onClick={onSimulateRest} disabled={!ready || busy} aria-label={t('simulateRest')} aria-keyshortcuts="Shift+Space" data-testid="arena-simulate-rest" {...tipAttrs(`${t('simulateRestTip')} (Shift Space)`)}>
            <Icon name="bolt" />
            <span class="btn__label">{t('simulateRest')}</span> <kbd>Shift Space</kbd>
          </button>
        )}
        <button class="btn btn--sm btn--ghost btn--collapse" type="button" aria-pressed={dockOpen ? 'true' : 'false'} aria-label={t('dock')} aria-keyshortcuts="D" onClick={onToggleDock} data-testid="arena-dock-toggle" {...tipAttrs(`${t('dockTip')} (D)`)}>
          <Icon name="dock" />
          <span class="btn__label">{t('dock')}</span> <kbd>D</kbd>
        </button>
        {over && <span class="u-sr-only">{t('statusOver')}</span>}
      </div>
    </div>
  );
}

/** A mark's tooltip: one moment, or how many a merged mark stands for with the first few. */
function markTip(g: MarkGroup): string {
  if (g.items.length === 1) return `${g.lead.time} · ${g.lead.text}`;
  const first = g.items.slice(0, 3).map((m) => m.text).join(' · ');
  return t('markMerged', { n: g.items.length, time: g.items[0]!.time, list: first + (g.items.length > 3 ? ' …' : '') });
}
