/**
 * Club identity: crest (asset-002) and names. Colours come from clubs.json
 * (Club.colors). Rule for implementers (04 asset-002): when both crest
 * colours are very light or both very dark, swap the rim so the shield keeps
 * its outline.
 */
import type { ComponentChildren, JSX } from 'preact';
import type { ContentDB } from '../../../../core/content';
import type { Club, ClubId, GameState } from '../../../../core/model';

export type CrestSize = 'sm' | 'xs' | 'md' | 'lg' | 'xl';

/** Relative luminance (WCAG) of "#rrggbb"; 0.5 for anything unparseable. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** Inline custom properties for `.crest`. */
export function crestVars(colors: { primary: string; secondary: string }): Record<string, string> {
  const a = luminance(colors.primary);
  const b = luminance(colors.secondary);
  const vars: Record<string, string> = { '--crest-a': colors.primary, '--crest-b': colors.secondary };
  if (a > 0.6 && b > 0.6) vars['--crest-rim'] = 'rgba(29, 28, 25, 0.7)';
  else if (a < 0.05 && b < 0.05) vars['--crest-rim'] = 'rgba(235, 230, 218, 0.85)';
  return vars;
}

/** Two-letter crest code from the club name ("Thornwick Wardens" -> "TW"). */
export function crestCode(club: Pick<Club, 'name' | 'code'>): string {
  const words = club.name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return club.code.slice(0, 2).toUpperCase();
}

export function Crest({ club, size }: { club: Pick<Club, 'name' | 'code' | 'colors'> | null | undefined; size?: CrestSize }) {
  const cls = size && size !== 'xs' ? `crest crest--${size}` : 'crest';
  if (!club) return <span class={cls} aria-hidden="true" />;
  return (
    <span class={cls} style={crestVars(club.colors) as JSX.CSSProperties} aria-hidden="true">
      {size === 'sm' ? null : crestCode(club)}
    </span>
  );
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
      <span class="entity__name">{label}</span>
      {children}
    </span>
  );
}

/** City and arena from clubs.json (the engine Club has no venue fields). */
export function clubVenue(content: ContentDB, id: ClubId): { city: string; arena: string } | null {
  const t = content.clubs.get(id);
  return t ? { city: t.city, arena: t.arena } : null;
}
