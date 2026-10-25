/**
 * Small display primitives over the designer's classes: crests, portraits,
 * role glyphs, rating pills, stars, trait badges, row marks, meters, form
 * strips, deltas, chips, segmented controls, empty states and callouts.
 * No game logic: callers pass content-derived values.
 */
import type { ComponentChildren, JSX } from 'preact';
import { formatInt, potentialStars, ratingBand, starsLabel } from '../format';
import { t } from '../text';
import { Icon, type IconName } from './Icon';
import { tipAttrs, type Tip } from './Tooltip';

type CssVars = JSX.CSSProperties & Record<string, string | number>;

// ---- Crest (asset-002) ------------------------------------------------------------------------------

/** Relative luminance of "#rrggbb" (0..1). */
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

/**
 * The crest's two letters (04 asset-002: "a 2-letter code in the display
 * face"): the initials of the first two words of the club name, else the
 * first two letters of the clubs.json code. One rule for every screen.
 */
export function crestLetters(club: { name: string; code: string }): string {
  const words = club.name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return club.code.slice(0, 2).toUpperCase();
}

export interface CrestProps {
  primary: string;
  secondary: string;
  /** Club code; letters hide below 1.6 rem (size sm). */
  code?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  tip?: Tip;
}

export function Crest({ primary, secondary, code, size, label, tip }: CrestProps) {
  const style: CssVars = { '--crest-a': primary, '--crest-b': secondary };
  // 04 asset-002: two very light (or two very dark) colours need a contrasting rim.
  const la = luminance(primary);
  const lb = luminance(secondary);
  if (la > 0.6 && lb > 0.6) style['--crest-rim'] = 'rgba(29, 28, 25, 0.6)';
  else if (la < 0.04 && lb < 0.04) style['--crest-rim'] = 'rgba(235, 230, 218, 0.75)';
  return (
    <span
      class={`crest${size ? ` crest--${size}` : ''}`}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      {...tipAttrs(tip)}
    >
      {size && size !== 'sm' ? code : null}
    </span>
  );
}

// ---- Portrait (asset-001) -------------------------------------------------------------------------------

export interface PortraitProps {
  /** Archetype id (data-role). */
  role?: string;
  /** Race id (data-race); races without a bust fall back to the human bust. */
  race?: string;
  size?: 'xs' | 'sm' | 'lg';
  injured?: boolean;
  label?: string;
}

export function Portrait({ role, race, size, injured, label }: PortraitProps) {
  const cls = ['portrait', size ? `portrait--${size}` : '', injured ? 'is-injured' : ''].filter(Boolean).join(' ');
  return (
    <span
      class={cls}
      data-role={role}
      data-race={race}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    />
  );
}

// ---- Roles (D-J: shape first, colour second, label always available) --------------------------------

export function RoleGlyph({ role, size, tip, label }: { role: string; size?: 'lg' | 'xl'; tip?: Tip; label?: string }) {
  return (
    <i
      class={`role-glyph${size ? ` role-glyph--${size}` : ''}`}
      data-role={role}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      {...tipAttrs(tip)}
    />
  );
}

export function RoleBadge({ role, name, tip }: { role: string; name: string; tip?: Tip }) {
  return (
    <span class="role-badge" data-role={role} {...tipAttrs(tip)}>
      <i class="role-glyph" aria-hidden="true" />
      {name}
    </span>
  );
}

// ---- Rating and potential ------------------------------------------------------------------------------

export function Rating({ value, size, tip, focusable }: { value: number; size?: 'lg'; tip?: Tip; focusable?: boolean }) {
  return (
    <span class={`rating${size ? ` rating--${size}` : ''}`} data-band={ratingBand(value)} tabIndex={focusable ? 0 : undefined} {...tipAttrs(tip)}>
      {value}
    </span>
  );
}

