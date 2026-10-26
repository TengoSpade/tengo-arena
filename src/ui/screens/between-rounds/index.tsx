/**
 * Between-round screen (M1.1 WP-D; combat-skills.md sys-match "Decision point"): after each
 * non-deciding round of the player's match. The round result and score; the active five with
 * Freshness before → now, damage taken, downs, injuries and XP so far; the reserves with Freshness,
 * rating, class and role cover; swaps left and the withdrawn ("cannot return"); the auto-swap
 * suggestions pre-filled; Swap and Continue.
 *
 * Quick by design: a routine round is one click (or Enter). Keys: 1–5 cycle a swap for that slot,
 * A restores the suggestions, N clears them, Enter / Space plays on. Swaps ask once before playing
 * ("a fighter swapped out cannot return").
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { BetweenRoundSideView } from '../../../core/game';
import type { FighterId, StartingRow, SwapDecision } from '../../../core/model';
import { afterMatch } from '../../app/after-match';
import type { ScreenProps } from '../../app/routes';
import { navigate } from '../../app/router';
import { useShortcuts } from '../../app/shortcuts';
import { Callout, ConfirmButton, Empty, Icon, Kbd, PageHeader, Panel, Pips, RoleGlyph, Segmented, Tag, tipAttrs } from '../../components';
import { freshInfo } from '../../m11/model';
import { FreshMeter } from '../../m11/parts';
import { MATCH_PAUSED, useStore, type AppStore } from '../../store';
import { useEngine } from '../../store/engine';
import { useMatchDay } from '../../store/match-day';
import { Crest, clubName } from '../league/lib/club';
import { fmtInt, fmtTicks } from '../league/lib/format';
import { ClassTag, Portrait, RatingPill } from '../league/lib/ui';
import { cycleSwap, matchXpSoFar, reserveCoverage, sameDecisions, setSwap } from './model';
import { t } from './text';
import './between-rounds.css';

export default function BetweenRoundsScreen(_props: ScreenProps) {
  const store = useStore() as AppStore;
  const engine = useEngine();
  const md = useMatchDay(store);
  const state = store.game.value;
  const content = store.content.value;
  const view = state ? md.betweenRoundView(state) : null;
  const ms = state?.liveMatch ?? null;
  const sideKey = view?.playerSide ?? null;
  const mine: BetweenRoundSideView | null = view && sideKey ? view[sideKey] : null;
  const theirs: BetweenRoundSideView | null = view && sideKey ? view[sideKey === 'home' ? 'away' : 'home'] : null;
  const stepKey = view ? `${view.fixtureId}:${view.afterRound}` : '';

  const [plan, setPlan] = useState<SwapDecision[]>(() => [...(mine?.suggestions ?? [])]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A new step (the next round played): start again from its suggestions.
  useEffect(() => {
    setPlan([...(mine?.suggestions ?? [])]);
    setError(null);
  }, [stepKey]);

  const xp = useMemo(() => {
    if (!content || !ms || !sideKey) return {};
    const tournament = !ms.fixtureId.startsWith('lg:');
    return matchXpSoFar(content, ms, sideKey, tournament);
  }, [content, ms, sideKey]);

  const playOn = async () => {
    if (!state || !mine || busy) return;
    setBusy(true);
    setError(null);
    try {
      // No command = accept the suggestions; anything else is recorded as the player's decisions.
      if (!sameDecisions(plan, mine.suggestions)) {
        const r = md.swapBetweenRounds(state, plan);
        if (!r.ok) {
          setError(r.error.message);
          return;
        }
      }
      const res = await store.advance();
      if (res.ok) afterMatch(store.game.value, res.value);
      else if (res.error.code !== MATCH_PAUSED) setError(res.error.message);
    } finally {
      setBusy(false);
    }
  };

  useShortcuts({
    Enter: () => {
      if (!mine) return false;
      if (plan.length > 0) document.querySelector<HTMLButtonElement>('[data-testid="br-continue"]')?.click();
      else void playOn();
      return true;
    },
    Space: () => {
      if (!mine) return false;
      if (plan.length > 0) document.querySelector<HTMLButtonElement>('[data-testid="br-continue"]')?.click();
      else void playOn();
      return true;
    },
    a: () => (mine ? setPlan([...mine.suggestions]) : false),
    n: () => (mine ? setPlan([]) : false),
    ...Object.fromEntries(
      [1, 2, 3, 4, 5].map((n) => [
        String(n),
        () => {
          const a = mine?.active[n - 1];
          if (!mine || !a || a.injured) return false;
          setPlan((p) => cycleSwap(mine, p, a.fighterId));
          return true;
        },
      ]),
    ),
  });

  if (!state || !content || !view || !mine || !theirs || !ms || !sideKey) {
    return (
      <section class="page" data-testid="screen-between-rounds">
        <Empty icon="swords" title={t('noMatch')} text={t('noMatchText')} actions={<a class="btn" href="#/home">{t('home')}</a>} />
      </section>
    );
  }

  const myClub = state.clubs[mine.clubId];
  const otherClub = state.clubs[theirs.clubId];
  const lastRound = ms.rounds[ms.rounds.length - 1];
  const wonLast = lastRound?.winner === sideKey;
  const myScore = view.score[sideKey];
  const theirScore = view.score[sideKey === 'home' ? 'away' : 'home'];
  const rules = myClub?.autoSwap;
  const coverage = reserveCoverage(state, content, mine);
  const roleName = (id: string) => content.vocabulary.roles.find((r) => r.id === id)?.name ?? id;
  const nameOf = (id: FighterId) => state.fighters[id]?.name.full ?? id;
  const swapsAfter = mine.swapsLeft - plan.length;

  const continueLabel = (
    <>
      <Icon name="play" />
      {t('continue', { n: view.nextRound })} <kbd>Enter</kbd>
    </>
  );

  return (
    <section class="page br" data-testid="screen-between-rounds">
      <PageHeader
        eyebrow={`${t('eyebrow')} · ${t('bestOf', { n: ms.bestOf })}`}
        title={t('title', { round: view.nextRound })}
        meta={[
          <span class="br-score" data-testid="br-score">
            {t('score', { score: `${myScore}–${theirScore}`, club: otherClub?.name ?? '' })}
          </span>,
          <span {...tipAttrs(t('withdrawnTip'))}>
            <Pips value={mine.swapsLeft} max={2} label={t('swapsLeft', { n: mine.swapsLeft })} /> {t('swapsLeft', { n: mine.swapsLeft })}
          </span>,
        ]}
        actions={
          plan.length > 0 ? (
            <ConfirmButton
              variant="primary"
              size="lg"
              testId="br-continue"
              title={t('confirmTitle', { n: plan.length, round: view.nextRound })}
              description={t('confirmText')}
              consequences={plan.map((d) => ({ label: t('outIn', { out: nameOf(d.out), in: nameOf(d.in) }), value: t('cannotReturn') }))}
              confirmLabel={t('confirmOk')}
              onConfirm={playOn}
              disabled={busy}
            >
              {continueLabel}
            </ConfirmButton>
          ) : (
            <button class="btn btn--primary btn--lg" type="button" onClick={() => void playOn()} aria-disabled={busy ? 'true' : undefined} data-testid="br-continue" {...tipAttrs(t('continueTip'))}>
              {continueLabel}
            </button>
          )
        }
      />

      <div class={`br-result${wonLast ? ' is-won' : ' is-lost'}`} data-testid="br-result">
        <Crest club={myClub} size="sm" />
        <span class="br-result__text">
          <strong>{wonLast ? t('roundWon', { n: view.afterRound }) : t('roundLost', { n: view.afterRound })}</strong>
          {lastRound && <span class="u-muted"> · {t('roundDetail', { time: fmtTicks(lastRound.durationTicks), standing: lastRound.survivors[sideKey] })}</span>}
        </span>
        <span class="br-result__score u-num">
          {myScore}–{theirScore}
        </span>
        <Crest club={otherClub} size="sm" />
      </div>

      {error && (
        <div class="br-error">
          <Callout kind="bad" title={error} />
        </div>
      )}

      <div class="l-grid">
        <div class="span-8 l-stack">
          <Panel title={t('yourFive')} icon="squad" subtitle={t('yourFiveSub')} body="flush" testId="br-five">
            <table class="data-table br-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{t('colFighter')}</th>
                  <th scope="col">{t('colFresh')}</th>
                  <th scope="col" class="cell-num">{t('colChange')}</th>
                  <th scope="col" class="cell-num">{t('colDamage')}</th>
                  <th scope="col" class="cell-num" {...tipAttrs(t('colXpTip'))}>
                    {t('colXp')}
                  </th>
                  <th scope="col">{t('colSwap')}</th>
                </tr>
              </thead>
              <tbody>
                {mine.active.map((a, i) => {
                  const f = state.fighters[a.fighterId];
                  if (!f) return null;
                  const info = freshInfo(engine, state, content, f);
                  const change = a.freshness - a.freshnessBefore;
                  const swap = plan.find((d) => d.out === a.fighterId);
                  const suggested = mine.suggestions.some((d) => d.out === a.fighterId && d.in === swap?.in);
                  const options = mine.reserves.filter((r) => r.fit && (r.fighterId === swap?.in || !plan.some((d) => d.in === r.fighterId)));
                  const gained = xp[a.fighterId] ?? 0;
                  const levelDue = f.xpIntoLevel + gained >= f.xpNeeded;
                  const full = !swap && plan.length >= mine.swapsLeft;
                  return (
                    <tr key={a.fighterId} class={swap ? 'is-out' : undefined} data-testid={`br-row-${a.fighterId}`}>
                      <td class="u-num u-faint">
                        <Kbd>{i + 1}</Kbd>
                      </td>
                      <td>
                        <span class="entity">
                          <Portrait content={content} fighter={f} size="xs" injured={a.injured} />
                          <span class="entity__stack">
                            <span class="entity__name">{f.name.full}</span>
                            <span class="entity__sub">
                              <ClassTag content={content} classId={f.classId} /> · {a.row === 'front' ? t('front') : t('back')}
                            </span>
                          </span>
                          {a.injured && (
                            <Tag kind="bad" icon="injury" tip={t('injuredTip')}>
                              {t('injured')}
                            </Tag>
                          )}
                          {a.downed && !a.injured && <Tag kind="outline">{t('downed')}</Tag>}
                          {levelDue && (
                            <Tag kind="accent" icon="level-up" tip={t('levelDueTip')}>
                              {t('levelDue')}
                            </Tag>
                          )}
                        </span>
                      </td>
                      <td>
                        <FreshMeter info={info} content={content} label testId={`br-fresh-${a.fighterId}`} />
                      </td>
                      <td class="cell-num u-num" {...tipAttrs(`${a.freshnessBefore} → ${a.freshness}`)}>
                        {change === 0 ? '0' : `${change > 0 ? '+' : '−'}${Math.abs(change)}`}
                      </td>
                      <td class="cell-num u-num">{fmtInt(Math.round(a.damageTaken))}</td>
                      <td class="cell-num u-num">{gained > 0 ? `≈${gained}` : '—'}</td>
                      <td>
                        <span class="br-swap">
                          <select
                            class="select br-swap__select"
                            aria-label={`${t('colSwap')} ${f.name.full}`}
                            value={swap?.in ?? ''}
                            disabled={options.length === 0 || (full && !a.injured)}
                            onChange={(e) => {
                              const v = (e.target as HTMLSelectElement).value;
                              setPlan((p) => setSwap(mine, p, a.fighterId, v ? (v as FighterId) : null, swap?.row));
                            }}
                            data-testid={`br-swap-${a.fighterId}`}
                          >
                            <option value="">{a.injured ? t('autoReplace') : t('keep')}</option>
                            {options.map((r) => (
                              <option key={r.fighterId} value={r.fighterId}>
                                {nameOf(r.fighterId)} · {r.freshness} · {r.rating}
                              </option>
                            ))}
                          </select>
                          {swap && (
                            <Segmented<StartingRow>
                              label={t('rowFor', { name: nameOf(swap.in) })}
                              value={swap.row ?? a.row}
                              onChange={(row) => setPlan((p) => setSwap(mine, p, a.fighterId, swap.in, row))}
                              options={[
                                { id: 'front', label: t('front') },
                                { id: 'back', label: t('back') },
                              ]}
                            />
                          )}
                          {swap && suggested && (
                            <Tag kind="info" tip={t('suggestedTip')}>
                              {t('suggested')}
                            </Tag>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p class="br-keys u-xs u-faint">{t('keys')}</p>
          </Panel>
        </div>

        <div class="span-4 l-stack">
          <Panel title={t('reserves')} icon="refresh" subtitle={t('reservesSub')} testId="br-reserves">
            <div class="l-stack l-stack--sm">
              {mine.reserves.length === 0 && <p class="u-sm u-muted">{t('noReserves')}</p>}
              {mine.reserves.map((r) => {
                const f = state.fighters[r.fighterId];
                if (!f) return null;
                const entering = plan.find((d) => d.in === r.fighterId);
                return (
                  <div key={r.fighterId} class={`br-reserve${entering ? ' is-in' : ''}`} data-testid={`br-reserve-${r.fighterId}`}>
                    <span class="entity">
                      <Portrait content={content} fighter={f} size="xs" />
                      <span class="entity__stack">
                        <span class="entity__name">{f.name.full}</span>
                        <span class="entity__sub">
                          <ClassTag content={content} classId={f.classId} />
                        </span>
                      </span>
                    </span>
                    <span class="br-reserve__stats">
                      <RatingPill value={r.rating} />
                      <FreshMeter info={freshInfo(engine, state, content, f)} content={content} />
                    </span>
                    {entering && <span class="u-xs br-reserve__for">→ {nameOf(entering.out)}</span>}
                  </div>
                );
              })}
              <div class="br-cover u-xs" data-testid="br-cover">
                {coverage.covered.length > 0 ? (
                  <span class="l-cluster l-cluster--xs">
                    {coverage.covered.map((role) => (
                      <RoleGlyph key={role} role={role} label={roleName(role)} tip={roleName(role)} />
                    ))}
                    <span class="u-muted">{t('cover', { roles: coverage.covered.map(roleName).join(', ') })}</span>
                  </span>
                ) : (
                  <span class="u-muted">{t('coverNone')}</span>
                )}
                {coverage.uncovered.length > 0 && <span class="u-warn"> · {t('uncovered', { roles: coverage.uncovered.map(roleName).join(', ') })}</span>}
              </div>
              {mine.withdrawn.length > 0 && (
                <div class="u-xs u-muted" {...tipAttrs(t('withdrawnTip'))}>
                  {t('withdrawn')}: {mine.withdrawn.map(nameOf).join(', ')}
                </div>
              )}
              <div class="u-xs u-faint">
                {swapsAfter !== mine.swapsLeft ? `${t('swapsLeft', { n: swapsAfter })} after this step` : t('swapsLeft', { n: mine.swapsLeft })}
              </div>
            </div>
          </Panel>

          <Panel title={t('rules')} icon="settings" testId="br-rules" actions={<a class="btn btn--sm btn--ghost" href="#/settings">{t('rulesEdit')}</a>}>
            <p class="u-sm">
              {!rules || rules.mode === 'off'
                ? t('rulesOff')
                : rules.mode === 'injured_only'
                  ? t('rulesInjured')
                  : t('rulesThreshold', { below: rules.freshnessBelow, bonus: rules.lostRoundBonus, margin: rules.reserveMargin, gap: rules.maxRatingGap })}
              {rules && rules.mode === 'threshold' && rules.keepOneForInjury ? ` ${t('rulesKeep')}` : ''}
            </p>
          </Panel>

          <Panel title={t('them', { club: clubName(state, theirs.clubId) })} icon="swords" subtitle={t('themSub')} testId="br-them">
            <ul class="br-them" role="list">
              {theirs.active.map((a) => {
                const f = state.fighters[a.fighterId];
                return f ? (
                  <li key={a.fighterId}>
                    <span class="u-sm">{f.name.full}</span>
                    <FreshMeter info={freshInfo(engine, state, content, f)} content={content} />
                  </li>
                ) : null;
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </section>
  );
}

/** Opened by Continue when the player's match pauses; also reachable from the top bar while it waits. */
export function openBetweenRounds(): void {
  navigate('#/between-rounds');
}
