/**
 * Playtest ticket tool (lazy chunk, loaded on the first F8): screenshot of the viewport as the
 * player sees it, then a one-field dialog (Enter files, Shift+Enter new line, Esc cancels), then the
 * ticket goes to the dev-server plugin (`npm run dev`: <repo>/tickets/<id>/) or, without it, to
 * IndexedDB (Settings › Tickets exports them).
 *
 * Screenshot: modern-screenshot (MIT) renders the DOM to SVG/canvas with computed styles inlined, so
 * the design-system CSS and both themes come out as drawn; `restoreScrollPosition` keeps the main
 * column scrolled as the player had it; canvas elements are copied as images (the M2 PixiJS viewer
 * needs `preserveDrawingBuffer` for that).
 */
import { render } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { version as gameVersion } from '../../../package.json';
import type { Command } from '../../core/model';
import { ENGINE_VERSION } from '../../core/sim';
import { createLocalTicketStore, idbTicketKv, type StoredTicket } from '../../platform/tickets/local-store';
import { ticketId, weekCode } from '../../platform/tickets/naming';
import { matchRoute } from '../app/routes';
import { Modal } from '../components/Modal';
import { showToast, toastHistory } from '../components/Toast';
import type { AppStore } from '../store';
import { effectiveTheme, settings } from '../store/settings';
import { consoleEntries } from './console-capture';
import { T, ticketIdFor, type TicketNumbers } from './tool-text';
import './tickets.css';

// ---- capture -------------------------------------------------------------------------------------------------

/** The visible viewport as a PNG data URL (before the dialog opens, so it is not in the picture). */
export async function captureViewport(): Promise<string> {
  const { domToPng } = await import('modern-screenshot');
  const body = document.body;
  return domToPng(body, {
    width: window.innerWidth,
    height: window.innerHeight,
    scale: Math.min(2, window.devicePixelRatio || 1),
    backgroundColor: getComputedStyle(body).backgroundColor || null,
    features: { restoreScrollPosition: true },
    // Nothing of the ticket tool itself, and no scripts.
    filter: (node) => !(node instanceof HTMLElement && (node.dataset['ticketTool'] !== undefined || node.tagName === 'SCRIPT')),
  });
}

/** Everything ticket.json records besides the text (route, week, build, logs). */
export function collectMeta(store: AppStore, at: Date): Record<string, unknown> {
  const g = store.game.value;
  const c = store.content.value;
  const m = matchRoute(location.hash);
  const club = g?.playerClubId ? g.clubs[g.playerClubId] : undefined;
  return {
    created: at.toISOString(),
    createdLocal: at.toLocaleString(),
    screen: m?.route.id ?? 'unknown',
    route: { hash: location.hash, id: m?.route.id ?? null, params: m?.params ?? {} },
    week: g ? weekCode(g.calendar) : null,
    calendar: g ? { season: g.calendar.season, phase: g.calendar.phase, weekIndex: g.calendar.weekIndex, weekId: g.calendar.weekId } : null,
    career: g ? { rootSeed: g.rng.root, playerClubId: g.playerClubId, club: club?.name ?? null } : null,
    gameVersion,
    engineVersion: ENGINE_VERSION,
    contentHash: g?.content.hash ?? c?.ref.hash ?? null,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio || 1,
    theme: effectiveTheme(settings.value),
    pacing: settings.value.pacing,
    userAgent: navigator.userAgent,
    recentCommands: store.recentCommands.value.slice(-20) as readonly { seq: number; season: number; weekIndex: number; command: Command }[],
    console: consoleEntries(),
    toasts: toastHistory.slice(-10),
  };
}

/** The career as the existing save serializer writes it, or null before a career exists. */
export function serializeCareer(store: AppStore, at: Date): string | null {
  const g = store.game.value;
  if (!g) return null;
  const e = store.engine;
  const meta = e.saveMetaFor(g, { slotId: 'ticket', kind: 'manual', label: 'Ticket', savedAt: at.toISOString(), playtimeSec: 0, gameVersion });
  return e.serializeSave(e.createSave(g, meta, { engineVersion: ENGINE_VERSION }, store.commandLog.value));
}

// ---- storage ------------------------------------------------------------------------------------------------

let local: ReturnType<typeof createLocalTicketStore> | null = null;
const localStore = () => (local ??= createLocalTicketStore(idbTicketKv()));

/** The dev-server plugin answers only under `npm run dev`. */
async function serverNext(careerKey: string): Promise<TicketNumbers | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const res = await fetch(`/__tickets/next?career=${encodeURIComponent(careerKey)}`);
    return res.ok ? ((await res.json()) as TicketNumbers) : null;
  } catch {
    return null;
  }
}

interface Draft {
  careerKey: string;
  numbers: TicketNumbers;
  server: boolean;
  at: Date;
  screenshot: string;
  meta: Record<string, unknown>;
  state: string | null;
}

/** Write a ticket: the dev server, else (or if it fails) IndexedDB. Returns where it went. */
export async function submitTicket(d: Draft, text: string): Promise<{ id: string; where: 'server' | 'local' }> {
  const id = ticketIdFor(d.numbers, d.at);
  if (d.server) {
    try {
      const res = await fetch('/__tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, run: d.numbers.run, ticket: d.numbers.ticket, careerKey: d.careerKey, text, screenshot: d.screenshot, state: d.state, meta: d.meta }),
      });
      if (res.ok) return { id, where: 'server' };
      console.warn('ticket server refused', res.status, await res.text());
    } catch (e) {
      console.warn('ticket server unreachable', e);
    }
  }
  // Fallback numbering is the local store's own (it may differ from the server's).
  const numbers = d.server ? await localStore().next(d.careerKey) : d.numbers;
  const localId = ticketId(numbers.run, numbers.ticket, d.at);
  const t: StoredTicket = { id: localId, run: numbers.run, ticket: numbers.ticket, careerKey: d.careerKey, screenshot: d.screenshot, state: d.state, meta: { ...d.meta, id: localId, run: numbers.run, ticket: numbers.ticket, text } };
  await localStore().save(t);
  return { id: localId, where: 'local' };
}

// ---- dialog ---------------------------------------------------------------------------------------------------

export function TicketDialog({ draft, onDone }: { draft: Draft; onDone: (result: { id: string; where: 'server' | 'local' } | null) => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const id = ticketIdFor(draft.numbers, draft.at);

  const submit = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      onDone(await submitTicket(draft, text.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
          <div class="ticket__id u-num u-xs u-faint" data-testid="ticket-id">{id}</div>
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
              onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
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
          <span class="field__hint">{T.hint}</span>
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
export async function fileTicket(store: AppStore): Promise<void> {
  const at = new Date();
  const screenshot = await captureViewport();
  const g = store.game.value;
  const careerKey = g ? g.rng.root : 'no-career';
  const fromServer = await serverNext(careerKey);
  const numbers = fromServer ?? (await localStore().next(careerKey));
  const draft: Draft = { careerKey, numbers, server: fromServer !== null, at, screenshot, meta: collectMeta(store, at), state: serializeCareer(store, at) };

  const host = document.createElement('div');
  host.dataset['ticketTool'] = '';
  document.body.appendChild(host);
  await new Promise<void>((resolve) => {
    const done = (result: { id: string; where: 'server' | 'local' } | null) => {
      render(null, host);
      host.remove();
      if (result) {
        showToast({
          title: `Ticket ${result.id} saved`,
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
