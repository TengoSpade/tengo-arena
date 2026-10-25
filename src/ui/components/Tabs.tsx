/**
 * Tabs (`.tabs` / `.tab`, role="tab"): ← → move and select, Home / End,
 * roving tabindex. Panels: <TabPanel> with the same idPrefix.
 */
import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';

export interface TabDef<T extends string> {
  id: T;
  label: ComponentChildren;
  count?: number;
  kbd?: string;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  tabs: readonly TabDef<T>[];
  selected: T;
  onSelect: (id: T) => void;
  label: string;
  idPrefix: string;
  inset?: boolean;
  class?: string;
}

export function Tabs<T extends string>({ tabs, selected, onSelect, label, idPrefix, inset, class: cls }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const enabled = tabs.filter((tab) => !tab.disabled);
  const move = (delta: number | 'first' | 'last') => {
    const i = enabled.findIndex((tab) => tab.id === selected);
    const next =
      delta === 'first' ? enabled[0] : delta === 'last' ? enabled[enabled.length - 1] : enabled[(i + delta + enabled.length) % enabled.length];
    if (!next) return;
    onSelect(next.id);
    listRef.current?.querySelector<HTMLElement>(`#${idPrefix}-tab-${next.id}`)?.focus();
  };
  return (
    <div
      ref={listRef}
      class={`tabs${inset ? ' tabs--inset' : ''}${cls ? ` ${cls}` : ''}`}
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') move(1);
        else if (e.key === 'ArrowLeft') move(-1);
        else if (e.key === 'Home') move('first');
        else if (e.key === 'End') move('last');
        else return;
        e.preventDefault();
      }}
    >
      {tabs.map((tab) => {
        const on = tab.id === selected;
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            class="tab"
            role="tab"
            type="button"
            aria-selected={on ? 'true' : 'false'}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={on ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && <span class="tab__count">{tab.count}</span>}
            {tab.kbd && <kbd>{tab.kbd}</kbd>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, id, selected, children, class: cls }: { idPrefix: string; id: string; selected: string; children: ComponentChildren; class?: string }) {
  return (
    <div id={`${idPrefix}-panel-${id}`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${id}`} hidden={selected !== id} class={cls}>
      {selected === id ? children : null}
    </div>
  );
}
