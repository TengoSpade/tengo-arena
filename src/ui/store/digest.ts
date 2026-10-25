/**
 * The weekly digest ("This week" on Home, the top-bar bell, the Home nav
 * badge). Notification budget (04 §6.2, OC-7, PROPOSED · TUNABLE): at most
 * 6 items, at most 2 "Needs action", ordered blockers, needs action, our
 * result, squad changes, market, league; routine items are grouped.
 * Sources: getBlockers() and the core news items (NewsItem.key + params;
 * core stores no prose, the UI text table renders it).
 */
import type { ContentDB } from '../../core/content';
import { personName, type Blocker, type ClubId, type GameState, type NewsId, type NewsItem } from '../../core/model';
import { formatMoney } from '../format';
import { format } from '../text';
import { blockerTarget } from './digest-targets';
import { blockerText, distinctBlockers } from './messages';

export type DigestKind = 'medical' | 'contract' | 'result' | 'market' | 'league' | 'development';

export interface DigestItem {
  id: string;
  kind: DigestKind;
  title: string;
  text: string;
  needsAction: boolean;
  unread: boolean;
  /** Primary action of the item. */
  action?: { label: string; href: string };
  newsIds: NewsId[];
  /** Deadline line ("answer at week processing"), when the item has one. */
  deadline?: string;
}

export const DIGEST_LIMIT = 6;
export const NEEDS_ACTION_LIMIT = 2;

/**
 * News key -> how the digest shows it. Keys and params follow core (core/fighters/news.ts,
 * core/economy offers and finance); names are resolved from refs in paramsOf. Unknown keys get a
 * readable fallback.
 */
const TEMPLATES: Record<string, { kind: DigestKind; title: string; text?: string; action?: [string, string]; needsAction?: boolean }> = {
  'fighter.injured': { kind: 'medical', title: '{fighter} is out for {weeks} wk', text: '{severity} in round {round}.', action: ['Review lineup', '#/squad'], needsAction: true },
  'fighter.career_ended': { kind: 'medical', title: '{fighter}’s career is over', text: 'A career-ending injury. He leaves the roster.', action: ['Squad', '#/squad'], needsAction: true },
  'fighter.scarred': { kind: 'medical', title: '{fighter} is scarred: {trait}', action: ['Profile', '#/fighter/{fighterId}'] },
  'fighter.trait_gained': { kind: 'development', title: '{fighter} gained {trait}', action: ['Profile', '#/fighter/{fighterId}'] },
  'fighter.trait_lost': { kind: 'development', title: '{fighter} lost {trait}', action: ['Profile', '#/fighter/{fighterId}'] },
  'fighter.trait_skipped': { kind: 'development', title: '{fighter} could not gain {trait}', text: 'He already has the most traits a fighter can hold.', action: ['Profile', '#/fighter/{fighterId}'] },
  'fighter.final_season': { kind: 'contract', title: '{fighter} announced his final season', text: 'He retires at season end, at {age}.', action: ['Profile', '#/fighter/{fighterId}'] },
  'fighter.retired': { kind: 'contract', title: '{fighter} retired at {age}', action: ['Profile', '#/fighter/{fighterId}'] },
  'captaincy.snubbed': { kind: 'development', title: '{fighter} feels snubbed', text: 'The former captain: −2 chemistry when fielded, for 6 matchweeks.', action: ['Squad', '#/squad'] },
  'captaincy.passed_over': { kind: 'development', title: '{fighter} feels passed over', text: '−1 chemistry for 6 matchweeks, or until he is made vice-captain.', action: ['Squad', '#/squad'] },
  'captaincy.losing_the_room': { kind: 'development', title: 'Captain {fighter} is losing the room', text: 'Not fielded for 4 matches: −10 captaincy until he plays again.', action: ['Squad', '#/squad'], needsAction: true },
  'captaincy.departed': { kind: 'development', title: 'Your long-serving captain has left', text: '−1 chemistry for 4 matchweeks.', action: ['Squad', '#/squad'] },
  'captaincy.interim': { kind: 'development', title: '{fighter} is interim captain', text: 'Named by the club; choose a captain on the squad screen.', action: ['Squad', '#/squad'], needsAction: true },
  // core/game (D-S): named at kickoff when the captain is missing (params.reason vice | starter) or after the captain left.
  'captain.interim': { kind: 'development', title: '{fighter} is interim captain', text: '{interimReason} Choose a captain on the squad screen to change it.', action: ['Squad', '#/squad'], needsAction: true },
  'offer.lost': { kind: 'market', title: '{fighter} signed for {otherClub}', action: ['Market', '#/market'] },
  'offer.void': { kind: 'market', title: 'Your offer to {fighter} lapsed', text: 'It no longer met the rules at week processing.', action: ['Market', '#/market'] },
  'finance.embargo-lifted': { kind: 'contract', title: 'Spending embargo lifted', action: ['Finances', '#/finances'] },
  'finance.registry-advance': { kind: 'contract', title: 'Registry advance of {amount}', text: 'Repaid from future grants (debt {registryDebt}).', action: ['Finances', '#/finances'], needsAction: true },
  'fighter.recovered': { kind: 'medical', title: '{fighter} is fit again', action: ['Squad', '#/squad'] },
  'contract.expiring': { kind: 'contract', title: '{count} contracts end this season', text: 'Unrenewed fighters leave at season end. Renewal opens in the final contract season.', action: ['Squad', '#/squad'], needsAction: true },
  'match.result': { kind: 'result', title: '{result} {score} against {opponent}', action: ['Report', '#/match/{fixtureId}'] },
  'offer.accepted': { kind: 'market', title: '{fighter} accepted your offer', text: '{wage} for {seasons} {seasons?season|seasons}.', action: ['Squad', '#/squad'] },
  'offer.refused': { kind: 'market', title: '{fighter} refused your offer', text: 'Patience left with your club: {patienceLeft}.', action: ['Market', '#/market'] },
  'offer.countered': { kind: 'market', title: '{fighter} countered at {counterWage}', text: 'Offer that wage to sign him; the counter lapses after the next week processing.', action: ['Market', '#/market'], needsAction: true },
  'market.new-free-agent': { kind: 'market', title: 'New free agent: {fighter}', action: ['View', '#/market'] },
  'finance.watch': { kind: 'contract', title: 'Finances on watch', action: ['Finances', '#/finances'], needsAction: true },
  'finance.embargo': { kind: 'contract', title: 'Spending embargo', action: ['Finances', '#/finances'], needsAction: true },
  'fighter.developed': { kind: 'development', title: '{fighter} improved', action: ['Profile', '#/fighter/{fighterId}'] },
  'league.standing': { kind: 'league', title: 'Now {position} in the {wing}', action: ['Standings', '#/league'] },
};

