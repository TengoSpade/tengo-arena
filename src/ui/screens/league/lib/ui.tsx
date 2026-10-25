/**
 * Small presentational pieces for WP7 screens, rendering the designer's
 * classes (src/ui/styles/components.css) as plain markup. WP6 owns the
 * shared component library (DataTable, Modal, Toast, FighterName, ...);
 * these stand in until it lands and are swapped for WP6 components where the
 * APIs fit (see league/README.md).
 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContentDB } from '../../../../core/content';
import type { Fighter, FighterId, GameState } from '../../../../core/model';
import { ratingBand, starParts } from './bands';
import { href } from './store';
import { tc } from './text';

// ---- roles, portraits, classes ----------------------------------------------------------------

/** Role ids of a class (content `archetypes`: tank, melee, ranged, controller, healer). */
export function classRoles(content: ContentDB, classId: string): string[] {
  return [...(content.classes.get(classId)?.archetypes ?? [])];
}

export function Portrait({
  content,
  fighter,
  size,
  injured,
}: {
  content: ContentDB;
  fighter: Pick<Fighter, 'classId' | 'raceId' | 'injury'> | null;
  size?: 'xs' | 'sm' | 'lg';
  injured?: boolean;
}) {
  const role = fighter ? classRoles(content, fighter.classId)[0] : undefined;
  const cls = ['portrait', size ? `portrait--${size}` : '', injured ?? fighter?.injury ? 'is-injured' : ''].filter(Boolean).join(' ');
  return <span class={cls} data-role={role} data-race={fighter?.raceId} aria-hidden="true" />;
}

export function RoleGlyphs({ content, classId }: { content: ContentDB; classId: string }) {
  return (
    <>
      {classRoles(content, classId).map((r) => (
        <i key={r} class="role-glyph" data-role={r} aria-hidden="true" />
      ))}
    </>
  );
}

export function ClassTag({ content, classId }: { content: ContentDB; classId: string }) {
  const klass = content.classes.get(classId);
  const roles = classRoles(content, classId);
  const roleNames = roles.map((r) => content.vocabulary.roles.find((x) => x.id === r)?.name ?? r).join(' / ');
  return (
    <span class="class-tag" data-tip={`${klass?.name ?? classId} · ${roleNames}`}>
      <RoleGlyphs content={content} classId={classId} />
      {klass?.name ?? classId}
    </span>
  );
}

export function fighterName(state: GameState, id: FighterId | null | undefined): string {
  if (!id) return '';
  return state.fighters[id]?.name.full ?? String(id);
}

/** Fighter name linking to the profile (#/fighter/:id, WP6). */
export function FighterLink({ state, id, short = false }: { state: GameState; id: FighterId; short?: boolean }) {
  const f = state.fighters[id];
  const name = f ? (short ? f.name.given : f.name.full) : String(id);
  return (
    <a class="entity__name" href={href(`fighter/${encodeURIComponent(id)}`)}>
      {name}
    </a>
  );
}

// ---- numbers ---------------------------------------------------------------------------------------

export function RatingPill({ value, tip, lg }: { value: number; tip?: string; lg?: boolean }) {
  return (
    <span class={lg ? 'rating rating--lg' : 'rating'} data-band={ratingBand(value)} data-tip={tip}>
      {value}
    </span>
  );
}

export function Stars({ potential, tip }: { potential: number; tip?: string }) {
  const { full, half, empty } = starParts(potential);
  return (
    <span class="stars" data-tip={tip ?? `Potential ${potential}`} aria-label={`Potential ${potential}`}>
      {Array.from({ length: full }, (_, i) => (
        <i key={`f${i}`} class="star" />
      ))}
      {half && <i class="star star--half" />}
      {Array.from({ length: empty }, (_, i) => (
        <i key={`e${i}`} class="star star--empty" />
      ))}
    </span>
  );
}

export function TraitDots({ content, traitIds }: { content: ContentDB; traitIds: readonly string[] }) {
  if (traitIds.length === 0) return <span class="u-faint">—</span>;
  return (
    <span class="trait-dots">
      {traitIds.map((id) => {
        const t = content.traits.get(id);
        const polarity = !t ? 'pos' : t.polarity === 'negative' ? 'neg' : t.rarity === 'storied' ? 'rare' : 'pos';
        const label = t ? `${polarity === 'neg' ? 'Negative trait: ' : 'Trait: '}${t.name}. ${t.effectText ?? ''}`.trim() : id;
        return <span key={id} class="trait__icon" data-polarity={polarity} data-tip={label} aria-label={label} role="img" />;
      })}
    </span>
  );
}

