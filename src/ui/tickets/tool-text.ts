/** Ticket tool copy and small helpers (lazy chunk with ./tool). */
import { ticketShort } from '../../platform/tickets/naming';

export interface TicketNumbers {
  run: number;
  ticket: number;
}

export const T = {
  title: 'Report an issue',
  label: 'What happened, or what would you change?',
  placeholder: 'One line is enough. The screenshot, the game state and the screen are attached.',
  hint: 'Enter files the ticket · Shift+Enter for a new line · Esc cancels',
  empty: 'Add a note, or press Enter again to file without one.',
  preview: (short: string) => `${short} · number confirmed when filed`,
  previewNone: 'Number assigned when filed',
  footer: 'Screenshot, save and recent log go with it.',
  file: 'File ticket',
  sending: 'Filing…',
  cancel: 'Cancel',
  shotAlt: 'Screenshot of the screen when you pressed F8',
  copy: 'Copy ID',
  /** Toast title: the short id; Copy ID copies the full one. */
  saved: (id: string) => `Ticket ${ticketShort(id)} saved`,
  savedServer: 'Written to tickets/ in the project folder.',
  savedLocal: 'Stored in this browser (Settings › Tickets to export).',
  notSaved: 'Ticket not saved',
  noStorage: 'This browser cannot store tickets (IndexedDB unavailable) and the dev server did not take it',
} as const;