function kindOfKey(key: string): DigestKind {
  if (key.startsWith('fighter.injur')) return 'medical';
  if (key.startsWith('contract.') || key.startsWith('finance.')) return 'contract';
  if (key.startsWith('match.')) return 'result';
  if (key.startsWith('offer.') || key.startsWith('market.') || key.startsWith('trials.')) return 'market';
  if (key.startsWith('fighter.')) return 'development';
  return 'league';
}

function humanize(key: string): string {
  const s = key.replace(/[._-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** What a template can name beyond the item's own params (names, money). */
export interface DigestNames {
  state?: GameState;
  content?: ContentDB;
}

function paramsOf(item: NewsItem, names: DigestNames = {}): Record<string, string | number> {
  const p: Record<string, string | number> = { ...item.params };
  if (item.refs.fixtureId) p['fixtureId'] = item.refs.fixtureId;
  if (item.refs.fighterId) {
    p['fighterId'] = item.refs.fighterId;
    p['fighter'] = (names.state && personName(names.state, item.refs.fighterId)?.full) ?? 'A fighter';
  }
  if (item.refs.otherClubId) p['otherClub'] = names.state?.clubs[item.refs.otherClubId]?.name ?? 'another club';
  if (p['weeksOut'] !== undefined) p['weeks'] = p['weeksOut'];
  if (typeof p['severity'] === 'string') {
    const id = p['severity'];
    p['severity'] = names.content?.development.injury.severityLadder.find((x) => x.id === id)?.label ?? `${capitalize(id)} injury`;
  }
  if (item.key === 'captain.interim') p['interimReason'] = interimReasonText(p['reason']);
  if (typeof p['traitId'] === 'string') p['trait'] = names.content?.traits.get(p['traitId'])?.name ?? String(p['traitId']);
  for (const k of ['wage', 'counterWage', 'amount', 'registryDebt'] as const) if (typeof p[k] === 'number') p[k] = formatMoney(p[k], k === 'wage' || k === 'counterWage' ? { perWeek: true } : {});
  if (p['won'] !== undefined && p['result'] === undefined) p['result'] = Number(p['won']) ? 'Won' : 'Lost';
  // Score from our side ("2–1"), from explicit for/against or home/away params.
  if (p['score'] === undefined && p['for'] !== undefined && p['against'] !== undefined) p['score'] = `${p['for']}–${p['against']}`;
  if (p['score'] === undefined && p['home'] !== undefined && p['away'] !== undefined) p['score'] = `${p['home']}–${p['away']}`;
  return p;
}

/** Why core/game named an interim captain (GAME_NEWS_KEYS.captainInterim params.reason). */
function interimReasonText(reason: string | number | undefined): string {
  if (reason === 'vice') return 'Your club had no captain at kickoff, so the vice-captain took the armband.';
  if (reason === 'starter') return 'Your club had no captain at kickoff, so the fit starter with the best captaincy took the armband.';
  return 'Your captain left the club, so the club named a stand-in.';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** An injury needs action only while the fighter is in the lineup and still out. */
function injuryNeedsAction(item: NewsItem, state: GameState | undefined): boolean {
  if (!state || !item.refs.fighterId) return true;
  const f = state.fighters[item.refs.fighterId];
  const club = f?.clubId ? state.clubs[f.clubId] : undefined;
  return !!f?.injury && f.injury.weeksOut > 0 && !!club?.lineup.fighters.some((e) => e.fighterId === f.id);
}

export function newsToDigest(item: NewsItem, names: DigestNames = {}): DigestItem {
  const tpl = TEMPLATES[item.key];
  const p = paramsOf(item, names);
  const needsAction = item.key === 'fighter.injured' ? injuryNeedsAction(item, names.state) : item.importance === 'urgent' || (tpl?.needsAction ?? false);
  return {
    id: item.id,
    kind: tpl?.kind ?? kindOfKey(item.key),
    title: tpl ? format(tpl.title, p) : humanize(item.key),
    text: tpl?.text ? format(tpl.text, p) : '',
    needsAction,
    unread: !item.read,
    action: tpl?.action ? { label: tpl.action[0], href: format(tpl.action[1], p) } : undefined,
    newsIds: [item.id],
  };
}

function blockerToDigest(b: Blocker, i: number, state: GameState): DigestItem {
  return {
    id: `blocker-${i}-${b.code}`,
    kind: b.code.startsWith('roster.') ? 'contract' : 'medical',
    title: blockerText(b, state),
    text: 'Continue is blocked until this is decided.',
    needsAction: true,
    unread: true,
    action: { label: 'Decide', href: blockerTarget(b.code) },
    newsIds: [],
  };
}

const ORDER: Record<DigestKind, number> = { medical: 2, contract: 2, result: 3, development: 4, market: 5, league: 6 };

/** This week's digest for a club: blockers first, then news of the last processed week and this week. */
export function buildDigest(state: GameState, content: ContentDB, clubId: ClubId, blockers: readonly Blocker[]): DigestItem[] {
  const recentWeek = state.calendar.weekIndex - 1;
  const news = state.news.filter(
    (n) => (n.clubId === clubId || n.clubId === null) && n.at.season === state.calendar.season && n.at.weekIndex >= recentWeek,
  );
  const items = [...distinctBlockers(blockers.filter((b) => b.code !== 'phase.season-end')).map((b, i) => blockerToDigest(b, i, state)), ...news.map((n) => newsToDigest(n, { state, content }))];
  const rank = (d: DigestItem, i: number) => (d.id.startsWith('blocker-') ? 0 : d.needsAction ? 1 : ORDER[d.kind]) * 1000 + i;
  const sorted = items.map((d, i) => ({ d, r: rank(d, i) })).sort((a, b) => a.r - b.r).map((x) => x.d);
  // Notification budget: at most 2 "Needs action" (extra ones stay listed without the tag), at most 6 items.
  let flagged = 0;
  const capped = sorted.map((d) => {
    if (d.needsAction && flagged < NEEDS_ACTION_LIMIT) {
      flagged += 1;
      return d;
    }
    return d.needsAction ? { ...d, needsAction: false } : d;
  });
  if (capped.length <= DIGEST_LIMIT) return capped;
  // Group the overflow into one routine item.
  const head = capped.slice(0, DIGEST_LIMIT - 1);
  const rest = capped.slice(DIGEST_LIMIT - 1);
  head.push({
    id: 'grouped',
    kind: 'league',
    title: `${rest.length} more updates this week`,
    text: rest.map((d) => d.title).join(' · '),
    needsAction: false,
    unread: rest.some((d) => d.unread),
    newsIds: rest.flatMap((d) => d.newsIds),
  });
  return head;
}

export function needsActionCount(items: readonly DigestItem[]): number {
  return items.filter((d) => d.needsAction).length;
}
