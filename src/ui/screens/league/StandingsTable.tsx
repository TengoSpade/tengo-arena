/**
 * Wing or tier table (04 ui-league): position with promotion / relegation
 * marks, club, W-L, rounds, round difference, points, last five. Zone lines:
 * dashed brass under the last qualifier, dashed red above the relegation
 * place; every zone also has a glyph and words (never colour alone).
 * Reused by the season review (final standings).
 */
import type { ContentDB } from '../../../core/content';
import type { ClubId, GameState, StandingRow } from '../../../core/model';
import { ClubEntity, clubName } from './lib/club';
import { fmtSigned } from './lib/format';
import { sortBy, SortTh, useSort } from './lib/sort';
import { FormStrip } from './lib/ui';
import { t } from './text';
import './league.css';

export interface Zones {
  /** Rows 1..qualifiers reach the Reckoning (wing tables). */
  qualifiers: number;
  /** Positions at or below this are relegated (wing tables); null = no relegation in this tier. */
  relegateFrom: number | null;
  /** Tier-table leader holds the Shield; promotion only below tier 1. */
  shieldLeaderId: ClubId | null;
  shieldPromotes: boolean;
}

type Key = 'pos' | 'club' | 'wl' | 'rounds' | 'rd' | 'pts' | 'seed' | 'wing';

export function StandingsTable({
  state,
  content,
  rows,
  variant,
  zones,
  usId,
  nextOpponentId,
  seeds,
  wingOf,
  caption,
  showForm = true,
}: {
  state: GameState;
  content: ContentDB;
  rows: readonly StandingRow[];
  variant: 'wing' | 'tier';
  zones: Zones;
  usId: ClubId | null;
  nextOpponentId?: ClubId | null;
  /** Tier table: projected Reckoning seed per club. */
  seeds?: ReadonlyMap<ClubId, number>;
  /** Tier table: wing name per club. */
  wingOf?: ReadonlyMap<ClubId, string>;
  caption: string;
  /** Wing tables: show the last-five strip (off in the season review). */
  showForm?: boolean;
}) {
  const { sort, toggle } = useSort<Key>({ key: 'pos', dir: 'asc' });
  const keyOf = (r: StandingRow): number | string => {
    switch (sort.key) {
      case 'pos':
        return r.position;
      case 'club':
        return clubName(state, r.clubId);
      case 'wl':
        return r.matchWins * 100 - r.matchLosses;
      case 'rounds':
        return r.roundsWon;
      case 'rd':
        return r.roundsWon - r.roundsLost;
      case 'pts':
        return r.points;
      case 'seed':
        return seeds?.get(r.clubId) ?? 99;
      case 'wing':
        return wingOf?.get(r.clubId) ?? '';
    }
  };
  const sorted = sortBy(rows, keyOf, sort.dir);
  const byPosition = sort.key === 'pos' && sort.dir === 'asc';
  const pointsTip = t('tip.points', {
    p20: content.leagues.standings.pointsByResult['2-0'],
    p21: content.leagues.standings.pointsByResult['2-1'],
    p12: content.leagues.standings.pointsByResult['1-2'],
    p02: content.leagues.standings.pointsByResult['0-2'],
  });
  return (
    <div class="table-wrap league-table" data-testid={`standings-${variant}`}>
      <table class="data-table data-table--compact data-table--dense">
        <caption class="u-sr-only">{caption}</caption>
        <thead>
          <tr>
            <SortTh label="#" sortKey="pos" sort={sort} onSort={toggle} firstDir="asc" class="cell-tight" />
            <SortTh label={t('col.club')} sortKey="club" sort={sort} onSort={toggle} firstDir="asc" />
            {variant === 'tier' && <SortTh label={t('col.wing')} sortKey="wing" sort={sort} onSort={toggle} firstDir="asc" class="col-mid" />}
            <SortTh label={t('col.wl')} sortKey="wl" sort={sort} onSort={toggle} num tip={t('tip.wl')} />
            <SortTh label={t('col.rounds')} sortKey="rounds" sort={sort} onSort={toggle} num tip={t('tip.rounds')} class={variant === 'wing' && showForm ? 'col-mid' : undefined} />
            <SortTh label={t('col.rd')} sortKey="rd" sort={sort} onSort={toggle} num tip={t('tip.rd')} />
            <SortTh label={t('col.pts')} sortKey="pts" sort={sort} onSort={toggle} num tip={pointsTip} />
            {variant === 'wing' ? (
              showForm && <th scope="col">{t('col.form')}</th>
            ) : (
              <SortTh label={t('col.seed')} sortKey="seed" sort={sort} onSort={toggle} num firstDir="asc" tip={t('tip.seed')} />
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const qualify = variant === 'wing' && r.position <= zones.qualifiers;
            const relegate = variant === 'wing' && zones.relegateFrom !== null && r.position >= zones.relegateFrom;
            const shield = zones.shieldLeaderId === r.clubId;
            const classes = [
              r.clubId === usId ? 'is-us' : '',
              byPosition && variant === 'wing' && r.position === zones.qualifiers ? 'is-cut' : '',
              byPosition && variant === 'wing' && zones.relegateFrom !== null && r.position === zones.relegateFrom - 1 ? 'is-cut--bad' : '',
            ]
              .filter(Boolean)
              .join(' ');
            const rd = r.roundsWon - r.roundsLost;
            const seed = seeds?.get(r.clubId);
            return (
              <tr key={r.clubId} class={classes || undefined} data-zone={qualify ? 'qualify' : relegate ? 'relegate' : undefined} data-club={r.clubId}>
                <td>
                  <span class="l-row league-pos">
                    {r.position}
                    {shield && (
                      <span class="zone-mark zone-mark--up" data-tip={zones.shieldPromotes ? t('tip.shieldPromotes') : t('tip.shield')}>
                        <span class="u-sr-only">{t('sr.shield')}</span>
                      </span>
                    )}
                    {relegate && (
                      <span class="zone-mark zone-mark--down" data-tip={t('tip.relegation')}>
                        <span class="u-sr-only">{t('sr.relegation')}</span>
                      </span>
                    )}
                  </span>
                </td>
                <td class="cell-fill">
                  <ClubEntity state={state} clubId={r.clubId} short={variant === 'wing'}>
                    {r.clubId === usId && <span class="u-sr-only">{t('sr.you')}</span>}
                    {nextOpponentId === r.clubId && (
                      <span class="tag tag--accent" data-tip={t('tip.next')}>
                        {t('tag.next')}
                      </span>
                    )}
                  </ClubEntity>
                </td>
                {variant === 'tier' && <td class="col-mid">{wingOf?.get(r.clubId) ?? ''}</td>}
                <td class="cell-num" data-tip={t('tip.results', { a: r.results['2-0'], b: r.results['2-1'], c: r.results['1-2'], d: r.results['0-2'] })}>
                  {r.matchWins}–{r.matchLosses}
                </td>
                <td class={variant === 'wing' && showForm ? 'cell-num col-mid' : 'cell-num'}>
                  {r.roundsWon}–{r.roundsLost}
                </td>
                <td class="cell-num">{fmtSigned(rd)}</td>
                <td class="cell-num cell-strong">{r.points}</td>
                {variant === 'wing' ? (
                  showForm && (
                    <td>
                      <FormStrip form={r.form} />
                    </td>
                  )
                ) : (
                  <td class="cell-num">{seed ? <span data-tip={t('tip.seedN', { n: seed })}>{seed}</span> : <span class="u-faint">—</span>}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
