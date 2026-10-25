/**
 * ui-codex · Class codex (04 §6.3, not mocked): learn the classes (O8) and
 * their presets without leaving the game. Filter rail (role toggles with
 * glyphs, hybrids toggle, search by name, ability or role tag), a grid of
 * class cards, and a detail pane: flavour, kit (basic, two actives,
 * passive with cooldown, focus, range), stat emphasis from ratingWeights,
 * presets with rules as sentences, own fighters and free agents of the class.
 * Keys: 7 opens (frame), arrows move in the grid, Enter opens, / search.
 */
import { signal } from '@preact/signals';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { AbilityDef, ClassDef, ContentDB } from '../../../core/content';
import type { Fighter, GameState } from '../../../core/model';
import type { ScreenProps } from '../../app/routes';
import { navigate } from '../../app/router';
import { useShortcuts } from '../../app/shortcuts';
import { Empty, FighterName, Icon, Meter, PageHeader, Panel, Rating, RoleBadge, RoleGlyph, RowMark, RuleLine, Tag, tipAttrs } from '../../components';
import { presetLines, ruleParts, stanceName } from '../../format/rules';
import { roleNames, rolesOf } from '../../format/fighter';
import { useStore } from '../../store';
import { safeView, useEngine, type GameEngine } from '../../store/engine';
import { fighterViewOf } from '../../store/views';
import { format } from '../../text';
import './codex.css';

const T = {
  eyebrow: 'Reference',
  title: 'Class codex',
  meta: '{n} classes · {h} hybrids',
  meta2: 'Every class fights with a basic attack, two actives and a passive',
  filters: 'Filters',
  roles: 'Roles',
  roleToggle: 'Show {role} classes',
  hybrids: 'Hybrids only',
  search: 'Search name, ability or role tag',
  reset: 'Reset filters',
  empty: 'No class matches',
  complexity: 'Complexity {n} of 3',
  complexityTip: 'How much the class rewards careful tactics (1 simple, 3 demanding).',
  rowTip: 'Preferred starting row',
  select: 'Select a class to see its kit, presets and fighters.',
  kit: 'Kit',
  basic: 'Basic',
  active: 'Active',
  passive: 'Passive',
  cooldown: '{s} s cooldown',
  focus: '{n} focus',
  range: '{m} m',
  emphasis: 'Rating weights',
  emphasisTip: 'How much each attribute counts toward this class’s rating (classes.json ratingWeights).',
  presets: 'Presets',
  stance: '{name} stance',
  yours: 'Your fighters of this class',
  freeAgents: 'Free agents of this class',
  none: 'None',
  cards: 'Classes',
  tags: 'Role tags: {tags}',
} as const;

const query = signal('');
const roleFilter = signal<ReadonlySet<string>>(new Set());
const hybridsOnly = signal(false);
const selectedClass = signal<string | null>(null);

function matches(k: ClassDef, content: ContentDB, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  if (k.name.toLowerCase().includes(n)) return true;
  if (k.roleTags.some((t) => t.toLowerCase().includes(n))) return true;
  if (roleNames(k, content).some((r) => r.toLowerCase().includes(n))) return true;
  return Object.values(k.abilities).some((id) => content.abilities.get(id)?.name.toLowerCase().includes(n));
}

