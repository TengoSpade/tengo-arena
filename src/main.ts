/**
 * App entry. Loads the UI designer's stylesheets in cascade order, starts
 * fetching the content chunk (the theme JSON is not part of this bundle; index.html
 * shows a loading state meanwhile), builds the browser platform (IndexedDB saves,
 * file download/upload, clock, entropy), the store, validates the content theme
 * once the chunk is in, then mounts the app. A chunk that cannot be loaded ends
 * on the content-error screen like invalid content does.
 *
 * Dev builds: the dev engine (real core first, provisional stand-ins for
 * unfinished core functions), `?dev-world=<weekIndex>&club=<clubId>`
 * to open straight into a dev career, and `?dev-state=<name>` to open a
 * real career snapshot from /reports/states/<name>.json (`{ state,
 * seasonEndReport? }`, written by a headless script; screenshots, reviews), and `?ticket=<id>` to
 * reproduce a playtest ticket (F8) from tickets/<id>/ in its own save slot.
 */
import { h, render } from 'preact';
import { version as gameVersion } from '../package.json';
import { browserClock, browserEntropy, browserFileIO } from './platform/browser';
import { loadBundledTheme } from './platform/content-loader';
import { createIdbSaveStore } from './platform/save-store.idb';
import { createMemorySaveStore } from './platform/save-store.memory';
import { App } from './ui/app/App';
import type { RawContentFiles } from './core/content';
import type { GameState, SeasonEndReport } from './core/model';
import { applySettingsToDocument, createGameStore, settings, type GameEngine } from './ui/store';
import { installConsoleCapture } from './ui/tickets/console-capture';

import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/app/shell.css';

// First: playtest tickets record the last console errors and warnings from here on.
installConsoleCapture();

// Next: the content chunk downloads while the rest of this module runs. The rejection is caught here, so it
// is never reported as unhandled; initContent below turns it into the content-error screen.
const THEME_ID = 'default';
const themeLoad = loadBundledTheme(THEME_ID).then(
  (theme): { raw: RawContentFiles; hash?: string } => ({ raw: theme.raw, hash: theme.hash }),
  (e: unknown): { error: Error } => ({ error: new Error(`The content bundle could not be loaded: ${e instanceof Error ? e.message : String(e)}`) }),
);

const root = document.getElementById('app');
if (!root) throw new Error('index.html is missing <div id="app">');

const dev = import.meta.env.DEV;
const query = new URLSearchParams(location.search);
// Review hooks (like the mockups' ?theme=): not persisted.
const themeParam = query.get('theme');
if (themeParam === 'light' || themeParam === 'dark') settings.value = { ...settings.value, theme: themeParam };
// The player's theme and scale apply now, so the loading state of index.html already wears them.
applySettingsToDocument();
let engine: GameEngine | undefined;
if (dev) engine = (await import('./ui/debug/dev-engine')).createDevEngine();

const theme = await themeLoad;

const saves = typeof indexedDB !== 'undefined' ? createIdbSaveStore() : createMemorySaveStore();
const store = createGameStore({
  saves,
  clock: browserClock,
  files: browserFileIO,
  entropy: browserEntropy,
  loadTheme: () => {
    if ('error' in theme) throw theme.error;
    return theme.raw;
  },
  contentHash: () => ('error' in theme ? undefined : theme.hash),
  gameVersion,
  dev,
  engine,
  userAgent: navigator.userAgent,
});
store.initContent(THEME_ID);

if (dev) {
  const week = query.get('dev-world');
  const content = store.content.value;
  if (week !== null && content) {
    const { buildDevWorld } = await import('./ui/debug/dev-world');
    const clubParam = query.get('club');
    const club = clubParam === 'none' ? null : (clubParam ?? content.clubs.list.find((c) => c.startTierLevel === 2)?.id ?? content.clubs.list[0]!.id);
    store.replaceWorld(buildDevWorld(content, { playerClubId: club, weekIndex: Number(week) || 11 }));
    if (!location.hash || location.hash === '#/' || location.hash === '#/new-game') location.hash = club ? '#/home' : '#/club-select';
  }
}

if (dev) {
  const stateName = query.get('dev-state');
  if (stateName && /^[\w-]+$/.test(stateName)) {
    try {
      const res = await fetch(`/reports/states/${stateName}.json`);
      const snap = (await res.json()) as { state: GameState; seasonEndReport?: SeasonEndReport | null };
      store.replaceWorld(snap.state, undefined, { seasonEnd: snap.seasonEndReport ?? null });
      if (!location.hash || location.hash === '#/' || location.hash === '#/new-game') location.hash = '#/home';
    } catch (e) {
      console.error('dev-state could not be loaded', e);
    }
  }
}

if (dev) {
  // ?ticket=<id>: load a playtest ticket's save (served by the dev-server plugin) into its own slot.
  const ticket = query.get('ticket');
  if (ticket) {
    const { reproduceTicket } = await import('./ui/tickets/repro');
    await reproduceTicket(store, saves, ticket);
  }
}

// The static loading state of index.html goes; the app takes the page.
root.replaceChildren();
render(h(App, { store }), root);
