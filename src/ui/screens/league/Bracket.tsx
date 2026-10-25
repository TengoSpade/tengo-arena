/**
 * The Reckoning bracket (04 ui-league, ui-season-end): quarterfinal,
 * semifinal, final and champion columns; each match shows seeds, crests,
 * short names, score and venue / week. Built either from a stored bracket
 * (live or finished) or from projected seeds ("if the season ended today").
 */
import type { ContentDB } from '../../../core/content';
import type { Bracket as BracketData, BracketSlot, ClubId, Competition, FixtureId, GameState, TierId } from '../../../core/model';
import { Crest, clubOf, clubShort, clubVenue } from './lib/club';
import { fmtMoney } from './lib/format';
import { isRoundId, roundName, type RoundId } from './lib/calendar';
import { href } from './lib/store';
import { t } from './text';

export interface BracketTeam {
  seed: number | null;
  clubId: ClubId | null;
  placeholder?: string;
  score?: number | null;
  outcome?: 'winner' | 'loser' | null;
}

export interface BracketMatch {
  key: string;
  teams: [BracketTeam, BracketTeam];
  metaLeft: string;
  metaRight: string;
  fixtureId: FixtureId | null;
  played: boolean;
}

export interface BracketColumn {
  roundId: RoundId;
  title: string;
  sub: string;
  matches: BracketMatch[];
}

export interface BracketModel {
  columns: BracketColumn[];
  championId: ClubId | null;
}

type RoundDef = ContentDB['leagues']['tournament']['rounds'][number];

function roundSub(content: ContentDB, def: RoundDef): string {
  if (def.host === 'neutral') {
    const venue = def.venueId ? content.venues.get(def.venueId) : undefined;
    return t('bracket.subNeutral', { bestOf: def.bestOf, venue: venue?.name ?? t('bracket.neutral') });
  }
  return t('bracket.subHosted', { bestOf: def.bestOf });
}

function hostLabel(content: ContentDB, def: RoundDef, homeId: ClubId | null): string {
  if (def.host === 'neutral') {
    const venue = def.venueId ? content.venues.get(def.venueId) : undefined;
    return venue?.name ?? t('bracket.neutral');
  }
  if (!homeId) return t('bracket.higherSeedHosts');
  const v = clubVenue(content, homeId);
  return v ? t('bracket.at', { place: v.city }) : '';
}

function slotRef(slot: BracketSlot): string {
  if (slot.kind === 'seed') return t('bracket.seed', { n: slot.seed });
  const abbr = slot.roundId === 'quarterfinal' ? 'QF' : 'SF';
  return t('bracket.winnerOf', { tie: `${abbr}${slot.slot}` });
}

/** From projected seeds 1..8 (wing winners first, then by tier table). */
export function projectedBracket(content: ContentDB, seeds: readonly ClubId[]): BracketModel {
  const rounds = content.leagues.tournament.rounds;
  const columns: BracketColumn[] = rounds.filter((r) => isRoundId(r.id)).map((def, ri) => {
    const roundId = def.id as RoundId;
    let matches: BracketMatch[];
    if (ri === 0) {
      matches = (def.pairs ?? []).map((pair, i) => {
        const [a, b] = [Number(pair[0]), Number(pair[1])];
        const home = seeds[a - 1] ?? null;
        const away = seeds[b - 1] ?? null;
        return {
          key: `${roundId}-${i + 1}`,
          teams: [
            { seed: a, clubId: home, placeholder: t('bracket.seed', { n: a }) },
            { seed: b, clubId: away, placeholder: t('bracket.seed', { n: b }) },
          ],
          metaLeft: hostLabel(content, def, home),
          metaRight: def.week,
          fixtureId: null,
          played: false,
        };
      });
    } else {
      const prev = rounds[ri - 1]!;
      const prevAbbr = prev.id === 'quarterfinal' ? 'QF' : 'SF';
      const pairs: (string | number)[][] = def.pairs ?? [[`${prevAbbr}1`, `${prevAbbr}2`]];
      matches = pairs.map((pair, i) => ({
        key: `${roundId}-${i + 1}`,
        teams: [
          { seed: null, clubId: null, placeholder: t('bracket.winnerOf', { tie: String(pair[0]) }) },
          { seed: null, clubId: null, placeholder: t('bracket.winnerOf', { tie: String(pair[1]) }) },
        ],
        metaLeft: def.host === 'neutral' ? hostLabel(content, def, null) : t('bracket.higherSeedHosts'),
        metaRight: def.week,
        fixtureId: null,
        played: false,
      }));
    }
    return { roundId, title: pluralRound(roundId), sub: roundSub(content, def), matches };
  });
  return { columns, championId: null };
}

