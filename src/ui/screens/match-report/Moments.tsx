/**
 * Key moments timeline (04 ui-report §5), the downs panel (03 death
 * summaries) and Injuries and XP (§6). Clicking a moment highlights the
 * fighter in the box score and the recaps.
 */
import { useState } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import type { FighterId, GameState, MatchReport } from '../../../core/model';
import { weekLong } from '../league/lib/calendar';
import { clubShort } from '../league/lib/club';
import { fmtInt, fmtMoney, fmtTicks } from '../league/lib/format';
import { href } from '../league/lib/store';
import { Callout, Delta } from '../league/lib/ui';
import { downSummaries, name, type FighterInfo, type Moment, type Perspective } from './analysis';
import { t } from './text';

export function Moments({
  state,
  content,
  report,
  all,
  persp,
  round,
  focusId,
  onFocus,
}: {
  state: GameState;
  content: ContentDB;
  report: MatchReport;
  all: Map<number, Moment[]>;
  persp: Perspective;
  round: number | null;
  focusId: FighterId | null;
  onFocus: (id: FighterId | null) => void;
}) {
  const tickMs = content.combat.tick.tickMs;
  const rounds = report.rounds.filter((r) => round === null || r.round === round);
  const count = rounds.reduce((n, r) => n + (all.get(r.round)?.filter((m) => !m.key.endsWith('-end')).length ?? 0), 0);
  return (
    <section class="panel" aria-labelledby="h-moments" data-testid="panel-moments">
      <header class="panel__header">
        <h2 class="panel__title" id="h-moments">
          <span class="icon" data-icon="clock" aria-hidden="true" />
          {t('moments.title')}
        </h2>
        <span class="panel__subtitle">{t('moments.subtitle', { n: count })}</span>
      </header>
      <div class="panel__body panel__body--tight report-moments">
        <ol class="timeline">
          {rounds.map((r) => {
            const usWon = r.winner === persp.usSide;
            const head = persp.involved
              ? t('moments.round', { n: r.round, outcome: usWon ? t('moments.won') : t('moments.lost'), time: fmtTicks(r.durationTicks, tickMs) })
              : t('moments.roundNeutral', { n: r.round, club: clubShort(state, report[r.winner].clubId), time: fmtTicks(r.durationTicks, tickMs) });
            const list = all.get(r.round) ?? [];
            return [
              <li class="timeline__round" key={`r${r.round}`}>
                {head}
              </li>,
              ...list.map((m) => (
                <li
                  key={m.key}
                  class={m.focusId && m.focusId === focusId ? 'timeline__item is-focus' : 'timeline__item'}
                  data-side={m.side ?? undefined}
                  data-event={m.event}
                  tabIndex={m.focusId ? 0 : undefined}
                  onClick={() => m.focusId && onFocus(focusId === m.focusId ? null : m.focusId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && m.focusId) onFocus(focusId === m.focusId ? null : m.focusId);
                  }}
                  data-testid="moment"
                >
                  <span class="timeline__time">{fmtTicks(m.tick, tickMs)}</span>
                  <span class="timeline__marker">
                    <span class="timeline__dot" />
                  </span>
                  <div>
                    <div class="timeline__title">{m.title}</div>
                    {m.text && <div class="timeline__text">{m.text}</div>}
                  </div>
                </li>
              )),
            ];
          })}
        </ol>
      </div>
      <footer class="panel__footer report-legend">
        <span class="legend__item">
          <span class="legend__swatch" style={{ '--swatch': 'var(--c-side-us)' }} />
          {persp.involved ? t('moments.legendUs') : clubShort(state, persp.usClubId)}
        </span>
        <span class="legend__item">
          <span class="legend__swatch" style={{ '--swatch': 'var(--c-side-them)' }} />
          {persp.involved ? t('moments.legendThem') : clubShort(state, persp.themClubId)}
        </span>
        <span class="legend__item">{t('moments.legendDown')}</span>
        <span class="legend__item">{t('moments.legendRule')}</span>
        <span class="legend__item">{t('moments.legendInjury')}</span>
      </footer>
    </section>
  );
}