/** Potential as stars (potential ÷ 20 in half stars); the number lives in the tooltip. */
export function Stars({ potential, tip }: { potential: number; tip?: Tip }) {
  const stars = potentialStars(potential);
  const items: ('full' | 'half' | 'empty')[] = [];
  for (let i = 1; i <= 5; i++) items.push(stars >= i ? 'full' : stars >= i - 0.5 ? 'half' : 'empty');
  return (
    <span
      class="stars"
      role="img"
      aria-label={t('fighter.potentialAria', { value: potential, stars: starsLabel(stars) })}
      {...tipAttrs(tip ?? t('fighter.potentialAria', { value: potential, stars: starsLabel(stars) }))}
    >
      {items.map((kind, i) => (
        <i key={i} class={kind === 'full' ? 'star' : `star star--${kind}`} />
      ))}
    </span>
  );
}

// ---- Traits (asset-004; CK-style) -----------------------------------------------------------------------

export type TraitPolarity = 'pos' | 'neg' | 'rare';

/** 04 Notes: negative -> neg; storied (or rare positive) -> rare; otherwise pos. */
export function traitPolarity(trait: { polarity: string; rarity: string }): TraitPolarity {
  if (trait.polarity === 'negative') return 'neg';
  if (trait.rarity === 'storied' || trait.rarity === 'rare') return 'rare';
  return 'pos';
}

const POLARITY_SR = { pos: 'trait.positive', neg: 'trait.negative', rare: 'trait.storied' } as const;

export function TraitBadge({ name, polarity, tip }: { name: string; polarity: TraitPolarity; tip?: Tip }) {
  const cls = polarity === 'neg' ? 'trait trait--neg' : polarity === 'rare' ? 'trait trait--rare' : 'trait';
  return (
    <span class={cls} tabIndex={0} {...tipAttrs(tip)}>
      <span class="trait__icon" aria-hidden="true" />
      <span class="u-sr-only">{t(POLARITY_SR[polarity])}</span>
      {name}
    </span>
  );
}

export function TraitDots({ traits }: { traits: readonly { id: string; polarity: TraitPolarity; tip: Tip }[] }) {
  if (traits.length === 0) return <span class="u-faint">{t('common.none')}</span>;
  return (
    <span class="trait-dots">
      {traits.map((tr) => (
        <span key={tr.id} class="trait__icon" data-polarity={tr.polarity} {...tipAttrs(tr.tip)} />
      ))}
    </span>
  );
}

// ---- Captaincy and rows ------------------------------------------------------------------------------------

export function CaptainMark({ tip }: { tip?: Tip }) {
  return (
    <span class="captain-mark" {...tipAttrs(tip ?? t('fighter.captain'))}>
      <span class="u-sr-only">{t('fighter.captain')}</span>
    </span>
  );
}

export function ViceCaptainTag({ tip }: { tip?: Tip }) {
  return (
    <span class="tag tag--outline" {...tipAttrs(tip ?? t('fighter.viceCaptainTip'))}>
      {t('fighter.viceCaptainShort')}
    </span>
  );
}

/** Starting row mark: Front filled, Back outlined, Reserve faint (data-row="bench" = 01 "reserve"). */
export function RowMark({ row, label, tip }: { row: 'front' | 'back' | 'bench'; label?: string; tip?: Tip }) {
  const text = label ?? (row === 'front' ? t('lineup.front') : row === 'back' ? t('lineup.back') : t('lineup.reserve'));
  return (
    <span class="row-mark" data-row={row} {...tipAttrs(tip)}>
      {text}
    </span>
  );
}

// ---- Meters ---------------------------------------------------------------------------------------------------

/** Roster cap: one cell per place (`reserved` = pending offers). */
export function CapMeter({ used, cap, reserved = 0 }: { used: number; cap: number; reserved?: number }) {
  const cells = [];
  for (let i = 0; i < Math.max(cap, used + reserved); i++) {
    const cls = i < used ? 'is-on' : i < used + reserved ? 'is-reserved' : undefined;
    cells.push(<i key={i} class={cls} />);
  }
  return (
    <span class="capmeter" aria-hidden="true">
      {cells}
    </span>
  );
}

export function Meter({ value, mark, state, thin }: { value: number; mark?: number; state?: 'good' | 'warn' | 'bad'; thin?: boolean }) {
  const style: CssVars = { '--v': Math.max(0, Math.min(1, value)) };
  return (
    <div class={`meter${thin ? ' meter--thin' : ''}`} style={style} data-state={state}>
      <div class="meter__fill" />
      {mark !== undefined && <div class="meter__mark" style={{ '--at': Math.max(0, Math.min(1, mark)) } as CssVars} />}
    </div>
  );
}