function pluralRound(id: RoundId): string {
  return id === 'final' ? roundName(id) : t(`bracket.${id}s`);
}

/** From a stored Reckoning (live or complete). */
export function storedBracket(state: GameState, content: ContentDB, comp: Competition): BracketModel | null {
  const bracket: BracketData | null = comp.bracket;
  if (!bracket) return null;
  const defs = content.leagues.tournament.rounds;
  const seedOf = (id: ClubId | null) => (id ? bracket.seeds.indexOf(id) + 1 || null : null);
  const clubFor = (slot: BracketSlot): ClubId | null => {
    if (slot.kind === 'seed') return bracket.seeds[slot.seed - 1] ?? null;
    const r = bracket.rounds.find((x) => x.roundId === slot.roundId);
    return r?.ties.find((x) => x.slot === slot.slot)?.winnerClubId ?? null;
  };
  const columns: BracketColumn[] = bracket.rounds.map((round) => {
    const def = defs.find((d) => d.id === round.roundId);
    const matches: BracketMatch[] = round.ties.map((tie) => {
      const fixture = tie.fixtureId ? state.fixtures[tie.fixtureId] : undefined;
      const result = tie.fixtureId ? state.results[tie.fixtureId] : undefined;
      const homeId = fixture?.homeClubId ?? clubFor(tie.home);
      const awayId = fixture?.awayClubId ?? clubFor(tie.away);
      const team = (clubId: ClubId | null, fallback: BracketSlot, side: 'home' | 'away'): BracketTeam => ({
        seed: seedOf(clubId),
        clubId,
        placeholder: clubId ? undefined : slotRef(fallback),
        score: result ? result.score[side] : null,
        outcome: result ? (result.winnerClubId === clubId ? 'winner' : 'loser') : null,
      });
      const rounds = result ? result.rounds.length : null;
      return {
        key: `${round.roundId}-${tie.slot}`,
        teams: [team(homeId, tie.home, 'home'), team(awayId, tie.away, 'away')],
        metaLeft: def ? hostLabel(content, def, fixture ? fixture.homeClubId : null) : '',
        metaRight: result ? t('bracket.rounds', { n: rounds ?? 0 }) : String(round.weekId),
        fixtureId: tie.fixtureId,
        played: Boolean(result),
      };
    });
    return {
      roundId: round.roundId,
      title: pluralRound(round.roundId),
      sub: def ? roundSub(content, def) : '',
      matches,
    };
  });
  return { columns, championId: bracket.championId };
}

function Team({ state, team, usId }: { state: GameState; team: BracketTeam; usId: ClubId | null }) {
  const club = clubOf(state, team.clubId);
  const cls = [
    'bracket__team',
    team.outcome === 'winner' ? 'bracket__team--winner' : '',
    team.outcome === 'loser' ? 'bracket__team--loser' : '',
    team.clubId && team.clubId === usId ? 'bracket__team--us' : '',
    !team.clubId ? 'bracket__team--tbd' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div class={cls} data-tip={club ? club.name : undefined}>
      <span class="bracket__seed">{team.seed ?? ''}</span>
      {club ? <Crest club={club} size="sm" /> : <span />}
      <span class="bracket__name">{club ? clubShort(state, team.clubId) : (team.placeholder ?? t('bracket.tbd'))}</span>
      <span class="bracket__score">{team.score ?? ''}</span>
    </div>
  );
}

