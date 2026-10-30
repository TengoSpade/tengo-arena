/**
 * Playtest ticket tool (lazy chunk, fetched when the browser is idle or on the first F8):
 * screenshot of the viewport as the player sees it, then a one-field dialog (Enter files,
 * Shift+Enter new line, Esc cancels), then the ticket goes to the dev-server plugin
 * (`npm run dev`: <repo>/tickets/<id>/) or, without it, to IndexedDB (Settings › Tickets exports
 * them). Whoever stores the ticket assigns its run# and ticket#; the dialog shows a preview.
 *
 * Screenshot: modern-screenshot (MIT) renders the DOM to SVG/canvas with computed styles inlined, so
 * the design-system CSS and both themes come out as drawn; `restoreScrollPosition` keeps the main
 * column scrolled as the player had it; canvas elements are copied as images (the M2 PixiJS viewer
 * needs `preserveDrawingBuffer` for that).
 */
import { domToPng } from 'modern-screenshot';
import { render } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { version as gameVersion } from '../../../package.json';
import { ENGINE_VERSION } from '../../core/sim';
import { createLocalTicketStore, idbTicketKv, type NewTicket } from '../../platform/tickets/local-store';
import { NO_CAREER_KEY, ticketId, ticketShort, ticketStamp, weekCode } from '../../platform/tickets/naming';
import { matchRoute } from '../app/routes';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';
import type { AppStore } from '../store';
import { effectiveTheme } from '../store/settings';
import type { TicketSnapshot } from './launcher';
import { T, type TicketNumbers } from './tool-text';
import './tickets.css';

// ---- capture -------------------------------------------------------------------------------------------------

/** The visible viewport as a PNG data URL (before the dialog opens, so it is not in the picture). */
export async function captureViewport(): Promise<string> {
  const body = document.body;
  // The library copies `value` as an attribute, which a <select> ignores and a checkbox does not
  // use: mark the chosen option and the ticked boxes so the clone shows them (removed again below).
  const selects = [...document.querySelectorAll('select')];
  selects.forEach((s) => (s.dataset['ticketSel'] = String(s.selectedIndex)));
  const ticked = [...document.querySelectorAll<HTMLInputElement>('input[type=checkbox], input[type=radio]')].filter((i) => i.checked);
  ticked.forEach((i) => (i.dataset['ticketChecked'] = ''));
  const stuck = markStuck();
  // Full-page screens (club select) scroll the document itself, which the library does not restore.
  const scroll = { x: document.scrollingElement?.scrollLeft ?? 0, y: document.scrollingElement?.scrollTop ?? 0 };
  try {
    return await domToPng(body, {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: Math.min(2, window.devicePixelRatio || 1),
      backgroundColor: getComputedStyle(body).backgroundColor || null,
      // The clone's root is drawn as a fresh <body>, which would get the browser's 8px margin.
      style: { margin: '0' },
      features: { restoreScrollPosition: true },
      // Nothing of the ticket tool itself, and no scripts.
      filter: (node) => !(node instanceof HTMLElement && (node.dataset['ticketTool'] !== undefined || node.tagName === 'SCRIPT')),
      onCloneNode: (clone) => {
        if (clone instanceof Element) fixClone(clone, getComputedStyle(document.documentElement).getPropertyValue('--c-text-faint'), scroll);
      },
    });
  } finally {
    selects.forEach((s) => delete s.dataset['ticketSel']);
    ticked.forEach((i) => delete i.dataset['ticketChecked']);
    stuck.forEach((el) => delete el.dataset['ticketStuck']);
  }
}

/**
 * Sticky elements that are stuck right now (the Market filter rail while the results scroll): the
 * clone draws its scrolled column with a transform, under which nothing sticks, so each such element
 * is marked with how far sticking moved it (fixClone puts it back there). Measured against the same
 * element with `position: static`, which keeps its place in the flow.
 */
function markStuck(): HTMLElement[] {
  const marked: HTMLElement[] = [];
  for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
    if (getComputedStyle(el).position !== 'sticky') continue;
    const live = el.getBoundingClientRect();
    const inline = el.style.position;
    el.style.position = 'static';
    const flow = el.getBoundingClientRect();
    el.style.position = inline;
    const dx = Math.round(live.left - flow.left);
    const dy = Math.round(live.top - flow.top);
    if (dx || dy) {
      el.dataset['ticketStuck'] = `${dx},${dy}`;
      marked.push(el);
    }
  }
  return marked;
}

