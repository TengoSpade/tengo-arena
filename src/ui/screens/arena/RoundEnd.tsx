/**
 * The round-end overlay (05-technical-m2 §A7, ux-001): NON-BLOCKING, 1.5 s, skipped by any key, after which the next
 * screen opens by itself (the between-round screen per pauseBetweenRounds, the next round, or the report). So a round
 * boundary still costs exactly one input, the Enter on the between-round screen (A17 item 15).
 *
 * It lives in a module-level signal read by the arena route, not in the live round's component: committing the round
 * changes the state under that component (a new watch round remounts it), and the overlay must outlive that.
 */
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { Callout } from '../../components';
import { t } from './text';

export type RoundEndPhase = 'saving' | 'result' | 'failed' | 'mismatch';

export interface RoundEndState {
  phase: RoundEndPhase;
  round: number;
  /** The committed outcome (known once the round is committed). */
  result: { winner: string; ours: boolean | null; score: string; time: string } | null;
  /** Open what comes next; set with the result. */
  next: (() => void) | null;
  /** Try the commit again (a failed save). */
  retry: (() => void) | null;
  message?: string;
}

export const roundEnd = signal<RoundEndState | null>(null);

/** How long the overlay shows (TUNABLE (ui)). */
export const ROUND_END_MS = 1500;

export function resetRoundEnd(): void {
  roundEnd.value = null;
}

/** Close the overlay and open what comes next. Safe to call twice. */
export function proceedFromRoundEnd(): void {
  const cur = roundEnd.value;
  if (!cur || cur.phase !== 'result') return;
  roundEnd.value = null;
  cur.next?.();
}

export function RoundEndOverlay() {
  const s = roundEnd.value;
  const phase = s?.phase ?? null;
  const key = s ? `${s.round}:${s.phase}` : '';
  const done = useRef(false);

  // The result shows for 1.5 s; any key (or a click) skips it, and the key is not passed on to the next screen.
  useEffect(() => {
    if (phase !== 'result') return undefined;
    done.current = false;
    const go = () => {
      if (done.current) return;
      done.current = true;
      proceedFromRoundEnd();
    };
    const timer = setTimeout(go, ROUND_END_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F8') return;
      e.preventDefault();
      e.stopPropagation();
      go();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', go, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', go, true);
    };
  }, [key]);

  if (!s) return null;
  return (
    <div class="arena-end" role="status" aria-live="polite" aria-busy={s.phase === 'saving' ? 'true' : undefined} data-testid="arena-overlay" data-phase={s.phase}>
      <div class="arena-end__card">
        <h2 class="arena-end__title">{t('endTitle', { n: s.round })}</h2>
        {s.phase === 'saving' && <p class="u-muted">{t('endSaving')}</p>}
        {s.phase === 'result' && s.result && (
          <>
            <p class={`arena-end__winner${s.result.ours === true ? ' is-ours' : ''}`} data-testid="round-end-winner">
              {t('endWon', { club: s.result.winner, n: s.round })}
            </p>
            <p class="u-num" data-testid="round-end-score">
              {t('endScore', { a: s.result.score.split('–')[0] ?? '', b: s.result.score.split('–')[1] ?? '' })} · {s.result.time}
            </p>
            <p class="u-xs u-faint">{t('endSkip')}</p>
          </>
        )}
        {s.phase === 'failed' && (
          <Callout kind="bad" title={t('endFailed')}>
            {t('endFailedText')}
            {s.retry && (
              <p>
                <button class="btn btn--primary" type="button" onClick={s.retry} data-testid="round-end-retry" data-autofocus>
                  {t('retry')}
                </button>
              </p>
            )}
          </Callout>
        )}
        {s.phase === 'mismatch' && (
          <Callout kind="bad" title={t('endMismatch')}>
            {t('endMismatchText')}
          </Callout>
        )}
      </div>
    </div>
  );
}
