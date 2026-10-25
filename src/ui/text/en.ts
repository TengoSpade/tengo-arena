/**
 * UI copy (English). Generic interface wording only: buttons, headings,
 * labels. Theme content (fighter, class, club, league and currency names,
 * flavour text) comes from content JSON, never from here.
 */
export const en = {
  'app.title': 'Arena League',
  'shell.eyebrow': 'Development build',
  'shell.subtitle': 'Project scaffold. Management screens arrive in M1.',
  'shell.content.title': 'Content files',
  'shell.content.found': 'found',
  'shell.content.missing': 'missing',
  'shell.content.extra': 'Other files',
  'shell.build.title': 'Build',
  'shell.build.theme': 'Theme',
  'shell.build.engine': 'Sim engine version',
  'shell.build.schema': 'Save schema version',
  'shell.build.rng': 'RNG self-check',
  'shell.build.rng.ok': 'deterministic',
  'shell.build.rng.fail': 'MISMATCH',
} as const;

export type TextKey = keyof typeof en;
