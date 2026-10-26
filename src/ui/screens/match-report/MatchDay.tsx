/**
 * Match report, M1.1 (WP-D; combat-skills.md "Match report and timeline", progression.md): who
 * fought each round with Fresh / Tired / Spent tags and entries, the swap lines between rounds
 * (player, auto, forced by injury, emergency entrant), XP and level-ups from this match, and perk
 * procs. Reads core's report timeline (null for M1 whole-match results: the panel then hides).
 */
import type { ContentDB } from '../../../core/content';
import type { MatchTimeline } from '../../../core/game';
import type { FighterId, GameState, MatchReport, SwapReason } from '../../../core/model';
import { Tag, tipAttrs } from '../../components';
import { labelFor } from '../../m11/model';
import { FreshTag } from '../../m11/parts';
import type { Perspective } from './analysis';

const REASON: Record<SwapReason, string> = { player: 'your swap', auto: 'auto', injury: 'forced: injury', emergency: 'emergency entrant' };

export function timelineOf(report: MatchReport): MatchTimeline | null {
  return (report as MatchReport & { timeline?: MatchTimeline | null }).timeline ?? null;
}

/** Perk procs of a fighter in this match, when the report carries them (sim recap perkProcs). */
function procsOf(report: MatchReport, id: FighterId): Record<string, number> {
  const recap = report.fighters.find((f) => f.fighterId === id) as (MatchReport['fighters'][number] & { perkProcs?: Record<string, number> }) | undefined;
  return recap?.perkProcs ?? {};
}

export function MatchDayPanel({ state, content, report, persp }: { state: GameState; content: ContentDB; report: MatchReport; persp: Perspective }) {
  const tl = timelineOf(report);
  if (!tl) return null;
  const name = (id: FighterId) => state.fighters[id]?.name.full ?? id;
  const given = (id: FighterId) => state.fighters[id]?.name.given ?? id;
  const usSide = persp.involved ? persp.usSide : 'home';
  const themSide = usSide === 'home' ? 'away' : 'home';
  const sides = [usSide, themSide] as const;
  const squadIds = [...tl.squads[usSide].starters, ...tl.squads[usSide].reserves, ...tl.emergencyEntrants.filter((id) => tl.fighters[id]?.side === usSide)];
  const levelsOf = (id: FighterId): number[] => {
    const f = state.fighters[id];
    if (!f) return [];
    const at = (x: { season: number; weekIndex: number }) => x.season === report.season && state.fixtures[report.fixtureId]?.weekIndex === x.weekIndex;
    return [...(f.season?.levelLog ?? []).filter(at).map((l) => l.level), ...(f.pendingLevelUps ?? []).filter(at).map((p) => p.level)].sort((a, b) => a - b);
  };

  return (
    <section class="panel" aria-labelledby="h-matchday" data-testid="panel-matchday">
      <header class="panel__header">
        <h2 class="panel__title" id="h-matchday">
          <span class="icon" data-icon="squad" aria-hidden="true" />
          Squads and swaps
        </h2>
        <span class="panel__subtitle">Freshness at each round start</span>
      </header>
      <div class="panel__body panel__body--tight l-stack l-stack--sm">
        {tl.rounds.map((r) => (
          <div key={r.round} class="md-round" data-testid={`md-round-${r.round}`}>
            <div class="panel-section__title">Round {r.round}</div>
            {sides.map((side) => (
              <div key={side} class={`md-five${side === usSide ? ' is-us' : ''}`}>
                {r[side].fighterIds.map((id, slot) => {
                  const f = r[side].freshness[slot] ?? 100;
                  const l = labelFor(f, content);
                  return (
                    <span key={id} class="md-fighter" {...tipAttrs(`${name(id)} · Freshness ${f} (${l.text}) at the round start${r[side].entered[slot] ? ' · entered for this round' : ''}`)}>
                      {r[side].entered[slot] && <span class="md-in" aria-label="entered">↑</span>}
                      {given(id)}
                      <FreshTag value={f} label={l.id} text={l.text} />
                    </span>
                  );
                })}
              </div>
            ))}
            {tl.steps
              .filter((s) => s.afterRound === r.round)
              .map((s) => (
                <ul key={`s${s.afterRound}`} class="md-swaps" role="list" data-testid={`md-swaps-${s.afterRound}`}>
                  {sides.flatMap((side) =>
                    s[side].map((w) => {
                      const fb = s.freshness[w.out];
                      const fi = s.freshness[w.in];
                      return (
                        <li key={`${side}${w.out}`} class={side === usSide ? 'is-us' : undefined}>
                          <span class="u-xs u-muted">After round {s.afterRound} · {side === usSide ? 'You' : 'Them'}:</span> {name(w.out)}
                          {fb !== undefined && <span class="u-xs u-muted"> ({labelFor(fb, content).text} {fb})</span>} → {name(w.in)}
                          {fi !== undefined && <span class="u-xs u-muted"> ({labelFor(fi, content).text} {fi})</span>}{' '}
                          <Tag kind={w.reason === 'injury' || w.reason === 'emergency' ? 'bad' : w.reason === 'player' ? 'accent' : 'info'}>{REASON[w.reason]}</Tag>
                        </li>
                      );
                    }),
                  )}
                  {sides.every((side) => s[side].length === 0) && <li class="u-xs u-faint">After round {s.afterRound}: no swaps</li>}
                </ul>
              ))}
          </div>
        ))}
        <div>
          <div class="panel-section__title">XP and levels</div>
          <ul class="md-xp" role="list" data-testid="md-xp">
            {squadIds.map((id) => {
              const tf = tl.fighters[id];
              const xp = report.aftermath.xp[id];
              const levels = levelsOf(id);
              const procs = Object.entries(procsOf(report, id));
              const fate =
                tf?.injuredInRound != null
                  ? `injured in round ${tf.injuredInRound}`
                  : tf?.withdrawnAfter != null
                    ? `swapped out after round ${tf.withdrawnAfter}`
                    : tf?.enteredAfter != null
                      ? `entered after round ${tf.enteredAfter} (${REASON[tf.enteredHow ?? 'auto']})`
                      : tf && tf.rounds.length === 0
                        ? 'reserve, did not enter'
                        : null;
              return (
                <li key={id} class="md-xp__row">
                  <span class="u-sm">{name(id)}</span>
                  {fate && <span class="u-xs u-muted md-xp__fate">{fate}</span>}
                  <span class="l-push u-num u-sm" {...tipAttrs('XP from this match (rounds started; ⅓ of a slot for a reserve who did not enter)')}>
                    {xp !== undefined ? `+${xp} XP` : '—'}
                  </span>
                  {levels.map((lv) => (
                    <Tag key={lv} kind="accent" icon="level-up" tip={`Reached level ${lv} with this match`}>
                      Lv {lv}
                    </Tag>
                  ))}
                  {procs.map(([perkId, n]) => (
                    <Tag key={perkId} kind="outline" tip={`${content.perks.get(perkId)?.text ?? perkId}: fired ${n} times`}>
                      {content.perks.get(perkId)?.name ?? perkId} ×{n}
                    </Tag>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
