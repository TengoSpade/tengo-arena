import { format } from '../text';

const T = {
  title: '{name} reached level {level}',
  lead: 'Choose one. Every option is permanent; the rest are gone.',
  options: 'Level-up options',
  kindStat: 'Stat',
  kindRank: 'Ability rank',
  kindPerk: 'Perk',
  rating: 'rating {n}',
  ratingUp: 'Rating {from} → {to}',
  ratingSame: 'Rating stays {n}',
  rankPips: 'Rank {n} of 3',
  autoMark: 'auto',
  illegal: 'No longer possible: it reached its cap or a requirement changed since the offer.',
  empty: 'Nothing left to improve: an empty level (it still counts).',
  queue: '{n} waiting',
  traitTitle: 'Also offered: a trait (optional)',
  traitLead: 'Take one of the two, or neither. A learned trait is permanent.',
  neither: 'Neither',
  later: 'Later',
  laterTip: 'Keep it waiting (up to 3; a 4th resolves the oldest by his auto-pick policy). It never blocks Continue.',
  auto: 'Auto-pick',
  autoTip: 'Takes what his policy would: {pick}.',
  autoNone: 'an empty level',
  confirm: 'Confirm',
  pickFirst: 'Pick one of the options first (1–3).',
  keys: '1–3 option · 4/5 trait · 6 neither · A auto-pick · Enter confirm',
  keysNoTrait: '1–3 option · A auto-pick · Enter confirm',
  mode: 'Level-ups',
  modeTip: 'Ask me opens this dialog; the auto modes pick for him (stats, skills or balanced). "Club default" follows Settings › Match day.',
  modeInherit: 'Club default',
  modeManual: 'Ask me',
  modeAuto: 'Auto (balanced)',
  modeStats: 'Auto (favour stats)',
  modeSkills: 'Auto (favour skills)',
} as const;

export type LevelUpTextKey = keyof typeof T;

export function t(key: LevelUpTextKey, vars?: Record<string, string | number>): string {
  return format(T[key], vars);
}