export function Progress({ value, from, tip }: { value: number; from?: number; tip?: Tip }) {
  const style: CssVars = { '--v': Math.max(0, Math.min(1, value)) };
  if (from !== undefined) style['--from'] = Math.max(0, Math.min(1, from));
  return (
    <div class="progress" style={style} {...tipAttrs(tip)}>
      <div class="progress__fill" />
      {from !== undefined && <div class="progress__gain" />}
    </div>
  );
}

/** Last results, W / L letters carry the meaning. */
export function FormStrip({ results, label }: { results: readonly { r: 'W' | 'L' | '-'; tip?: Tip }[]; label?: string }) {
  return (
    <span class="form" aria-label={label}>
      {results.map((x, i) => (
        <i key={i} class="form__r" data-r={x.r} {...tipAttrs(x.tip)}>
          {x.r === '-' ? '' : x.r}
        </i>
      ))}
    </span>
  );
}

/** Signed change with an arrow; the number is shown without its sign (the arrow carries it). */
/**
 * A signed change with an arrow. `format` renders the magnitude (default: grouped integer), so money
 * deltas read "▲ 7,000 ts" rather than a raw number.
 */
export function Delta({ value, tip, format = formatInt }: { value: number; tip?: Tip; format?: (abs: number) => string }) {
  const kind = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return (
    <span class={`delta delta--${kind}`} {...tipAttrs(tip)}>
      <span class="u-sr-only">{value > 0 ? '+' : value < 0 ? '−' : ''}</span>
      {format(Math.abs(value))}
    </span>
  );
}

/** n of max as pips (class complexity): the label carries the number for screen readers and the tip. */
export function Pips({ value, max, label, tip }: { value: number; max: number; label: string; tip?: Tip }) {
  return (
    <span class="pips" role="img" aria-label={label} tabIndex={tip ? 0 : undefined} {...tipAttrs(tip ?? label)}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} class={i < value ? 'pips__pip pips__pip--on' : 'pips__pip'} />
      ))}
    </span>
  );
}

// ---- Controls ---------------------------------------------------------------------------------------------------

export interface SegmentedOption<T extends string> {
  id: T;
  label: ComponentChildren;
  tip?: Tip;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div class="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value ? 'true' : 'false'} onClick={() => onChange(o.id)} {...tipAttrs(o.tip)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ pressed, onClick, count, children, tip }: { pressed: boolean; onClick: () => void; count?: number; children: ComponentChildren; tip?: Tip }) {
  return (
    <button class="chip" type="button" aria-pressed={pressed ? 'true' : 'false'} onClick={onClick} {...tipAttrs(tip)}>
      {children}
      {count !== undefined && <span class="chip__count">{count}</span>}
    </button>
  );
}

export function Kbd({ children }: { children: ComponentChildren }) {
  return <kbd>{children}</kbd>;
}

// ---- Empty states and callouts --------------------------------------------------------------------------------

export function Empty({ icon, title, text, actions, compact }: { icon?: IconName; title: ComponentChildren; text?: ComponentChildren; actions?: ComponentChildren; compact?: boolean }) {
  return (
    <div class={`empty${compact ? ' empty--compact' : ''}`}>
      {icon && (
        <span class="empty__icon">
          <Icon name={icon} />
        </span>
      )}
      <span class="empty__title">{title}</span>
      {text && <span class="empty__text">{text}</span>}
      {actions && <div class="empty__actions">{actions}</div>}
    </div>
  );
}

export function Callout({ kind, icon, title, children }: { kind?: 'warn' | 'bad' | 'good' | 'info'; icon?: IconName; title?: ComponentChildren; children?: ComponentChildren }) {
  const fallback: IconName = kind === 'good' ? 'check' : kind === 'info' || !kind ? 'info' : 'warning';
  return (
    <div class={`callout${kind && kind !== 'info' ? ` callout--${kind}` : ''}`} role="note">
      <Icon name={icon ?? fallback} />
      <div>
        {title && <div class="callout__title">{title}</div>}
        {children && <div class="callout__text">{children}</div>}
      </div>
    </div>
  );
}
