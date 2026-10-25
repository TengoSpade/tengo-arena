/** Where a blocker is decided (Continue "Decide first" and digest actions jump there). */
export function blockerTarget(code: string): string {
  if (code.startsWith('lineup.') || code.startsWith('captain.') || code.startsWith('roster.')) return '#/squad';
  if (code === 'club.not-chosen') return '#/club-select';
  if (code.startsWith('contract.') || code.startsWith('offer.')) return '#/market';
  return '#/home';
}
