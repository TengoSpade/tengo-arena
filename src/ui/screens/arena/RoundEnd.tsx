/**
 * The round-end card (mockups/arena.html `.around`; 05-technical-m2 §A7, §A18, ux-001): NON-BLOCKING, 1.5 s, any key
 * (Enter included) skips it and that key is consumed, after which the next stop opens by itself: the between-round
 * screen per pauseBetweenRounds, the next round's kickoff, or after the deciding round the match result and then the
 * report per pacing. So a round boundary still costs exactly one input, the Enter on the between-round screen (A17 item
 * 15). It sits over the north strip of the floor, so a fighter still standing in the middle stays visible.
 *
 * The state lives in a module-level signal read here: committing the round changes the state under the live round's
 * component, and the card has to survive that.
 */
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { navigate } from '../../app/router';
import { Callout } from '../../components';
import { t } from './text';

export type RoundEndPhase = 'saving' | 'result' | 'failed' | 'mismatch';

export interface RoundEndResult {
  /** The side that won the round (club name), and whether it is the player's. */
  winner: string;
  ours: boolean | null;
  /** The match score, the player's side first; the winner's of the round is marked. */
  score: [number, number];
  winnerFirst: boolean;
  time: string;
  overtime: boolean;
  /** 'elimination' | 'time-limit' and how many of the winner's side stood. */
  reason: 'elimination' | 'time-limit';
  standing: number;
  /** The down that ended an elimination round ("Kael downed by Cato"), read from the viewer's moments at the end tick; else null. */
  decidingDown: string | null;
  /** "ours" or "theirs" (or the club's short name in a match between other clubs). */
  who: string;
  /** The deciding round: the match is over. */
  matchOver: boolean;
  /** What opens after the card, in words (the card's foot). */
  next: 'between' | 'kickoff' | 'report' | 'home';
  nextRound: number;
}

export interface RoundEndState {
  phase: RoundEndPhase;
  round: number;
  bestOf: number;
  result: RoundEndResult | null;
  /** Open what comes next; set with the result. */
  next: (() => void) | null;
  /** Try the commit again (a failed save). */
  retry: (() => void) | null;
  message?: string;
}

export const roundEnd = signal<RoundEndState | null>(null);

/** How long the card shows (TUNABLE (ui)). */
export const ROUND_END_MS = 1500;

export function resetRoundEnd(): void {
  roundEnd.value = null;
}

/** Close the card and open what comes next. Safe to call twice. */
export function proceedFromRoundEnd(): void {
  const cur = roundEnd.value;
  if (!cur || cur.phase !== 'result') return;
  roundEnd.value = null;
  cur.next?.();
}

/** Leave the arena from a failure card: the match stays live (Continue reads Resume watching). */
function leave(): void {
  roundEnd.value = null;
  navigate('#/home');
}

export function RoundEndOverlay() {
  const s = roundEnd.value;
  const phase = s?.phase ?? null;
  const key = s ? `${s.round}:${s.phase}` : '';
  const done = useRef(false);

  // The card shows for 1.5 s; any key (or a click) skips it, and the key is not passed on to the next screen.
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
      if (e.key === 'F8') return; // the ticket tool stays available
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
  const r = s.result;
  return (
    <div class="around" role="status" aria-live="polite" aria-busy={s.phase === 'saving' ? 'true' : undefined} data-testid="arena-overlay" data-phase={s.phase}>
      <div class="around__card">
        {s.phase === 'saving' && (
          <>
            <span class="around__kicker">{t('endTitle', { n: s.round })}</span>
            <span class="around__sub">{t(s.message === 'simulating' ? 'endSimulating' : 'endSaving')}</span>
          </>
        )}
        {s.phase === 'result' && r && (
          <>
            <span class="around__kicker" data-testid="round-end-kicker">
              {t(r.overtime ? 'endKickerOt' : 'endKicker', { n: s.round, max: s.bestOf, time: r.time })}
            </span>
            <span class="around__title" data-testid="round-end-winner">
              {t(r.matchOver ? 'endWinMatch' : 'endWinRound', { club: r.winner })}
            </span>
            <span class="around__score" aria-label={t('endScoreLabel', { a: r.score[0], b: r.score[1] })} data-testid="round-end-score">
              <span class={r.winnerFirst ? 'is-win' : undefined}>{r.score[0]}</span>
              <span class="u-faint">–</span>
              <span class={r.winnerFirst ? undefined : 'is-win'}>{r.score[1]}</span>
            </span>
            {r.decidingDown && (
              <span class="around__sub" data-testid="round-end-down">
                {t('endDecidingDown', { down: r.decidingDown })}
              </span>
            )}
            <span class="around__sub">
              {t(r.reason === 'elimination' ? 'endSubElim' : 'endSubCap', { n: r.standing, who: r.who })} {r.matchOver ? t('endDecided') : t('endNextRound', { n: r.nextRound })}
            </span>
            <span class="around__foot">
              <span>{t('endFootAny')}</span>
              <span>
                {r.next === 'between' && <>{t('endFootBetween', { n: r.nextRound })}</>}
                {r.next === 'kickoff' && t('endFootKickoff', { n: r.nextRound })}
                {r.next === 'report' && t('endFootReport')}
                {r.next === 'home' && t('endFootHome')}
              </span>
            </span>
            <span class="around__timer" aria-hidden="true" />
          </>
        )}
        {s.phase === 'failed' && (
          <Callout kind="bad" title={t('endFailed')}>
            {t('endFailedText')}
            {s.retry && (
              <p>
                <button class="btn btn--primary" type="button" onClick={s.retry} data-testid="round-end-retry" data-autofocus>
                  {t('retry')}
                </button>{' '}
                <button class="btn" type="button" onClick={leave} data-testid="round-end-leave">
                  {t('endLeave')}
                </button>
              </p>
            )}
          </Callout>
        )}
        {s.phase === 'mismatch' && (
          <Callout kind="bad" title={t('endMismatch')}>
            {t('endMismatchText')}
            <p>
              <button class="btn" type="button" onClick={leave} data-testid="round-end-leave">
                {t('endLeave')}
              </button>
            </p>
          </Callout>
        )}
      </div>
    </div>
  );
}
