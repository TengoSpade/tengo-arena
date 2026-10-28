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
import { useMounted } from '../../app/mounted';
import type { ScreenProps } from '../../app/routes';
import { navigate } from '../../app/router';
import { useShortcuts } from '../../app/shortcuts';
import { Callout, ConfirmButton, Empty, Icon, Kbd, PageHeader, Panel, Pips, RoleGlyph, Segmented, Tag, tipAttrs } from '../../components';
import { freshInfo, ratingNow } from '../../m11/model';
import { FreshMeter, RatingEff } from '../../m11/parts';
import { MATCH_PAUSED, MATCH_WATCHING, SAVE_ROUND_FAILED, useStore, type AppStore } from '../../store';
import { useArena } from '../../store/arena';
import { errorText } from '../../store/messages';
import { useEngine } from '../../store/engine';
import { useMatchDay } from '../../store/match-day';
import { Crest, clubName } from '../league/lib/club';
import { fmtInt, fmtTicks } from '../league/lib/format';
import { ClassTag, Portrait } from '../league/lib/ui';
import { cycleSwap, matchLineSoFar, matchXpSoFar, reserveCoverage, sameDecisions, setSwap } from './model';
import { t } from './text';
import './between-rounds.css';

export default function BetweenRoundsScreen(_props: ScreenProps) {
  const store = useStore() as AppStore;
  const engine = useEngine();
  const md = useMatchDay(store);
  const arena = useArena(store);
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

  const mounted = useMounted();
  const playOn = async () => {
    if (!state || !mine || busy) return;
    setBusy(true);
    setError(null);
    try {
      // The plan is always sent (match.swap): core resumes a paused step only with the player's
      // decisions recorded (WP-C), and [] or the suggestions are decisions too.
      const r = md.swapBetweenRounds(state, plan);
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      const res = await store.advance();
      // Gone while the round was played (Back, another screen): the state has moved on; Continue reads where the match stands.
      if (!mounted.current) return;
      if (res.ok) afterMatch(store.game.value, res.value);
      // M2: a watched match opens the next round in the arena (after its lock was saved); a lock that could not be
      // saved stays here, with Continue as the retry.
      else if (res.error.code === MATCH_WATCHING) navigate('#/arena');
      else if (res.error.code === SAVE_ROUND_FAILED) setError(errorText(res.error));
      else if (res.error.code !== MATCH_PAUSED) setError(res.error.message);
    } finally {
      setBusy(false);
    }
  };

  // Your own swaps are confirmed once (cannot return); the rules' suggestions as they stand play on
  // in one click, the same as an unpaused round (WP-C: pausing and accepting = not pausing).
  const ownSwaps = plan.length > 0 && !sameDecisions(plan, mine?.suggestions ?? []);
  const go = () => {
    if (!mine) return false;
    if (ownSwaps) document.querySelector<HTMLButtonElement>('[data-testid="br-continue"]')?.click();
    else void playOn();
    return true;
  };
  useShortcuts({
    Enter: go,
    Space: go,
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
  // M2: the rounds already played replay in the arena (the match view lists them; null while core's view is a stub).
  const replayable = (() => {
    const mp = arena.matchPlayback(state, ms.fixtureId);
    return !!mp && mp.ok && mp.value.rounds.some((r) => r.round === view.afterRound && r.winner !== null);
  })();

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
          ...(plan.length > 0 && !ownSwaps
            ? [
                <span class="u-warn" data-testid="br-suggested" {...tipAttrs(t('suggestedTip'))}>
                  {t('suggestedNote', { n: plan.length })}
                </span>,
              ]
            : []),
        ]}
        actions={
          ownSwaps ? (
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
            <button class="btn btn--primary btn--lg" type="button" onClick={() => void playOn()} aria-disabled={busy ? 'true' : undefined} data-testid="br-continue" {...tipAttrs(plan.length > 0 ? t('continueAutoTip', { n: plan.length, round: view.nextRound }) : t('continueTip'))}>
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
        {replayable && (
          <a class="btn btn--sm btn--ghost" href={`#/replay/${encodeURIComponent(ms.fixtureId)}?round=${view.afterRound}`} data-testid="br-replay">
            <Icon name="play" />
            {t('replayRound', { n: view.afterRound })}
          </a>
        )}
      </div>

      {error && (
        <div class="br-error">
          <Callout kind="bad" title={error} />
        </div>
      )}

      <div class="l-grid">
        <div class="br-main l-stack">
          <Panel title={t('yourFive')} icon="squad" subtitle={t('yourFiveSub')} body="flush" testId="br-five">
            <div class="table-wrap">
            <table class="data-table data-table--compact data-table--dense br-table" data-testid="br-table">
              <thead>
                <tr>
                  <th scope="col" rowSpan={2}>
                    #
                  </th>
                  <th scope="col" rowSpan={2}>
                    {t('colFighter')}
                  </th>
                  <th scope="col" rowSpan={2} {...tipAttrs(t('colRatingTip'))}>
                    {t('colRating')}
                  </th>
                  <th scope="col" rowSpan={2}>
                    {t('colFresh')}
                  </th>
                  <th scope="colgroup" colSpan={2} class="cell-num br-group" {...tipAttrs(t('colDamageTip'))}>
                    {t('groupDamage')}
                  </th>
                  <th scope="colgroup" colSpan={2} class="cell-num br-group" {...tipAttrs(t('colHealingTip'))}>
                    {t('groupHealing')}
                  </th>
                  <th scope="col" rowSpan={2} class="cell-num" {...tipAttrs(t('colDownsTip'))}>
                    {t('colDowns')}
                  </th>
                  <th scope="col" rowSpan={2} class="cell-num" {...tipAttrs(t('colRoundsTip'))}>
                    {t('colRounds')}
                  </th>
                  <th scope="col" rowSpan={2} class="cell-num" {...tipAttrs(t('colXpTip'))}>
                    {t('colXp')}
                  </th>
                  <th scope="col" rowSpan={2}>
                    {t('colSwap')}
                  </th>
                </tr>
                <tr class="br-subhead">
                  <th scope="col" class="cell-num">
                    {t('subDone')}
                  </th>
                  <th scope="col" class="cell-num">
                    {t('subReceived')}
                  </th>
                  <th scope="col" class="cell-num">
                    {t('subDone')}
                  </th>
                  <th scope="col" class="cell-num">
                    {t('subReceived')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {mine.active.map((a, i) => {
                  const f = state.fighters[a.fighterId];
                  if (!f) return null;
                  const info = freshInfo(engine, state, content, f);
                  const line = matchLineSoFar(ms, a.fighterId);
                  const now = ratingNow(engine, state, content, f);
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
                            <span class="br-nameline">
                              <span class="entity__name">{f.name.full}</span>
                              {(a.injured || a.downed || levelDue) && (
                                <span class="br-tags">
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
                              )}
                            </span>
                            <span class="entity__sub">
                              <ClassTag content={content} classId={f.classId} /> · {a.row === 'front' ? t('front') : t('back')}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td class="br-rating" data-testid={`br-rating-${a.fighterId}`}>
                        {now ? <RatingEff now={now} content={content} testId={`br-eff-${a.fighterId}`} /> : '—'}
                      </td>
                      <td>
                        <span class="br-fresh">
                          <FreshMeter info={info} content={content} label={info.label === 'tired' || info.label === 'spent'} testId={`br-fresh-${a.fighterId}`} />
                          {change !== 0 && (
                            <span class="u-xs u-muted u-num" {...tipAttrs(t('changeTip', { from: a.freshnessBefore, to: a.freshness }))} data-testid={`br-change-${a.fighterId}`}>
                              {`${change > 0 ? '+' : '−'}${Math.abs(change)}`}
                            </span>
                          )}
                        </span>
                      </td>
                      <td class="cell-num u-num br-stat" data-testid={`br-dmg-${a.fighterId}`}>
                        {fmtInt(Math.round(line.damageDone))}
                      </td>
                      <td class="cell-num u-num br-stat" data-testid={`br-taken-${a.fighterId}`} {...tipAttrs(t('lastRoundTip', { n: fmtInt(Math.round(a.damageTaken)) }))}>
                        {fmtInt(Math.round(line.damageReceived))}
                      </td>
                      <td
                        class={`cell-num u-num br-stat${line.healingDone > 0 ? '' : ' cell-muted'}`}
                        data-testid={`br-heal-${a.fighterId}`}
                        {...tipAttrs(t('healTip', { healing: fmtInt(Math.round(line.healingDone)), shielding: fmtInt(Math.round(line.shieldingDone)) }))}
                      >
                        {fmtInt(Math.round(line.healingDone))}
                      </td>
                      <td class={`cell-num u-num br-stat${line.healingReceived ? '' : ' cell-muted'}`} data-testid={`br-healed-${a.fighterId}`}>
                        {line.healingReceived === null ? '—' : fmtInt(Math.round(line.healingReceived))}
                      </td>
                      <td class="cell-num u-num br-stat" data-testid={`br-downs-${a.fighterId}`} {...tipAttrs(t('downsTip', { inflicted: line.downs, suffered: line.downed }))}>
                        {line.downs}
                        {line.downed > 0 && <span class="u-faint"> / {line.downed}</span>}
                      </td>
                      <td class="cell-num u-num br-stat" data-testid={`br-rounds-${a.fighterId}`}>
                        {line.rounds}
                      </td>
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
            </div>
            <p class="br-keys u-xs u-faint">{t('keys')}</p>
          </Panel>
        </div>

        <div class="br-side">
          <Panel title={t('reserves')} icon="refresh" subtitle={t('reservesSub')} testId="br-reserves">
            <div class="l-stack l-stack--sm">
              {mine.reserves.length === 0 && <p class="u-sm u-muted">{t('noReserves')}</p>}
              {mine.reserves.map((r) => {
                const f = state.fighters[r.fighterId];
                if (!f) return null;
                const entering = plan.find((d) => d.in === r.fighterId);
                const rNow = ratingNow(engine, state, content, f);
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
                      {rNow ? <RatingEff now={rNow} content={content} testId={`br-reserve-eff-${r.fighterId}`} /> : <span class="u-faint">{r.rating}</span>}
                      <FreshMeter info={freshInfo(engine, state, content, f)} content={content} label />
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
