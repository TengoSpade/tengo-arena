/**
 * Club select: roster preview of the focused or picked club (playtest ticket AL-R001-T001, "preview
 * team when selecting club"). Role coverage (hybrids count for both roles), the Trials Day rookie the
 * club gets, and every fighter: class with archetype mark, race, age, rating, potential, traits,
 * wage, contract end, captain and vice. Built from the generated world (the engine's roster, fighter
 * and ask views); nothing here changes the game.
 */
import type { ContentDB } from '../../../core/content';
import type { Club, Fighter, GameState } from '../../../core/model';
import { Panel, RoleGlyph, Tag, TraitBadge, tipAttrs, traitPolarity } from '../../components';
import { formatMoney, playerText } from '../../format';
import { safeView } from '../../store/engine';
import { fighterViewOf } from '../../store/views';
import { format } from '../../text';
import type { Wp7Engine } from '../league/lib/engine';
import { TRIALS, trialsRookiesOf } from '../league/lib/trials';
import { ClassTag, Portrait, RatingPill, Stars, classRoles } from '../league/lib/ui';

const P = {
  title: 'Roster preview',
  subtitle: '{club} · {n} fighters',
  roles: 'Role coverage',
  rolesTip: 'Fighters per role. A hybrid class counts for both of its roles.',
  rookie: 'Trials Day rookie',
  rookieAsk: 'asks {wage}/wk',
  captain: 'C',
  captainTip: 'Club captain',
  vice: 'VC',
  viceTip: 'Vice-captain',
  contract: 'to S{n}',
  contractTip: 'Contract runs to the end of season {n}',
  wageTip: 'Wage per week',
  follow: 'Move through the clubs with the arrow keys; the preview follows.',
} as const;

interface Row {
  f: Fighter;
  rating: number;
  potential: number;
}

export function ClubPreview({ engine, state, content, club }: { engine: Wp7Engine; state: GameState; content: ContentDB; club: Club }) {
  const rows: Row[] = safeView(() => engine.roster(state, club.id), [] as Fighter[])
    .map((f) => {
      const v = fighterViewOf(engine, state, content, f.id);
      return { f, rating: v?.rating ?? 0, potential: v?.potential ?? 0 };
    })
    .sort((a, b) => b.rating - a.rating || (a.f.name.full < b.f.name.full ? -1 : 1));
  const roleCount = new Map<string, number>();
  for (const r of rows) for (const role of classRoles(content, r.f.classId)) roleCount.set(role, (roleCount.get(role) ?? 0) + 1);
  const rookie = trialsRookiesOf(state, club.id)[0];
  const rookieView = rookie ? fighterViewOf(engine, state, content, rookie.id) : null;
  const rookieAsk = rookie
    ? Math.min(...[1, 2, 3].map((seasons) => safeView(() => engine.ask(state, rookie.id, club.id, seasons, content), Number.POSITIVE_INFINITY)))
    : null;

  return (
    <Panel
      title={P.title}
      icon="squad"
      subtitle={format(P.subtitle, { club: club.name, n: rows.length })}
      id="club-preview"
      class="club-preview"
      bodyClass="club-preview__body"
      testId="club-preview"
    >
      <div class="club-preview__roles" {...tipAttrs(P.rolesTip)} tabIndex={0} aria-label={P.roles} data-testid="club-preview-roles">
        {content.vocabulary.roles.map((role) => (
          <span key={role.id} class="club-preview__role" data-empty={roleCount.get(role.id) ? undefined : 'true'}>
            <RoleGlyph role={role.id} label={role.name} />
            <span class="u-xs">{role.name}</span>
            <span class="u-num u-strong">{roleCount.get(role.id) ?? 0}</span>
          </span>
        ))}
      </div>

      {rookie && (
        <div class="club-preview__rookie" data-testid="club-preview-rookie">
          <span class="club-preview__top">
            <span class="club-preview__rookie-label u-xs" tabIndex={0} {...tipAttrs({ title: TRIALS.name, body: TRIALS.explain })}>
              {P.rookie}
            </span>
            {rookieAsk !== null && Number.isFinite(rookieAsk) && <span class="l-push u-xs u-muted">{format(P.rookieAsk, { wage: formatMoney(rookieAsk) })}</span>}
          </span>
          <span class="club-preview__top">
            <span class="entity">
              <Portrait content={content} fighter={rookie} size="xs" />
              <span class="entity__stack">
                <span class="entity__name">{rookie.name.full}</span>
                <span class="entity__sub">
                  {content.classes.get(rookie.classId)?.name ?? ''} · {content.races.get(rookie.raceId)?.name ?? ''} · {rookie.age}
                </span>
              </span>
            </span>
            {rookieView && (
              <span class="l-push l-cluster l-cluster--xs">
                <RatingPill value={rookieView.rating} />
                <Stars potential={rookieView.potential} />
              </span>
            )}
          </span>
        </div>
      )}

      <ul class="club-preview__list" role="list" data-testid="club-preview-roster">
        {rows.map(({ f, rating, potential }) => (
          <li key={f.id} class="club-preview__fighter">
            <span class="club-preview__top">
              <span class="entity">
                <Portrait content={content} fighter={f} size="xs" />
                <span class="entity__name">{f.name.full}</span>
              </span>
              {club.captainId === f.id && (
                <Tag kind="accent" tip={P.captainTip}>
                  {P.captain}
                </Tag>
              )}
              {club.viceCaptainId === f.id && (
                <Tag kind="outline" tip={P.viceTip}>
                  {P.vice}
                </Tag>
              )}
              <span class="l-push l-cluster l-cluster--xs">
                <RatingPill value={rating} />
                <Stars potential={potential} />
              </span>
            </span>
            <span class="club-preview__meta u-xs">
              <ClassTag content={content} classId={f.classId} />
              <span class="u-muted">
                {content.races.get(f.raceId)?.name ?? ''} · {f.age}
              </span>
              {f.contract && (
                <span class="l-push u-num u-muted">
                  <span {...tipAttrs(P.wageTip)}>{formatMoney(f.contract.wagePerWeek, { perWeek: true })}</span>
                  {' · '}
                  <span {...tipAttrs(format(P.contractTip, { n: f.contract.endSeason }))}>{format(P.contract, { n: f.contract.endSeason })}</span>
                </span>
              )}
            </span>
            {f.traits.length > 0 && (
              <span class="club-preview__traits">
                {f.traits.map((x) => {
                  const tr = content.traits.get(x.id);
                  return tr ? (
                    <TraitBadge key={x.id} name={tr.name} polarity={traitPolarity(tr)} tip={{ kicker: tr.category, title: tr.name, body: playerText(tr.effectText ?? ''), flavor: tr.flavor }} />
                  ) : null;
                })}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p class="u-xs u-faint">{P.follow}</p>
    </Panel>
  );
}