export function Downs({
  state,
  content,
  infos,
  persp,
  round,
  focusId,
}: {
  state: GameState;
  content: ContentDB;
  infos: FighterInfo[];
  persp: Perspective;
  round: number | null;
  focusId: FighterId | null;
}) {
  const [showTheirs, setShowTheirs] = useState(!persp.involved);
  const tickMs = content.combat.tick.tickMs;
  const all = downSummaries(infos, content).filter((d) => round === null || d.round === round);
  const shown = all.filter((d) => showTheirs || d.side === persp.usSide);
  return (
    <section class="panel" aria-labelledby="h-downs" data-testid="panel-downs">
      <header class="panel__header">
        <h2 class="panel__title" id="h-downs">
          <span class="icon" data-icon="ko" aria-hidden="true" />
          {t('downs.title')}
        </h2>
        <span class="panel__subtitle">{t('downs.subtitle')}</span>
        {persp.involved && (
          <div class="panel__actions">
            <label class="l-row u-xs">
              <input class="switch" type="checkbox" role="switch" checked={showTheirs} onChange={(e) => setShowTheirs((e.target as HTMLInputElement).checked)} />
              <span>{t('downs.showTheirs')}</span>
            </label>
          </div>
        )}
      </header>
      <div class="panel__body panel__body--tight">
        {shown.length === 0 ? (
          <p class="u-sm u-muted">{persp.involved ? t('downs.none') : t('downs.noneNeutral')}</p>
        ) : (
          <ul class="report-downs" role="list">
            {shown.map((d) => (
              <li key={d.key} class={['report-down', d.side === persp.usSide ? '' : 'is-them', focusId === d.fighterId ? 'is-focus' : ''].filter(Boolean).join(' ')} data-testid="down-summary">
                <div class="report-down__head">
                  <span class="u-xs u-faint u-num">{t('downs.line', { round: d.round, time: fmtTicks(d.tick, tickMs) })}</span>
                  <a class="report-down__name" href={href(`fighter/${encodeURIComponent(d.fighterId)}`)}>
                    {name(state, d.fighterId)}
                  </a>
                  {d.byId && <span class="u-sm u-muted">{t('downs.by', { by: name(state, d.byId) })}</span>}
                  {d.ability && <span class="u-sm u-muted">{t('downs.with', { ability: d.ability })}</span>}
                </div>
                <div class="report-down__detail u-xs u-muted">
                  {t('downs.detail', { hit: fmtInt(d.hit), overkill: fmtInt(d.overkill), taken: fmtInt(d.takenRound), max: fmtInt(d.maxHp) })}
                </div>
                <div class="meter meter--thin report-down__meter" data-state="bad" style={{ '--v': Math.min(1, d.takenRound / Math.max(1, d.maxHp)) }} aria-hidden="true">
                  <div class="meter__fill" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function Aftermath({
  state,
  content,
  report,
  infos,
  persp,
}: {
  state: GameState;
  content: ContentDB;
  report: MatchReport;
  infos: FighterInfo[];
  persp: Perspective;
}) {
  const ours = infos.filter((f) => f.us);
  const injuries = report.aftermath.injuries.filter((i) => !persp.involved || ours.some((f) => f.id === i.fighterId));
  const gold = report.aftermath.gold.filter((g) => g.clubId === persp.usClubId);
  const sevLabel = (id: string) => content.development.injury.severityLadder.find((s) => s.id === id)?.label ?? id;
  const weekIndex = state.fixtures[report.fixtureId]?.weekIndex ?? state.calendar.weekIndex;
  return (
    <section class="panel" aria-labelledby="h-after" data-testid="panel-after">
      <header class="panel__header">
        <h2 class="panel__title" id="h-after">
          <span class="icon" data-icon="level-up" aria-hidden="true" />
          {t('after.title')}
        </h2>
      </header>
      <div class="panel__body panel__body--tight l-stack l-stack--sm">
        {injuries.length === 0 ? (
          <p class="u-sm u-muted">{t('after.noInjuries')}</p>
        ) : (
          injuries.map((i) => {
            const f = state.fighters[i.fighterId];
            const inj = f?.injury?.fixtureId === report.fixtureId ? f.injury : null;
            const back = weekLong(content, weekIndex + i.weeksOut + 1, state.clubs[persp.usClubId]?.tierId ?? null);
            return (
              <Callout
                key={i.fighterId}
                kind="bad"
                icon="injury"
                title={t('after.injury', { name: name(state, i.fighterId), severity: sevLabel(i.severity).toLowerCase(), weeks: t('after.weeks', { n: i.weeksOut }) })}
              >
                {inj && inj.round != null
                  ? t('after.injuryText', {
                      round: inj.round,
                      pct: Math.round(inj.damageBp / 100),
                      by: inj.causeFighterId ? t('after.injuryBy', { by: name(state, inj.causeFighterId) }) : '',
                      back,
                    })
                  : t('after.injuryTextShort', { back })}
              </Callout>
            );
          })
        )}
        {gold.length > 0 && (
          <dl class="kv">
            {gold.map((g) => (
              <div key={g.reason}>
                <dt>{g.reason === 'gate' ? t('after.gate') : t('after.winBonus')}</dt>
                <dd>{fmtMoney(g.amount, content, { signed: true })}</dd>
              </div>
            ))}
          </dl>
        )}
        <div class="panel-section__title report-xp-title">{t('after.xp')}</div>
        <dl class="kv" data-testid="xp-list">
          {(persp.involved ? ours : infos)
            .filter((f) => report.aftermath.xp[f.id] !== undefined)
            .sort((a, b) => (report.aftermath.xp[b.id] ?? 0) - (report.aftermath.xp[a.id] ?? 0))
            .map((f) => (
              <div key={f.id}>
                <dt>{name(state, f.id)}</dt>
                <dd>
                  <Delta value={report.aftermath.xp[f.id]!} /> XP
                </dd>
              </div>
            ))}
        </dl>
      </div>
    </section>
  );
}
