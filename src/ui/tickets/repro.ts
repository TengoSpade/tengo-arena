/**
 * Reproduce a playtest ticket in dev (`?ticket=<id>`): fetch its save and metadata from the
 * dev-server plugin, write the save to its own slot `ticket-<id>`, load it and open the same
 * route. The original save is never touched; the frame shows a banner while it is loaded.
 */
import type { SaveStore } from '../../platform/save-store';
import { TICKET_ID_RE } from '../../platform/tickets/naming';
import { showToast } from '../components/Toast';
import type { AppStore } from '../store';
import { reproducingTicket } from './launcher';

export async function reproduceTicket(store: AppStore, saves: SaveStore, id: string): Promise<boolean> {
  if (!TICKET_ID_RE.test(id)) {
    console.error(`?ticket=${id}: not a ticket id`);
    return false;
  }
  const content = store.content.value;
  if (!content) return false;
  try {
    const [stateRes, metaRes] = await Promise.all([fetch(`/__tickets/${id}/state.json`), fetch(`/__tickets/${id}/ticket.json`)]);
    if (!stateRes.ok || !metaRes.ok) throw new Error(`ticket ${id} not found (${stateRes.status})`);
    const json = await stateRes.text();
    const meta = (await metaRes.json()) as { route?: { hash?: string } };
    if ((JSON.parse(json) as { noCareer?: boolean }).noCareer) throw new Error(`ticket ${id} was filed before a career existed`);
    const parsed = store.engine.parseSave(json, content);
    if (!parsed.ok) throw new Error(`ticket ${id}: ${parsed.error.code} ${parsed.error.message}`);
    const slotId = `ticket-${id}`;
    const envelope = { ...parsed.value.envelope, meta: { ...parsed.value.envelope.meta, slotId, kind: 'manual' as const, label: `Ticket ${id}` } };
    await saves.write(slotId, store.engine.serializeSave(envelope), envelope.meta);
    const loaded = await store.load(slotId);
    if (!loaded.ok) throw new Error(`ticket ${id}: ${loaded.error.code}`);
    reproducingTicket.value = id;
    const hash = meta.route?.hash;
    location.hash = hash && hash.startsWith('#/') ? hash : '#/home';
    return true;
  } catch (e) {
    console.error('ticket reproduction failed', e);
    showToast({ title: 'Ticket could not be loaded', sub: e instanceof Error ? e.message : String(e), kind: 'bad' });
    return false;
  }
}
