import { format } from '../../text';

// M2 contract placeholders (05-technical-m2 §A7); WP-M2E replaces this copy with the arena screen's.
const T = {
  eyebrowLive: 'Match day · arena',
  eyebrowReplay: 'Replay',
  title: 'Arena viewer',
  pending: 'Coming with M2',
  pendingText: 'Watching and replaying matches in the arena arrives with milestone M2. Match reports show every result meanwhile.',
  home: 'Home',
} as const;

export function t(key: keyof typeof T, vars?: Record<string, string | number>): string {
  return format(T[key], vars);
}
