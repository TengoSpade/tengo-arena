/**
 * The shortcut sheet (?) and the quick-jump search (Ctrl K). Loaded on first use (Frame), so they
 * stay out of the main bundle (05 bundle budget).
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ContentDB } from '../../core/content';
import type { GameState } from '../../core/model';
import { Icon, Kbd, Modal, RoleGlyph } from '../components';
import { t } from '../text';
import { navigate } from './router';
import { NAV_ITEMS } from './nav';

export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [string, string[]][] = [
    [t('shortcuts.continue'), ['Space']],
    [t('shortcuts.screens1'), ['1', '2', '3']],
    [t('shortcuts.screens2'), ['4', '5', '6', '7']],
    [t('shortcuts.search'), ['Ctrl', 'K']],
    [t('shortcuts.back'), ['Esc']],
    [t('shortcuts.save'), ['Ctrl', 'S']],
    [t('shortcuts.undo'), ['Ctrl', 'Z']],
    [t('shortcuts.pin'), ['Shift']],
    [t('shortcuts.move'), ['↑', '↓']],
    [t('shortcuts.open'), ['Enter']],
    [t('shortcuts.lineupKeys'), ['F', 'B', 'R']],
    [t('shortcuts.captainKeys'), ['C', 'V']],
    [t('shortcuts.presetKeys'), ['P', 'E']],
    [t('shortcuts.fighters'), ['[', ']']],
    [t('shortcuts.sheet'), ['?']],
  ];
  if (import.meta.env.DEV) rows.push([t('shortcuts.debug'), ['`']]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('shortcuts.title')}
      icon="keyboard"
      footerNote={t('shortcuts.note')}
      footer={
        <button class="btn" type="button" onClick={onClose}>
          {t('common.close')} <kbd>Esc</kbd>
        </button>
      }
      testId="shortcut-sheet"
    >
      <dl class="shortcut-list">
        {rows.map(([label, keys]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

interface SearchHit {
  id: string;
  kind: string;
  label: string;
  sub?: string;
  href: string;
  role?: string;
}

function searchIndex(state: GameState | null, content: ContentDB | null): SearchHit[] {
  const hits: SearchHit[] = NAV_ITEMS.map((n) => ({ id: `screen:${n.id}`, kind: t('search.kindScreen'), label: t(n.label), href: n.href }));
  if (!content) return hits;
  for (const k of content.classes.list) {
    hits.push({ id: `class:${k.id}`, kind: t('search.kindClass'), label: k.name, sub: k.roleTags.join(', '), href: `#/codex?class=${k.id}`, role: k.archetypes[0] });
  }
  if (state) {
    for (const c of Object.values(state.clubs)) hits.push({ id: `club:${c.id}`, kind: t('search.kindClub'), label: c.name, href: '#/league' });
    for (const f of Object.values(state.fighters)) {
      if (f.status === 'retired') continue;
      const k = content.classes.get(f.classId);
      const club = f.clubId ? state.clubs[f.clubId]?.shortName : undefined;
      hits.push({ id: `fighter:${f.id}`, kind: t('search.kindFighter'), label: f.name.full, sub: [k?.name, club].filter(Boolean).join(' · '), href: `#/fighter/${f.id}`, role: k?.archetypes[0] });
    }
  }
  return hits;
}

export function SearchPalette({ open, onClose, state, content }: { open: boolean; onClose: () => void; state: GameState | null; content: ContentDB | null }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useMemo(() => (open ? searchIndex(state, content) : []), [open, state, content]);
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return index.slice(0, 8);
    return index.filter((h) => h.label.toLowerCase().includes(needle) || (h.sub ?? '').toLowerCase().includes(needle)).slice(0, 12);
  }, [q, index]);
  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);
  const go = (h: SearchHit | undefined) => {
    if (!h) return;
    onClose();
    navigate(h.href);
  };
  return (
    <Modal open={open} onClose={onClose} title={t('search.title')} icon="search" testId="search-palette">
      <div class="l-stack l-stack--sm">
        <span class="input-icon">
          <Icon name="search" />
          <input
            ref={inputRef}
            class="input"
            type="search"
            data-autofocus
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            value={q}
            onInput={(e) => {
              setQ((e.target as HTMLInputElement).value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(hits.length - 1, s + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(hits[sel]);
              }
            }}
          />
        </span>
        <div class="table-wrap" style={{ maxHeight: '22rem' }}>
          <table class="data-table data-table--compact" aria-label={t('search.title')}>
            <tbody>
              {hits.length === 0 ? (
                <tr>
                  <td class="cell-muted">{t('search.empty')}</td>
                </tr>
              ) : (
                hits.map((h, i) => (
                  <tr key={h.id} aria-selected={i === sel ? 'true' : 'false'} onClick={() => go(h)} style={{ cursor: 'pointer' }}>
                    <td class="cell-fill">
                      <span class="entity">
                        {h.role && <RoleGlyph role={h.role} />}
                        <span class="entity__name">{h.label}</span>
                        {h.sub && <span class="entity__sub">{h.sub}</span>}
                      </span>
                    </td>
                    <td class="cell-muted">{h.kind}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