export default function CodexScreen({ params }: ScreenProps) {
  const store = useStore();
  const engine = useEngine();
  const content = store.content.value;
  const state = store.game.value;
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (params['class']) selectedClass.value = params['class'];
  }, [params['class']]);

  useShortcuts({
    '/': () => {
      searchRef.current?.focus();
    },
  });

  const list = useMemo(() => {
    if (!content) return [];
    const roles = roleFilter.value;
    return content.classes.list.filter(
      (k) =>
        (roles.size === 0 || k.archetypes.some((a) => roles.has(a))) && (!hybridsOnly.value || k.archetypes.length > 1) && matches(k, content, query.value.trim()),
    );
  }, [content, roleFilter.value, hybridsOnly.value, query.value]);

  if (!content) return <section class="page" data-testid="screen-codex" />;
  const selected = selectedClass.value ? content.classes.get(selectedClass.value) : undefined;
  const hybrids = content.classes.list.filter((k) => k.archetypes.length > 1).length;
  const reset = () => {
    query.value = '';
    roleFilter.value = new Set();
    hybridsOnly.value = false;
  };

  const onGridKey = (e: KeyboardEvent) => {
    const cards = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('.codex-card') ?? [])];
    const i = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const cols = Math.max(1, Math.round((gridRef.current?.clientWidth ?? 1) / (cards[0]?.clientWidth || 1)));
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : 0;
    if (!delta) return;
    e.preventDefault();
    cards[Math.max(0, Math.min(cards.length - 1, i + delta))]?.focus();
  };

  return (
    <section class="page" data-testid="screen-codex">
      <PageHeader eyebrow={T.eyebrow} title={T.title} meta={[format(T.meta, { n: content.classes.list.length, h: hybrids }), T.meta2]} />
      <div class="l-grid">
        <Panel span={3} title={T.filters} icon="filter" bodyClass="l-stack" class="codex-rail">
          <span class="input-icon">
            <Icon name="search" />
            <input
              ref={searchRef}
              class="input input--sm"
              type="search"
              placeholder={T.search}
              aria-label={T.search}
              value={query.value}
              onInput={(e) => (query.value = (e.target as HTMLInputElement).value)}
            />
          </span>
          <div>
            <div class="panel-section__title">{T.roles}</div>
            <div class="l-cluster">
              {content.combat.archetypes.map((a) => {
                const on = roleFilter.value.has(a.id);
                return (
                  <button
                    key={a.id}
                    class="role-toggle"
                    type="button"
                    data-role={a.id}
                    aria-pressed={on ? 'true' : 'false'}
                    aria-label={format(T.roleToggle, { role: a.name })}
                    {...tipAttrs(a.description)}
                    onClick={() => {
                      const next = new Set(roleFilter.value);
                      if (on) next.delete(a.id);
                      else next.add(a.id);
                      roleFilter.value = next;
                    }}
                  >
                    <i class="role-glyph" aria-hidden="true" />
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label class="check">
            <input type="checkbox" class="switch" role="switch" checked={hybridsOnly.value} onChange={(e) => (hybridsOnly.value = (e.target as HTMLInputElement).checked)} />
            {T.hybrids}
          </label>
          <button class="btn btn--sm btn--ghost" type="button" onClick={reset}>
            <Icon name="refresh" />
            {T.reset}
          </button>
        </Panel>
        <div class={selected ? 'span-5' : 'span-9'}>
          {list.length === 0 ? (
            <section class="panel">
              <Empty icon="codex" title={T.empty} actions={<button class="btn btn--sm" type="button" onClick={reset}>{T.reset}</button>} />
            </section>
          ) : (
            <div class="l-autogrid codex-grid" ref={gridRef} role="group" aria-label={T.cards} onKeyDown={onGridKey}>
              {list.map((k) => (
                <ClassCard key={k.id} k={k} content={content} selected={selected?.id === k.id} />
              ))}
            </div>
          )}
        </div>
        {selected && (
          <div class="span-4">
            <ClassDetail k={selected} content={content} state={state} engine={engine} />
          </div>
        )}
      </div>
    </section>
  );
}

function ClassCard({ k, content, selected }: { k: ClassDef; content: ContentDB; selected: boolean }) {
  const names = roleNames(k, content);
  return (
    <button
      type="button"
      class="card codex-card"
      data-role={k.archetypes[0]}
      aria-pressed={selected ? 'true' : 'false'}
      data-testid={`class-card-${k.id}`}
      onClick={() => {
        selectedClass.value = selected ? null : k.id;
      }}
    >
      <span class="codex-card__head">
        <span class="codex-card__glyphs">
          {rolesOf(k).map((r) => (
            <RoleGlyph key={r} role={r} size="lg" />
          ))}
        </span>
        <span class="codex-card__name">{k.name}</span>
      </span>
      <span class="l-cluster l-cluster--xs">
        <span class="u-xs u-muted">{names.join(' · ')}</span>
        <RowMark row={k.startingRow} tip={T.rowTip} />
        <span class="tag tag--outline" {...tipAttrs(T.complexityTip)}>
          {format(T.complexity, { n: k.complexity })}
        </span>
      </span>
      <span class="u-sm u-muted codex-card__desc">{k.description}</span>
    </button>
  );
}

function AbilityRow({ a, label }: { a: AbilityDef; label: string }) {
  const facts = [a.cooldownS ? format(T.cooldown, { s: a.cooldownS }) : null, a.focusCost ? format(T.focus, { n: a.focusCost }) : null, a.rangeM ? format(T.range, { m: a.rangeM }) : null].filter(Boolean);
  return (
    <div class="codex-ability">
      <div class="l-row">
        <strong>{a.name}</strong>
        <span class="tag">{label}</span>
      </div>
      {facts.length > 0 && <div class="u-xs u-faint u-num">{facts.join(' · ')}</div>}
      <p class="u-sm u-muted">{a.description}</p>
    </div>
  );
}

function ClassDetail({ k, content, state, engine }: { k: ClassDef; content: ContentDB; state: GameState | null; engine: GameEngine }) {
  const names = roleNames(k, content);
  const kit = (['basic', 'a1', 'a2', 'passive'] as const).map((slot) => ({ slot, a: safeView(() => content.classAbility(k.id, slot), null) }));
  const weights = Object.entries(k.ratingWeights).sort((a, b) => b[1] - a[1]);
  const top = weights[0]?.[1] ?? 1;
  const presets = k.presetIds.map((id) => content.presets.get(id)).filter((p) => !!p);
  const own: Fighter[] = state?.playerClubId ? Object.values(state.fighters).filter((f) => f.clubId === state.playerClubId && f.classId === k.id) : [];
  const free: Fighter[] = state ? safeView(() => engine.freeAgents(state), [] as Fighter[]).filter((f) => f.classId === k.id) : [];
  const fighterRow = (f: Fighter) => {
    const v = state ? fighterViewOf(engine, state, content, f.id) : null;
    return (
      <li key={f.id} class="l-row">
        <FighterName name={f.name.full} href={`#/fighter/${f.id}`} role={k.archetypes[0]} race={f.raceId} />
        {v && <span class="l-push"><Rating value={v.rating} tip={`Rating ${v.rating}`} /></span>}
      </li>
    );
  };
  return (
    <Panel title={k.name} icon="codex" testId="class-detail" class="codex-detail" bodyClass="l-stack">
      <div class="l-cluster l-cluster--xs">
        {k.archetypes.map((a, i) => (
          <RoleBadge key={a} role={a} name={names[i] ?? a} tip={content.combat.archetypes.find((x) => x.id === a)?.description} />
        ))}
        <RowMark row={k.startingRow} tip={T.rowTip} />
        <Tag kind="outline" tip={format(T.tags, { tags: k.roleTags.join(', ') })}>
          {k.roleTags.join(' · ')}
        </Tag>
      </div>
      {k.flavor && <p class="tooltip__flavor codex-flavor">{`“${k.flavor}”`}</p>}
      <p class="u-sm">{k.description}</p>
      <div>
        <div class="panel-section__title">{T.kit}</div>
        {kit.map(({ slot, a }) => (a ? <AbilityRow key={slot} a={a} label={slot === 'basic' ? T.basic : slot === 'passive' ? T.passive : `${T.active} ${slot.toUpperCase()}`} /> : null))}
      </div>
      <div>
        <div class="panel-section__title" {...tipAttrs(T.emphasisTip)}>
          {T.emphasis}
        </div>
        <div class="l-stack l-stack--xs">
          {weights
            .filter(([, w]) => w > 0)
            .map(([stat, w]) => (
              <div key={stat} class="codex-weight" {...tipAttrs(`${content.stats.get(stat)?.name ?? stat}: ${Math.round(w * 100)}% of the rating`)}>
                <span class="u-sm u-muted">{content.stats.get(stat)?.name ?? stat}</span>
                <Meter value={w / top} thin />
                <span class="u-xs u-num">{Math.round(w * 100)}%</span>
              </div>
            ))}
        </div>
      </div>
      <div>
        <div class="panel-section__title">{T.presets}</div>
        {presets.map((p) => (
          <details key={p!.id} class="codex-preset" {...tipAttrs({ title: p!.name, lines: presetLines(p!, k, content) })}>
            <summary>
              <strong>{p!.name}</strong> <span class="u-xs u-faint">{format(T.stance, { name: stanceName(p!.stance, content) })}</span>
            </summary>
            <p class="u-sm u-muted">{p!.summary}</p>
            <ol class="rule-list">
              {p!.rules.map((r) => {
                const parts = ruleParts(r, k, content);
                return (
                  <li key={r.id}>
                    <RuleLine parts={parts} />
                  </li>
                );
              })}
            </ol>
          </details>
        ))}
      </div>
      {state && (
        <>
          <div>
            <div class="panel-section__title">{T.yours}</div>
            {own.length ? <ul class="codex-list" role="list">{own.map(fighterRow)}</ul> : <span class="u-sm u-faint">{T.none}</span>}
          </div>
          <div>
            <div class="panel-section__title">{T.freeAgents}</div>
            {free.length ? <ul class="codex-list" role="list">{free.slice(0, 6).map(fighterRow)}</ul> : <span class="u-sm u-faint">{T.none}</span>}
          </div>
        </>
      )}
      <button class="btn btn--sm btn--ghost" type="button" onClick={() => navigate('#/market')}>
        <Icon name="market" />
        {T.freeAgents}
      </button>
    </Panel>
  );
}
