/**
 * Squad, M1.1 match squad (WP-D; combat-skills.md sys-match "Squad legality", progression.md
 * sys-freshness "Player information"): the two match reserves beside the five, with Freshness and the
 * roles they cover, and the quick-rotate suggestions (rest a tired starter for a fresh fighter of the
 * same role family; name the reserves).
 */
import type { ContentDB } from '../../../core/content';
import type { Club, Command, Fighter, FighterId, GameState, LineupEntry } from '../../../core/model';
import { Icon, Kbd, RoleGlyph, Tag, tipAttrs } from '../../components';
import { runUndoable } from '../../store/actions';
import { freshInfo, type FreshInfo } from '../../m11/model';
import { FreshMeter } from '../../m11/parts';
import type { GameStore } from '../../store';
import type { GameEngine } from '../../store/engine';
import { fighterViewOf } from '../../store/views';
import { format } from '../../text';
import { T } from './text';

export const RESERVES_MAX = 2;
const MAX_RATING_GAP = 6;

export function squadCommand(club: Club, fighters: LineupEntry[], reserves: FighterId[]): Command {
  const keep = club.lineup.matchCaptainId && fighters.some((e) => e.fighterId === club.lineup.matchCaptainId) ? club.lineup.matchCaptainId : null;
  return { type: 'squad.set', clubId: club.id, fighters, reserves, matchCaptainId: keep };
}

/**
 * Name (or drop) a fighter as a match reserve. With both places taken, the one named longest ago goes back
 * to the bench: no question to answer, and the toast says who was dropped with Undo (Ctrl Z) to bring him back.
 */
export function toggleReserve(store: GameStore, state: GameState, club: Club, id: FighterId): boolean {
  if (club.lineup.fighters.some((e) => e.fighterId === id)) return false;
  const now = club.lineup.reserves ?? [];
  const adding = !now.includes(id);
  const full = adding && now.length >= RESERVES_MAX;
  const dropped = full ? now[0]! : null;
  const next = !adding ? now.filter((x) => x !== id) : full ? [...now.slice(1), id] : [...now, id];
  const nameOf = (x: FighterId) => state.fighters[x]?.name.full ?? x;
  const title = adding ? format(T.reserveOn, { name: nameOf(id) }) : format(T.reserveOff, { name: nameOf(id) });
  const sub = dropped ? format(T.reserveDropped, { name: nameOf(dropped), max: RESERVES_MAX }) : undefined;
  const fighters = club.lineup.fighters.map((e) => ({ ...e }));
  return runUndoable(store, squadCommand(club, fighters, next), squadCommand(club, fighters, [...now]), title, sub);
}

/**
 * Auto-pick (M1.1): core suggests a squad.set (the five, reserves, captain). When it names no
 * reserves, keep the current ones still on the bench and fit, then top up from suggestReserves.
 */
export function applySuggestedSquad(store: GameStore, state: GameState, content: ContentDB, engine: GameEngine, club: Club, cmd: Extract<Command, { type: 'squad.set' }>, title: string): boolean {
  const five = new Set(cmd.fighters.map((e) => e.fighterId as string));
  let reserves = [...cmd.reserves];
  if (reserves.length === 0) {
    reserves = (club.lineup.reserves ?? []).filter((id) => !five.has(id) && state.fighters[id] && fit(engine, state.fighters[id]!));
    const draft: Club = { ...club, lineup: { ...club.lineup, fighters: cmd.fighters, reserves } };
    for (const id of suggestReserves(state, content, engine, draft)) if (reserves.length < RESERVES_MAX && !reserves.includes(id)) reserves.push(id);
  }
  const before = squadCommand(club, club.lineup.fighters.map((e) => ({ ...e })), [...(club.lineup.reserves ?? [])]);
  return runUndoable(store, { ...cmd, reserves }, before, title);
}

const rolesOf = (content: ContentDB, f: Fighter | undefined) => [...(content.classes.get(f?.classId ?? '')?.archetypes ?? [])] as string[];
const fit = (engine: GameEngine, f: Fighter) => {
  try {
    return engine.isFit(f);
  } catch {
    return !(f.injury && f.injury.weeksOut > 0);
  }
};

export interface RotationTip {
  out: FighterId;
  in: FighterId;
  outFresh: FreshInfo;
  inFresh: FreshInfo;
  row: 'front' | 'back';
}