/** ▲ / ▼ signed change; meaning carried by the arrow and sign, not colour alone. */
export function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  const cls = value > 0 ? 'delta delta--up' : value < 0 ? 'delta delta--down' : 'delta delta--flat';
  const text = value === 0 ? `0${suffix}` : `${Math.abs(value)}${suffix}`;
  return (
    <span class={cls} aria-label={`${value > 0 ? 'up' : value < 0 ? 'down' : 'no change'} ${Math.abs(value)}`}>
      {text}
    </span>
  );
}

export function FormStrip({ form }: { form: readonly ('W' | 'L' | '-')[] }) {
  const words = form.map((r) => (r === 'W' ? 'win' : r === 'L' ? 'loss' : 'not played')).join(', ');
  return (
    <span class="form" aria-label={`Last five: ${words || 'none'}`}>
      {form.map((r, i) => (
        <i key={i} class="form__r" data-r={r}>
          {r}
        </i>
      ))}
    </span>
  );
}

// ---- states --------------------------------------------------------------------------------------------

export function Empty({
  icon = 'info',
  title,
  text,
  children,
  compact,
}: {
  icon?: string;
  title: string;
  text?: ComponentChildren;
  children?: ComponentChildren;
  compact?: boolean;
}) {
  return (
    <div class={compact ? 'empty empty--compact' : 'empty'}>
      <span class="empty__icon">
        <span class="icon" data-icon={icon} aria-hidden="true" />
      </span>
      <div class="empty__title">{title}</div>
      {text && <div class="empty__text">{text}</div>}
      {children && <div class="empty__actions">{children}</div>}
    </div>
  );
}

/** Page-level state when no career is loaded. */
export function NoCareer({ testId }: { testId: string }) {
  return (
    <section class="page" data-testid={testId}>
      <Empty icon="load" title={tc('noCareer.title')} text={tc('noCareer.text')}>
        <a class="btn btn--primary" href={href('new-game')}>
          {tc('noCareer.new')}
        </a>
        <a class="btn" href={href('saves')}>
          {tc('noCareer.load')}
        </a>
      </Empty>
    </section>
  );
}

/** Inline state for a core view that is not implemented yet (parallel build) or failed. */
export function Unavailable({ what, compact = true }: { what: string; compact?: boolean }) {
  return <Empty compact={compact} icon="warning" title={tc('unavailable.title')} text={tc('unavailable.text', { what })} />;
}

export function Callout({
  kind,
  icon,
  title,
  children,
  style,
}: {
  kind?: 'warn' | 'bad' | 'good' | 'info';
  icon?: string;
  title: ComponentChildren;
  children?: ComponentChildren;
  style?: JSX.CSSProperties;
}) {
  const cls = kind && kind !== 'info' ? `callout callout--${kind}` : 'callout';
  const ic = icon ?? (kind === 'bad' || kind === 'warn' ? 'warning' : kind === 'good' ? 'check' : 'info');
  return (
    <div class={cls} style={style} role={kind === 'bad' ? 'alert' : undefined}>
      <span class="icon" data-icon={ic} aria-hidden="true" />
      <div>
        <div class="callout__title">{title}</div>
        {children && <div class="callout__text">{children}</div>}
      </div>
    </div>
  );
}

/** Segmented control (`.segmented`, aria-pressed). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ComponentChildren; tip?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div class="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value ? 'true' : 'false'}
          data-tip={o.tip}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tabs (`.tabs` / `.tab`, role=tab, arrow keys move between tabs). */
