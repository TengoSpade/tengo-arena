/**
 * Club identity: crest (asset-002) and names. Colours come from clubs.json
 * (Club.colors). Rule for implementers (04 asset-002): when both crest
 * colours are very light or both very dark, swap the rim so the shield keeps
 * its outline.
 */
import type { ComponentChildren } from 'preact';
import type { ContentDB } from '../../../../core/content';
import type { Club, ClubId, GameState } from '../../../../core/model';
import * as C from '../../../components';

export type CrestSize = 'sm' | 'xs' | 'md' | 'lg' | 'xl';

/** Two-letter crest code (shared rule in components/marks). */
export const crestCode = C.crestLetters;

export function Crest({ club, size }: { club: Pick<Club, 'name' | 'code' | 'colors'> | null | undefined; size?: CrestSize }) {
  const sz = size === 'xs' ? undefined : size;
  if (!club) return <span class={sz ? `crest crest--${sz}` : 'crest'} aria-hidden="true" />;
  return <C.Crest primary={club.colors.primary} secondary={club.colors.secondary} code={crestCode(club)} size={sz} />;
}

export function clubOf(state: GameState, id: ClubId | null | undefined): Club | null {
  if (!id) return null;
  return state.clubs[id] ?? null;
}

/** Short name for dense places (tables, bracket); falls back to the id. */
export function clubShort(state: GameState, id: ClubId | null | undefined): string {
  const club = clubOf(state, id);
  return club ? club.shortName : String(id ?? '');
}

export function clubName(state: GameState, id: ClubId | null | undefined): string {
  const club = clubOf(state, id);
  return club ? club.name : String(id ?? '');
}

/** Crest + name, the `.entity` pattern used in standings and fixtures. */
export function ClubEntity({
  state,
  clubId,
  short = false,
  size,
  children,
}: {
  state: GameState;
  clubId: ClubId;
  short?: boolean;
  size?: CrestSize;
  children?: ComponentChildren;
}) {
  const club = clubOf(state, clubId);
  const label = short ? clubShort(state, clubId) : clubName(state, clubId);
  return (
    <span class="entity" data-tip={club && short ? club.name : undefined}>
      <Crest club={club} size={size} />
      <span class="entity__name" {...(short ? {} : C.overflowTipAttrs(label))}>
        {label}
      </span>
      {children}
    </span>
  );
}

/** City and arena from clubs.json (the engine Club has no venue fields). */
export function clubVenue(content: ContentDB, id: ClubId): { city: string; arena: string } | null {
  const t = content.clubs.get(id);
  return t ? { city: t.city, arena: t.arena } : null;
}