/**
 * Quick-rotate suggestions: each starter who would start a round of this match Tired or worse (now, or
 * after one typical round) gets the best fit, fresher (≥ 80) bench fighter of a shared role, within 6
 * rating. Same family as the AI's rotation (levels.json aiRotation), as a suggestion.
 */
export function rotationTips(state: GameState, content: ContentDB, engine: GameEngine, club: Club): RotationTip[] {
  const out: RotationTip[] = [];
  const used = new Set<string>();
  const roster = Object.values(state.fighters).filter((f) => f.clubId === club.id && f.status === 'active');
  const starters = new Set(club.lineup.fighters.map((e) => e.fighterId as string));
  const reserves = new Set((club.lineup.reserves ?? []).map((id) => id as string));
  const rating = (f: Fighter) => fighterViewOf(engine, state, content, f.id)?.rating ?? 0;
  for (const e of club.lineup.fighters) {
    const f = state.fighters[e.fighterId];
    if (!f || !fit(engine, f)) continue;
    const info = freshInfo(engine, state, content, f);
    if (info.value - info.drain >= info.threshold) continue;
    const roles = rolesOf(content, f);
    const pick = roster
      .filter((c) => !starters.has(c.id) && !used.has(c.id) && fit(engine, c) && rolesOf(content, c).some((r) => roles.includes(r)))
      .map((c) => ({ c, fresh: freshInfo(engine, state, content, c), r: rating(c), reserve: reserves.has(c.id) ? 1 : 0 }))
      .filter((x) => x.fresh.value >= 80 && x.r >= rating(f) - MAX_RATING_GAP)
      // Bench fighters first: taking a match reserve into the five leaves his reserve place empty.
      .sort((a, b) => a.reserve - b.reserve || b.r - a.r || b.fresh.value - a.fresh.value)[0];
    if (!pick) continue;
    used.add(pick.c.id);
    out.push({ out: f.id, in: pick.c.id, outFresh: info, inFresh: pick.fresh, row: e.row });
  }
  return out;
}

/** Two fresh, fit bench fighters for the match reserves: one per row type, roles the five lack first. */
export function suggestReserves(state: GameState, content: ContentDB, engine: GameEngine, club: Club): FighterId[] {
  const starters = new Set(club.lineup.fighters.map((e) => e.fighterId as string));
  const needed = new Set(club.lineup.fighters.flatMap((e) => rolesOf(content, state.fighters[e.fighterId])));
  const bench = Object.values(state.fighters)
    .filter((f) => f.clubId === club.id && f.status === 'active' && !starters.has(f.id) && fit(engine, f))
    .map((f) => ({ f, fresh: freshInfo(engine, state, content, f).value, r: fighterViewOf(engine, state, content, f.id)?.rating ?? 0, cover: rolesOf(content, f).filter((r) => needed.has(r)).length }))
    .filter((x) => x.fresh >= 60)
    .sort((a, b) => b.cover - a.cover || b.r - a.r || b.fresh - a.fresh);
  return bench.slice(0, RESERVES_MAX).map((x) => x.f.id);
}