/** What the library's clone gets wrong for this UI, put right before it is drawn. */
export function fixClone(clone: Element, placeholderColor: string, scroll: { x: number; y: number } = { x: 0, y: 0 }): void {
  // A scrolled document: move the page (not fixed layers such as toasts) up by the scroll.
  if (scroll.x || scroll.y) {
    for (const child of clone.children) {
      if (!(child instanceof HTMLElement) || child.style.position === 'fixed') continue;
      const own = child.style.transform && child.style.transform !== 'none' ? ` ${child.style.transform}` : '';
      child.style.transform = `translate(${-scroll.x}px, ${-scroll.y}px)${own}`;
    }
  }
  for (const s of clone.querySelectorAll<HTMLSelectElement>('select[data-ticket-sel]')) {
    s.options[Number(s.dataset['ticketSel'])]?.setAttribute('selected', '');
    delete s.dataset['ticketSel'];
  }
  for (const i of clone.querySelectorAll<HTMLInputElement>('input[data-ticket-checked]')) {
    i.setAttribute('checked', '');
    delete i.dataset['ticketChecked'];
  }
  // Stuck sticky elements: relative offsets put them where they were on screen (markStuck).
  for (const el of clone.querySelectorAll<HTMLElement>('[data-ticket-stuck]')) {
    const [dx, dy] = (el.dataset['ticketStuck'] ?? '0,0').split(',').map(Number);
    el.style.position = 'relative';
    el.style.top = `${dy ?? 0}px`;
    el.style.left = `${dx ?? 0}px`;
    el.style.bottom = el.style.right = 'auto';
    delete el.dataset['ticketStuck'];
  }
  // Widths are copied as pixels, which breaks the fill-cell trick (width 100% + max-width 0,
  // `.cell-fill`): give those cells their 100% back so the columns come out as on screen.
  for (const c of clone.querySelectorAll<HTMLElement>('td, th')) {
    if (c.style.maxWidth === '0px') c.style.width = c.style.inlineSize = '100%';
  }
  // ::placeholder is not copied; the design system draws it in the faint text colour.
  const style = clone.ownerDocument.createElement('style');
  style.textContent = `::placeholder{color:${placeholderColor};-webkit-text-fill-color:${placeholderColor}}`;
  clone.appendChild(style);
}

/** Everything ticket.json records besides the text (route, week, build, logs), from the F8 snapshot. */
export function collectMeta(s: TicketSnapshot): Record<string, unknown> {
  const g = s.game;
  const m = matchRoute(s.hash);
  const club = g?.playerClubId ? g.clubs[g.playerClubId] : undefined;
  return {
    created: s.at.toISOString(),
    createdLocal: s.at.toLocaleString(),
    screen: m?.route.id ?? 'unknown',
    route: { hash: s.hash, id: m?.route.id ?? null, params: m?.params ?? {} },
    week: g ? weekCode(g.calendar) : null,
    calendar: g ? { season: g.calendar.season, phase: g.calendar.phase, weekIndex: g.calendar.weekIndex, weekId: g.calendar.weekId } : null,
    career: g ? { careerId: s.careerId, rootSeed: g.rng.root, playerClubId: g.playerClubId, club: club?.name ?? null } : null,
    gameVersion,
    engineVersion: ENGINE_VERSION,
    contentHash: g?.content.hash ?? s.content?.ref.hash ?? null,
    viewport: s.viewport,
    devicePixelRatio: s.devicePixelRatio,
    theme: effectiveTheme(s.settings),
    pacing: s.settings.pacing,
    userAgent: navigator.userAgent,
    // M2 (05-technical-m2 §A7): the arena's fixture, round, tick, speed and kind when F8 was pressed there. The
    // screenshot above includes the canvas (the viewer keeps its drawing buffer).
    ...(s.arena ? { arena: s.arena } : {}),
    recentCommands: s.recentCommands.slice(-20),
    console: s.console,
    toasts: s.toasts,
  };
}

/** The career as the existing save serializer writes it (with its career id), or null before a career exists. */
export function serializeCareer(engine: AppStore['engine'], s: TicketSnapshot): string | null {
  const g = s.game;
  if (!g) return null;
  let meta = engine.saveMetaFor(g, { slotId: 'ticket', kind: 'manual', label: 'Ticket', savedAt: s.at.toISOString(), playtimeSec: 0, gameVersion });
  if (s.careerId) meta = { ...meta, careerId: s.careerId };
  return engine.serializeSave(engine.createSave(g, meta, { engineVersion: ENGINE_VERSION }, s.commandLog));
}

// ---- storage ------------------------------------------------------------------------------------------------

let local: ReturnType<typeof createLocalTicketStore> | null = null;
const localStore = () => (local ??= createLocalTicketStore(idbTicketKv()));

/** Preview numbers: the dev-server plugin under `npm run dev`, else the browser store; null if neither answers. */
async function previewNumbers(careerKey: string): Promise<{ numbers: TicketNumbers | null; server: boolean }> {
  if (import.meta.env.DEV) {
    try {
      const res = await fetch(`/__tickets/next?career=${encodeURIComponent(careerKey)}`);
      if (res.ok) return { numbers: (await res.json()) as TicketNumbers, server: true };
    } catch {
      // no plugin: the browser store below
    }
  }
  try {
    return { numbers: await localStore().next(careerKey), server: false };
  } catch {
    return { numbers: null, server: false };
  }
}

export interface Draft {
  careerKey: string;
  /** What the ticket will probably be called; the store assigns the final numbers. */
  preview: TicketNumbers | null;
  server: boolean;
  at: Date;
  screenshot: string;
  meta: Record<string, unknown>;
  state: string | null;
}

