/**
 * Content-to-props adapters for WP7 screens over WP6's shared components
 * (src/ui/components). They only translate content ids (class, race, trait)
 * into the components' display props; the markup is WP6's.
 */
import type { ComponentChildren } from 'preact';
import type { ContentDB } from '../../../../core/content';
import type { Fighter, FighterId, GameState } from '../../../../core/model';
import * as C from '../../../components';
import type { IconName } from '../../../components';
import { href } from './store';
import { tc } from './text';

// ---- roles, portraits, classes ----------------------------------------------------------------

/** Role ids of a class (content `archetypes`: tank, melee, ranged, controller, healer). */
export function classRoles(content: ContentDB, classId: string): string[] {
  return [...(content.classes.get(classId)?.archetypes ?? [])];
}

export function roleNames(content: ContentDB, roles: readonly string[]): string[] {
  return roles.map((r) => content.vocabulary.roles.find((x) => x.id === r)?.name ?? r);
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
  return (
    <C.Portrait
      role={fighter ? classRoles(content, fighter.classId)[0] : undefined}
      race={fighter?.raceId}
      size={size}
      injured={injured ?? Boolean(fighter?.injury && fighter.injury.weeksOut > 0)}
    />
  );
}

export function ClassTag({ content, classId }: { content: ContentDB; classId: string }) {
  const roles = classRoles(content, classId);
  return <C.ClassTag name={content.classes.get(classId)?.name ?? classId} roles={roles} roleNames={roleNames(content, roles)} />;
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
  return <C.Rating value={value} tip={tip} size={lg ? 'lg' : undefined} />;
}

export function Stars({ potential, tip }: { potential: number; tip?: string }) {
  return <C.Stars potential={potential} tip={tip} />;
}

export function TraitDots({ content, traitIds }: { content: ContentDB; traitIds: readonly string[] }) {
  const traits = traitIds.map((id) => {
    const t = content.traits.get(id);
    const polarity = t ? C.traitPolarity(t) : 'pos';
    const tip: C.Tip = t ? { kicker: t.category, title: t.name, body: t.effectText ?? '', flavor: t.flavor } : id;
    return { id, polarity, tip };
  });
  return <C.TraitDots traits={traits} />;
}

export function Delta({ value, tip }: { value: number; tip?: string }) {
  return <C.Delta value={value} tip={tip} />;
}

export function FormStrip({ form }: { form: readonly ('W' | 'L' | '-')[] }) {
  const words = form.map((r) => (r === 'W' ? 'win' : r === 'L' ? 'loss' : 'not played')).join(', ');
  return <C.FormStrip results={form.map((r) => ({ r }))} label={`Last five: ${words || 'none'}`} />;
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
  return <C.Empty icon={icon as IconName} title={title} text={text} actions={children} compact={compact} />;
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

export function Callout({ kind, icon, title, children }: { kind?: 'warn' | 'bad' | 'good' | 'info'; icon?: string; title: ComponentChildren; children?: ComponentChildren }) {
  return (
    <C.Callout kind={kind} icon={icon as IconName | undefined} title={title}>
      {children}
    </C.Callout>
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
  options: readonly { value: T; label: ComponentChildren; tip?: string }[];
  onChange: (v: T) => void;
}) {
  return <C.Segmented label={label} value={value} options={options.map((o) => ({ id: o.value, label: o.label, tip: o.tip }))} onChange={onChange} />;
}

/** Tabs (`.tabs` / `.tab`, role=tab); a text badge (W / L) rides in the label. */
export function Tabs<T extends string>({
  label,
  value,
  tabs,
  onChange,
  idPrefix,
}: {
  label: string;
  value: T;
  tabs: readonly { value: T; label: ComponentChildren; count?: ComponentChildren }[];
  onChange: (v: T) => void;
  idPrefix: string;
}) {
  return (
    <C.Tabs
      label={label}
      idPrefix={idPrefix}
      selected={value}
      onSelect={onChange}
      tabs={tabs.map((x) => ({
        id: x.value,
        label:
          x.count === undefined ? (
            x.label
          ) : (
            <>
              {x.label}
              <span class="tab__count">{x.count}</span>
            </>
          ),
      }))}
    />
  );
}
