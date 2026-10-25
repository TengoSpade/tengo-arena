/**
 * Global shortcut map (04 §6.4; behaviour contract "a global shortcut map,
 * ignored while typing"). Screens register layers with useShortcuts(); the
 * newest layer handles a key first, then the app's global map. Keys are
 * normalized: "Space", "Enter", "Escape", "ArrowUp", "ctrl+s", "?", "`",
 * single letters in lower case. Dialogs stop propagation themselves.
 */
import { useEffect, useRef } from 'preact/hooks';

export type ShortcutHandler = (e: KeyboardEvent) => boolean | void;
export type ShortcutMap = Readonly<Record<string, ShortcutHandler>>;

const layers: { map: () => ShortcutMap }[] = [];

export function keyName(e: KeyboardEvent): string {
  let k = e.key;
  if (k === ' ' || e.code === 'Space') k = 'Space';
  else if (k.length === 1) k = k.toLowerCase();
  const mods = `${e.ctrlKey || e.metaKey ? 'ctrl+' : ''}${e.altKey ? 'alt+' : ''}`;
  return mods + k;
}

export function isTyping(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  if (!t || !t.tagName) return false;
  return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
}

/** Register screen shortcuts while the component is mounted. A handler returning false lets the key through. */
export function useShortcuts(map: ShortcutMap): void {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const layer = { map: () => ref.current };
    layers.push(layer);
    return () => {
      const i = layers.indexOf(layer);
      if (i >= 0) layers.splice(i, 1);
    };
  }, []);
}

/** Install the document listener with the app's global map. Returns the disposer. */
export function installShortcuts(global: () => ShortcutMap, target: Document = document): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const name = keyName(e);
    const typing = isTyping(e);
    // While typing only modifier combos and Escape reach the map.
    if (typing && !name.startsWith('ctrl+') && name !== 'Escape') return;
    if (target.querySelector('dialog[open]')) return;
    // Buttons handle Space and Enter natively; links handle Enter.
    const el = e.target as HTMLElement | null;
    if (name === 'Space' && el?.closest?.('button, [role="tab"], summary')) return;
    if (name === 'Enter' && el?.closest?.('button, a, [role="tab"], summary')) return;
    for (let i = layers.length - 1; i >= 0; i--) {
      const h = layers[i]!.map()[name];
      if (h && h(e) !== false) {
        e.preventDefault();
        return;
      }
    }
    const g = global()[name];
    if (g && g(e) !== false) e.preventDefault();
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
