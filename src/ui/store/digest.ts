/**
 * The weekly digest ("This week" on Home, the top-bar bell, the Home nav
 * badge). Notification budget (04 §6.2, OC-7, PROPOSED · TUNABLE): at most
 * 6 items, at most 2 "Needs action", ordered blockers, needs action, our
 * result, squad changes, market, league; routine items are grouped.
 * Sources: getBlockers() and the core news items (NewsItem.key + params;
 * core stores no prose, the UI text table renders it).
 */
import type { ContentDB } from '../../core/content';
import type { Blocker, ClubId, GameState, NewsId, NewsItem } from '../../core/model';
import { format } from '../text';
import { blockerTarget } from './digest-targets';
import { blockerText } from './messages';

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

/** News key -> how the digest shows it. Unknown keys get a readable fallback. */
const TEMPLATES: Record<string, { kind: DigestKind; title: string; text?: string; action?: [string, string]; needsAction?: boolean }> = {
  'fighter.injured': { kind: 'medical', title: '{fighter} is out for {weeks} wk', text: 'Check the lineup before the next match.', action: ['Review lineup', '#/squad'], needsAction: true },
  'fighter.recovered': { kind: 'medical', title: '{fighter} is fit again', action: ['Squad', '#/squad'] },
  'contract.expiring': { kind: 'contract', title: '{count} contracts end this season', text: 'Unrenewed fighters leave at season end. Renewal opens in the final contract season.', action: ['Squad', '#/squad'], needsAction: true },
  'match.result': { kind: 'result', title: '{result} {home}–{away} against {opponent}', action: ['Report', '#/match/{fixtureId}'] },
  'offer.accepted': { kind: 'market', title: '{fighter} accepted your offer', action: ['Squad', '#/squad'] },
  'offer.refused': { kind: 'market', title: '{fighter} refused your offer', action: ['Market', '#/market'] },
  'offer.countered': { kind: 'market', title: '{fighter} countered your offer', action: ['Market', '#/market'], needsAction: true },
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

function paramsOf(item: NewsItem): Record<string, string | number> {
  const p: Record<string, string | number> = { ...item.params };
  if (item.refs.fixtureId) p['fixtureId'] = item.refs.fixtureId;
  if (item.refs.fighterId) p['fighterId'] = item.refs.fighterId;
  if (p['won'] !== undefined && p['result'] === undefined) p['result'] = Number(p['won']) ? 'Won' : 'Lost';
  return p;
}

export function newsToDigest(item: NewsItem): DigestItem {
  const tpl = TEMPLATES[item.key];
  const p = paramsOf(item);
  const needsAction = item.importance === 'urgent' || (tpl?.needsAction ?? false);
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

function blockerToDigest(b: Blocker, i: number): DigestItem {
  return {
    id: `blocker-${i}-${b.code}`,
    kind: b.code.startsWith('roster.') ? 'contract' : 'medical',
    title: blockerText(b),
    text: 'Continue is blocked until this is decided.',
    needsAction: true,
    unread: true,
    action: { label: 'Decide', href: blockerTarget(b.code) },
    newsIds: [],
  };
}

const ORDER: Record<DigestKind, number> = { medical: 2, contract: 2, result: 3, development: 4, market: 5, league: 6 };

/** This week's digest for a club: blockers first, then news of the last processed week and this week. */
export function buildDigest(state: GameState, _content: ContentDB, clubId: ClubId, blockers: readonly Blocker[]): DigestItem[] {
  const recentWeek = state.calendar.weekIndex - 1;
  const news = state.news.filter(
    (n) => (n.clubId === clubId || n.clubId === null) && n.at.season === state.calendar.season && n.at.weekIndex >= recentWeek,
  );
  const items = [...blockers.filter((b) => b.code !== 'phase.season-end').map(blockerToDigest), ...news.map(newsToDigest)];
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