export type Filed = { id: string; where: 'server' | 'local' };

/** Write a ticket: the dev server, else (or if it fails) IndexedDB. Returns the final id and where it went. */
export async function submitTicket(d: Draft, text: string): Promise<Filed> {
  const ticket: NewTicket = { careerKey: d.careerKey, stamp: ticketStamp(d.at), text, screenshot: d.screenshot, state: d.state, meta: d.meta };
  if (d.server) {
    try {
      const res = await fetch('/__tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ticket) });
      if (res.ok) return { id: ((await res.json()) as { id: string }).id, where: 'server' };
      console.warn('ticket server refused', res.status, await res.text());
    } catch (e) {
      console.warn('ticket server unreachable', e);
    }
  }
  try {
    return { id: (await localStore().add(ticket)).id, where: 'local' };
  } catch (e) {
    throw new Error(`${T.noStorage} (${e instanceof Error ? e.message : String(e)})`, { cause: e });
  }
}

// ---- dialog ---------------------------------------------------------------------------------------------------

export function TicketDialog({ draft, onDone }: { draft: Draft; onDone: (result: Filed | null) => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [emptyWarned, setEmptyWarned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const preview = draft.preview ? ticketShort(ticketId(draft.preview.run, draft.preview.ticket, draft.at)) : null;

  const submit = async () => {
    if (sending) return;
    // An empty ticket is allowed, but only on purpose: the first Enter asks for a note.
    if (text.trim() === '' && !emptyWarned) {
      setEmptyWarned(true);
      field.current?.focus();
      return;
    }
    setSending(true);
    setError(null);
    try {
      onDone(await submitTicket(draft, text.trim()));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      showToast({ kind: 'bad', title: T.notSaved, sub: message });
      setSending(false);
      field.current?.focus();
    }
  };

  return (
    <Modal
      open
      onClose={() => !sending && onDone(null)}
      title={T.title}
      icon="bug"
      testId="ticket-dialog"
      footerNote={T.footer}
      footer={
        <>
          <button type="button" class="btn btn--ghost" onClick={() => onDone(null)} disabled={sending}>
            {T.cancel} <kbd>Esc</kbd>
          </button>
          <button type="button" class="btn btn--primary" onClick={() => void submit()} aria-disabled={sending ? 'true' : undefined} data-testid="ticket-submit">
            {sending ? T.sending : T.file} <kbd>Enter</kbd>
          </button>
        </>
      }
    >
      <div class="ticket">
        <img class="ticket__shot" src={draft.screenshot} alt={T.shotAlt} data-testid="ticket-shot" />
        <div class="ticket__body">
          <div class="ticket__id u-num u-xs u-faint" data-testid="ticket-id">
            {preview ? T.preview(preview) : T.previewNone}
          </div>
          <label class="field">
            <span class="field__label">{T.label}</span>
            <textarea
              ref={field}
              class="input ticket__text"
              rows={6}
              value={text}
              placeholder={T.placeholder}
              data-autofocus
              data-testid="ticket-text"
              onInput={(e) => {
                const v = (e.target as HTMLTextAreaElement).value;
                setText(v);
                if (v.trim() !== '') setEmptyWarned(false);
              }}
              onKeyDown={(e) => {
                // Enter files, Shift+Enter is a new line. The dialog keeps every key from the game's
                // shortcuts (Modal stops propagation) and closes on Esc.
                if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
          </label>
          {emptyWarned ? (
            <span class="field__hint ticket__warn" role="status" data-testid="ticket-empty">
              {T.empty}
            </span>
          ) : (
            <span class="field__hint">{T.hint}</span>
          )}
          {error && (
            <div class="callout callout--bad" role="alert">
              <div class="callout__text">{error}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** F8: capture, ask, file. Resolves when the dialog closes (the caller keeps F8 disabled until then). */
export async function fileTicket(store: AppStore, snap: TicketSnapshot): Promise<void> {
  // State and metadata come from the F8 snapshot; the screenshot starts now, before anything else.
  const meta = collectMeta(snap);
  const state = serializeCareer(store.engine, snap);
  const shot = captureViewport();
  const careerKey = snap.game ? (snap.careerId ?? NO_CAREER_KEY) : NO_CAREER_KEY;
  const [screenshot, { numbers, server }] = await Promise.all([shot, previewNumbers(careerKey)]);
  const draft: Draft = { careerKey, preview: numbers, server, at: snap.at, screenshot, meta, state };

  const host = document.createElement('div');
  host.dataset['ticketTool'] = '';
  document.body.appendChild(host);
  await new Promise<void>((resolve) => {
    const done = (result: Filed | null) => {
      render(null, host);
      host.remove();
      if (result) {
        showToast({
          title: T.saved(result.id),
          sub: result.where === 'server' ? T.savedServer : T.savedLocal,
          kind: 'good',
          action: { label: T.copy, onClick: () => void navigator.clipboard?.writeText(result.id) },
          durationMs: 8000,
        });
      }
      resolve();
    };
    render(<TicketDialog draft={draft} onDone={done} />, host);
  });
}