function Match({ state, match, usId }: { state: GameState; match: BracketMatch; usId: ClubId | null }) {
  const inner = (
    <>
      <Team state={state} team={match.teams[0]} usId={usId} />
      <Team state={state} team={match.teams[1]} usId={usId} />
      <div class="bracket__meta">
        <span>{match.metaLeft}</span>
        <span>{match.metaRight}</span>
      </div>
    </>
  );
  const label = match.teams.map((x) => (x.clubId ? clubShort(state, x.clubId) : x.placeholder)).join(' v ');
  if (match.played && match.fixtureId) {
    return (
      <a class="bracket__match" href={href(`match/${encodeURIComponent(match.fixtureId)}`)} aria-label={t('bracket.openReport', { match: label })}>
        {inner}
      </a>
    );
  }
  return <div class="bracket__match">{inner}</div>;
}

function onPath(match: BracketMatch, usId: ClubId | null): boolean {
  return Boolean(usId) && match.teams.some((x) => x.clubId === usId);
}

export function BracketView({
  state,
  content,
  model,
  usId,
  tierId,
}: {
  state: GameState;
  content: ContentDB;
  model: BracketModel;
  usId: ClubId | null;
  tierId: TierId;
}) {
  const tier = content.tiers.get(tierId);
  const above = tier ? content.tiers.list.find((x) => x.level === tier.level - 1) : undefined;
  const level = tier?.level ?? 1;
  const prize = content.tierProfile(level).tournamentPrize;
  const champ = clubOf(state, model.championId);
  return (
    <div
      class="bracket league-bracket"
      style={{ gridTemplateColumns: `repeat(${model.columns.length}, minmax(10.5rem, 1fr)) minmax(8.5rem, 0.8fr)` }}
      data-testid="bracket"
    >
      {model.columns.map((col) => {
        const pairs: BracketMatch[][] = [];
        if (col.matches.length === 1) pairs.push(col.matches);
        else for (let i = 0; i < col.matches.length; i += 2) pairs.push(col.matches.slice(i, i + 2));
        return (
          <div class="bracket__round" key={col.roundId}>
            <div class="bracket__label">
              <span>{col.title}</span>
              <span>{col.sub}</span>
            </div>
            <div class="bracket__body">
              {col.matches.length === 1 ? (
                <div class={onPath(col.matches[0]!, usId) ? 'bracket__slot is-path' : 'bracket__slot'}>
                  <Match state={state} match={col.matches[0]!} usId={usId} />
                </div>
              ) : (
                pairs.map((pair, i) => (
                  <div class="bracket__pair" key={i}>
                    {pair.map((m) => (
                      <div class={onPath(m, usId) ? 'bracket__slot is-path' : 'bracket__slot'} key={m.key}>
                        <Match state={state} match={m} usId={usId} />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
      <div class="bracket__round">
        <div class="bracket__label">
          <span>{t('bracket.champion')}</span>
          <span>{above ? t('bracket.promotedTo', { tier: above.shortName }) : (tier?.tournamentName ?? '')}</span>
        </div>
        <div class="bracket__body">
          <div class={model.championId && model.championId === usId ? 'bracket__slot is-path' : 'bracket__slot'}>
            <div class="bracket__champion">
              {champ ? <Crest club={champ} size="lg" /> : <span class="icon" data-icon="league" aria-hidden="true" />}
              <span class={champ ? 'bracket__champion-name' : 'bracket__champion-name u-muted'}>{champ ? champ.name : t('bracket.tbd')}</span>
              <span class="u-xs u-faint">
                {above
                  ? t('bracket.prizeAndPromotion', { prize: fmtMoney(prize.champion, content) })
                  : t('bracket.prize', { prize: fmtMoney(prize.champion, content) })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
