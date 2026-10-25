/**
 * The marks the app frame needs at start (club crest, empty and callout states). Kept apart from
 * marks.tsx so the screen-only marks load with the screens (05 bundle budget); marks.tsx re-exports them.
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon, type IconName } from './Icon';
import { tipAttrs, type Tip } from './Tooltip';

type CssVars = JSX.CSSProperties & Record<string, string | number>;

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