export function Tabs<T extends string>({
  label,
  value,
  tabs,
  onChange,
  idPrefix,
}: {
  label: string;
  value: T;
  tabs: readonly { value: T; label: ComponentChildren; count?: ComponentChildren; tip?: string }[];
  onChange: (v: T) => void;
  idPrefix: string;
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.value === value);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    if (next) {
      e.preventDefault();
      e.stopPropagation();
      onChange(next.value);
      const el = document.getElementById(`${idPrefix}-tab-${next.value}`);
      el?.focus();
    }
  };
  return (
    <div class="tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button
          key={t.value}
          id={`${idPrefix}-tab-${t.value}`}
          class="tab"
          role="tab"
          type="button"
          aria-selected={t.value === value ? 'true' : 'false'}
          tabIndex={t.value === value ? 0 : -1}
          data-tip={t.tip}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && <span class="tab__count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---- dialog --------------------------------------------------------------------------------------------------

/**
 * `<dialog class="modal">` with initial focus and Esc (04 §6.2: Enter
 * confirms, Esc cancels). Stand-in for WP6's Modal.
 */
export function Dialog({
  open,
  onClose,
  title,
  icon,
  head,
  wide,
  narrow,
  children,
  footer,
  labelId,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: ComponentChildren;
  icon?: string;
  head?: ComponentChildren;
  wide?: boolean;
  narrow?: boolean;
  children: ComponentChildren;
  footer: ComponentChildren;
  labelId: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') {
        try {
          el.showModal();
        } catch {
          el.setAttribute('open', '');
        }
      } else el.setAttribute('open', '');
      const auto = el.querySelector<HTMLElement>('[data-autofocus]');
      auto?.focus();
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);
  if (!open) return null;
  const cls = ['modal', wide ? 'modal--wide' : '', narrow ? 'modal--narrow' : ''].filter(Boolean).join(' ');
  return (
    <dialog
      ref={ref}
      class={cls}
      aria-labelledby={labelId}
      data-testid={testId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        // Keep the shell's global shortcuts (Space = Continue, 1-7 screens) out of dialogs.
        e.stopPropagation();
      }}
    >
      <header class="modal__header">
        {icon && <span class="icon icon--lg" data-icon={icon} aria-hidden="true" />}
        {head}
        <h2 class="modal__title" id={labelId}>
          {title}
        </h2>
        <button class="icon-btn modal__close" type="button" aria-label="Close" onClick={onClose}>
          <span class="icon" data-icon="close" aria-hidden="true" />
        </button>
      </header>
      <div class="modal__body">{children}</div>
      <footer class="modal__footer">{footer}</footer>
    </dialog>
  );
}

// ---- notices (stand-in for WP6 toasts) ---------------------------------------------------------------------------

export interface Notice {
  id: number;
  kind: 'good' | 'bad' | 'info' | 'accent';
  title: string;
  sub?: string;
  undo?: () => void;
}

export function useNotices(): { notices: Notice[]; push: (n: Omit<Notice, 'id'>) => void; dismiss: (id: number) => void } {
  const [notices, setNotices] = useState<Notice[]>([]);
  const seq = useRef(1);
  const dismiss = (id: number) => setNotices((ns) => ns.filter((n) => n.id !== id));
  const push = (n: Omit<Notice, 'id'>) => {
    const id = seq.current++;
    setNotices((ns) => [...ns.slice(-2), { ...n, id }]);
    if (typeof window !== 'undefined') window.setTimeout(() => dismiss(id), n.undo ? 8000 : 5000);
  };
  return { notices, push, dismiss };
}

export function NoticeRegion({ notices, dismiss }: { notices: Notice[]; dismiss: (id: number) => void }) {
  return (
    <div class="toast-region" aria-live="polite" role="status">
      {notices.map((n) => (
        <div key={n.id} class={n.kind === 'accent' ? 'toast' : `toast toast--${n.kind}`}>
          <span class="icon" data-icon={n.kind === 'bad' ? 'warning' : n.kind === 'good' ? 'check' : 'info'} aria-hidden="true" />
          <div class="toast__text">
            <div class="toast__title">{n.title}</div>
            {n.sub && <div class="toast__sub">{n.sub}</div>}
          </div>
          {n.undo && (
            <button
              class="btn btn--sm btn--ghost"
              type="button"
              onClick={() => {
                n.undo?.();
                dismiss(n.id);
              }}
            >
              <span class="icon" data-icon="undo" aria-hidden="true" />
              Undo
            </button>
          )}
          <button class="icon-btn" type="button" aria-label="Dismiss" onClick={() => dismiss(n.id)}>
            <span class="icon" data-icon="close" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