export function ReservesZone(props: {
  state: GameState;
  content: ContentDB;
  engine: GameEngine;
  club: Club;
  store: GameStore;
  selected: FighterId | null;
  onSelect: (id: FighterId) => void;
  dragId: FighterId | null;
  setDragId: (id: FighterId | null) => void;
}) {
  const { state, content, engine, club, store } = props;
  const reserves = (club.lineup.reserves ?? []).map((id) => state.fighters[id]).filter((f): f is Fighter => !!f);
  const fiveRoles = new Set(club.lineup.fighters.flatMap((e) => rolesOf(content, state.fighters[e.fighterId])));
  const covered = new Set(reserves.flatMap((f) => rolesOf(content, f)));
  const uncovered = [...fiveRoles].filter((r) => !covered.has(r));
  const roleName = (id: string) => content.vocabulary.roles.find((r) => r.id === id)?.name ?? id;
  const suggestion = reserves.length < RESERVES_MAX ? suggestReserves(state, content, engine, club) : [];
  return (
    <div
      class={`lineup__row lineup__reserves${props.dragId ? ' is-drop-target' : ''}`}
      aria-label={T.matchReserves}
      data-testid="match-reserves"
      onDragOver={(e) => {
        if (props.dragId) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (props.dragId) toggleReserve(store, state, club, props.dragId);
        props.setDragId(null);
      }}
    >
      <div class="lineup__row-label" {...tipAttrs(T.matchReservesTip)}>
        <span>{T.matchReserves}</span>
        <span class="u-faint">
          {reserves.length}/{RESERVES_MAX}
        </span>
      </div>
      <div class="reserves">
        {reserves.map((f) => {
          const info = freshInfo(engine, state, content, f);
          const rating = fighterViewOf(engine, state, content, f.id)?.rating ?? null;
          return (
            <article
              key={f.id}
              class="reserve-card"
              tabIndex={0}
              aria-selected={props.selected === f.id ? 'true' : 'false'}
              draggable
              onDragStart={(e) => {
                e.dataTransfer?.setData('text/plain', f.id);
                props.setDragId(f.id);
              }}
              onDragEnd={() => props.setDragId(null)}
              onClick={() => props.onSelect(f.id)}
              onFocus={(e) => {
                if (e.target === e.currentTarget) props.onSelect(f.id);
              }}
              data-testid={`reserve-card-${f.id}`}
            >
              <span class="reserve-card__name">{f.name.full}</span>
              <span class="reserve-card__meta u-xs u-muted">
                {content.classes.get(f.classId)?.name}
                {rating !== null && (
                  <span {...tipAttrs(T.reserveRatingTip)}>
                    {' '}
                    · {rating}
                  </span>
                )}
              </span>
              <FreshMeter info={info} content={content} label />
              <button class="btn btn--sm btn--ghost btn--icon reserve-card__drop" type="button" aria-label={format(T.reserveOff, { name: f.name.full })} onClick={(e) => {
                e.stopPropagation();
                toggleReserve(store, state, club, f.id);
              }}>
                <Icon name="close" />
              </button>
            </article>
          );
        })}
        {Array.from({ length: RESERVES_MAX - reserves.length }, (_, i) => (
          <article key={`empty-${i}`} class="reserve-card reserve-card--empty">
            <span class="u-xs">
              {T.reserveEmpty} <Kbd>M</Kbd>
            </span>
          </article>
        ))}
        <div class="reserves__cover u-xs" data-testid="reserves-cover" {...tipAttrs(T.coverTip)}>
          {[...covered].map((r) => (
            <RoleGlyph key={r} role={r} label={roleName(r)} />
          ))}
          <span class="u-muted">{covered.size ? format(T.coverRoles, { roles: [...covered].map(roleName).join(', ') }) : T.coverNone}</span>
          {uncovered.length > 0 && <span class="u-warn">{format(T.coverMissing, { roles: uncovered.map(roleName).join(', ') })}</span>}
        </div>
        {suggestion.length > 0 && (
          <button
            class="btn btn--sm"
            type="button"
            data-testid="suggest-reserves"
            onClick={() => {
              const fighters = club.lineup.fighters.map((e) => ({ ...e }));
              runUndoable(store, squadCommand(club, fighters, suggestion), squadCommand(club, fighters, [...(club.lineup.reserves ?? [])]), T.reservesNamed);
            }}
            {...tipAttrs(format(T.suggestReservesTip, { names: suggestion.map((id) => state.fighters[id]?.name.full ?? id).join(' and ') }))}
          >
            {format(T.suggestReserves, { names: suggestion.map((id) => state.fighters[id]?.name.given ?? id).join(' + ') })}
          </button>
        )}
      </div>
    </div>
  );
}

export function RotationStrip({ tips, state, onRotate }: { tips: RotationTip[]; state: GameState; onRotate: (tip: RotationTip) => void }) {
  if (tips.length === 0) return null;
  return (
    <div class="rotation" data-testid="rotation-tips">
      <span class="rotation__label u-xs">
        <Icon name="refresh" size="sm" /> {T.rotate}
      </span>
      {tips.map((tip) => {
        const a = state.fighters[tip.out];
        const b = state.fighters[tip.in];
        if (!a || !b) return null;
        return (
          <button
            key={tip.out}
            class="btn btn--sm"
            type="button"
            onClick={() => onRotate(tip)}
            data-testid={`rotate-${tip.out}`}
            {...tipAttrs(format(T.rotateTip, { out: a.name.full, outF: tip.outFresh.value, label: tip.outFresh.labelText, in: b.name.full, inF: tip.inFresh.value }))}
          >
            {format(T.rotateBtn, { out: a.name.given, in: b.name.given })}{' '}
            <Tag kind={tip.outFresh.label === 'spent' ? 'bad' : 'warn'}>
              {tip.outFresh.labelText} {tip.outFresh.value}
            </Tag>
          </button>
        );
      })}
    </div>
  );
}
