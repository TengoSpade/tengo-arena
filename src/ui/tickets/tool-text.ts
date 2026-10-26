/** Ticket tool copy and small helpers (lazy chunk with ./tool). */
import { ticketId } from '../../platform/tickets/naming';

export interface TicketNumbers {
  run: number;
  ticket: number;
}

export function ticketIdFor(n: TicketNumbers, at: Date): string {
  return ticketId(n.run, n.ticket, at);
}

export const T = {
  title: 'Report an issue',
  label: 'What happened, or what would you change?',
  placeholder: 'One line is enough. The screenshot, the game state and the screen are attached.',
  hint: 'Enter files the ticket · Shift+Enter for a new line · Esc cancels',
  footer: 'Screenshot, save and recent log go with it.',
  file: 'File ticket',
  sending: 'Filing…',
  cancel: 'Cancel',
  shotAlt: 'Screenshot of the screen when you pressed F8',
  copy: 'Copy ID',
  savedServer: 'Written to tickets/ in the project folder.',
  savedLocal: 'Stored in this browser (Settings › Tickets to export).',
} as const;
