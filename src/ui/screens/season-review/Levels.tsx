/**
 * Season review, M1.1 levels step (WP-D; progression.md "season progression report"): replaces the
 * M1 growth step. Per fighter: age +1, rating, levels at the start and end of the season, each pick
 * (stat, skill or trait) when the build reports them, round and bench XP, and the rounds he started
 * Tired or Spent. Sources: the fighter's history row of the season (levelStart, levelEnd, benchXp,
 * tiredRoundStarts), this season's level log while it is still the current season, and core's
 * season summary rows when they carry picks.
 */
import type { ContentDB } from '../../../core/content';
import type { ClubId, Fighter, FighterSeasonRow, GameState, ResolvedLevelUp, SeasonRecord } from '../../../core/model';
import { DataTable, Panel, Tag, tipAttrs, type Column } from '../../components';
import { freshBands, pickLine } from '../../m11/model';
import { useWp7Engine } from '../league/lib/engine';
import { rosterOf } from '../league/lib/season';
import { Delta, Empty, FighterLink, Portrait, RatingPill, Stars } from '../league/lib/ui';
import { tryView } from '../league/lib/views';

interface LevelRow {
  fighter: Fighter;
  row: FighterSeasonRow | null;
  prev: FighterSeasonRow | null;
  rating: number | null;
  potential: number | null;
  picks: ResolvedLevelUp[];
}

/** Picks of the season: core's summary rows when they carry them, else the level log (current season only). */
function picksOf(f: Fighter, season: number, summary: readonly unknown[] | null): ResolvedLevelUp[] {
  const fromSummary = (summary ?? []).find((r) => (r as { fighterId?: string }).fighterId === f.id) as { picks?: ResolvedLevelUp[] } | undefined;
  if (fromSummary?.picks) return fromSummary.picks;
  return (f.season?.levelLog ?? []).filter((l) => l.season === season);
}

export function LevelsStep({ game, content, record, clubId }: { game: GameState; content: ContentDB; record: SeasonRecord; clubId: ClubId }) {
  const engine = useWp7Engine();
  const summary = tryView(() => (engine.developmentSummary?.(game, record.season) ?? null) as readonly unknown[] | null);
  const rows: LevelRow[] = rosterOf(game, clubId).map((f) => {
    const v = tryView(() => engine.fighterView(game, f.id, content));
    return {
      fighter: f,
      row: f.history.find((h) => h.season === record.season) ?? null,
      prev: f.history.find((h) => h.season === record.season - 1) ?? null,
      rating: v.ok ? v.value.rating : null,
      potential: v.ok ? v.value.potential : null,
      picks: picksOf(f, record.season, summary.ok ? summary.value : null),
    };
  });
  const gained = (r: LevelRow) => (r.row?.levelStart != null && r.row?.levelEnd != null ? r.row.levelEnd - r.row.levelStart : r.picks.length);
  const total = rows.reduce((s, r) => s + gained(r), 0);
  const columns: Column<LevelRow>[] = [
    {
      id: 'fighter',
      header: 'Fighter',
      fill: true,
      sortValue: (r) => r.fighter.name.full,
      firstDir: 'asc',
      cell: (r) => (
        <span class="entity">
          <Portrait content={content} fighter={r.fighter} size="xs" />
          <FighterLink state={game} id={r.fighter.id} />
        </span>
      ),
    },
    { id: 'age', header: 'Age', sortValue: (r) => r.fighter.age, cellAttrs: () => ({ 'data-tip': 'Age after the season-end step (+1)' }), cell: (r) => `${content.races.get(r.fighter.raceId)?.name ?? ''} ${r.fighter.age}` },
    {
      id: 'rating',
      header: 'Rating',
      align: 'num',
      sortValue: (r) => r.row?.rating ?? r.rating ?? 0,
      cell: (r) => {
        const v = r.row?.rating ?? r.rating;
        const d = r.row && r.prev ? r.row.rating - r.prev.rating : null;
        return v === null ? (
          '—'
        ) : (
          <span class="l-cluster l-cluster--xs">
            <RatingPill value={v} />
            {d !== null && d !== 0 && <Delta value={d} tip={`Rating ${r.prev!.rating} → ${r.row!.rating} over the season`} />}
          </span>
        );
      },
    },
    {
      id: 'levels',
      header: 'Levels',
      align: 'num',
      sortValue: (r) => gained(r),
      cellAttrs: (r): Record<string, string> => ({ 'data-tip': r.row?.levelStart != null ? `Level ${r.row.levelStart} → ${r.row.levelEnd} this season` : 'Levels gained this season' }),
      cell: (r) => (r.row?.levelStart != null && r.row.levelEnd != null ? `${r.row.levelStart} → ${r.row.levelEnd} (+${r.row.levelEnd - r.row.levelStart})` : r.picks.length ? `+${r.picks.length}` : '—'),
    },
    {
      id: 'picks',
      header: 'Picks',
      cell: (r) =>
        r.picks.length === 0 ? (
          <span class="u-faint">{gained(r) > 0 ? 'listed in his profile' : 'none'}</span>
        ) : (
          <span class="l-cluster l-cluster--xs" {...tipAttrs(r.picks.map((p) => `Level ${p.level}: ${pickLine(content, p.picked)}${p.trait ? ` + ${content.traits.get(p.trait)?.name ?? p.trait}` : ''} (${p.how})`).join(' · '))}>
            {r.picks.slice(0, 4).map((p) => (
              <Tag key={p.level} kind={p.picked?.kind === 'stat' ? 'outline' : 'accent'}>
                {pickLine(content, p.picked)}
              </Tag>
            ))}
            {r.picks.length > 4 && <span class="u-faint">+{r.picks.length - 4}</span>}
          </span>
        ),
    },
    {
      id: 'xp',
      header: 'XP',
      align: 'num',
      sortValue: (r) => r.row?.xp ?? 0,
      cellAttrs: (r): Record<string, string> => ({ 'data-tip': `Round XP ${(r.row?.xp ?? 0) - (r.row?.benchXp ?? 0)} · bench XP ${r.row?.benchXp ?? 0} (a third of a lineup slot per match he sat out)` }),
      cell: (r) => (r.row ? `${r.row.xp - (r.row.benchXp ?? 0)} + ${r.row.benchXp ?? 0}` : '—'),
    },
    {
      id: 'tired',
      header: 'Tired starts',
      align: 'num',
      class: 'col-mid',
      sortValue: (r) => r.row?.tiredRoundStarts ?? 0,
      cellAttrs: () => {
        const b = freshBands(content);
        return { 'data-tip': `Rounds he started below ${b.threshold} Freshness (${b.tiredName} or ${b.spentName}), with the penalty` };
      },
      cell: (r) => (r.row?.tiredRoundStarts != null ? r.row.tiredRoundStarts : '—'),
    },
    { id: 'potential', header: 'Potential', class: 'col-mid', sortValue: (r) => r.potential ?? 0, cell: (r) => (r.potential !== null ? <Stars potential={r.potential} /> : '—') },
  ];
  return (
    <Panel title="Levels this season" icon="level-up" subtitle={`${total} levels gained across the roster · age +1 · decline after the peak`} body="flush" testId="review-development">
      <DataTable label="Levels this season" columns={columns} rows={rows} rowKey={(r) => r.fighter.id} variant={['compact']} defaultSort={{ column: 'levels', dir: 'desc' }} empty={<Empty compact icon="squad" title="No fighters on the roster" />} />
    </Panel>
  );
}
