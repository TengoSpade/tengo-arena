/**
 * App entry. Loads the UI designer's stylesheets in cascade order, builds
 * the browser platform (IndexedDB saves, file download/upload, clock,
 * entropy), the store, validates the content theme, then mounts the app.
 *
 * Dev builds: the dev engine (real core first, provisional stand-ins for
 * unfinished core functions), `?dev-world=<weekIndex>&club=<clubId>`
 * to open straight into a dev career, and `?dev-state=<name>` to open a
 * real career snapshot from /reports/states/<name>.json (`{ state,
 * seasonEndReport? }`, written by a headless script; screenshots, reviews).
 */
import { h, render } from 'preact';
import pkg from '../package.json';
import { browserClock, browserEntropy, browserFileIO } from './platform/browser';
import { loadThemeFiles } from './platform/content-loader';
import { createIdbSaveStore } from './platform/save-store.idb';
import { createMemorySaveStore } from './platform/save-store.memory';
import { App } from './ui/app/App';
import type { GameState, SeasonEndReport } from './core/model';
import { createGameStore, settings, type GameEngine } from './ui/store';

import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/app/shell.css';

const root = document.getElementById('app');
if (!root) throw new Error('index.html is missing <div id="app">');

const dev = import.meta.env.DEV;
const query = new URLSearchParams(location.search);
// Review hooks (like the mockups' ?theme=): not persisted.
const themeParam = query.get('theme');
if (themeParam === 'light' || themeParam === 'dark') settings.value = { ...settings.value, theme: themeParam };
let engine: GameEngine | undefined;
if (dev) engine = (await import('./ui/debug/dev-engine')).createDevEngine();

const store = createGameStore({
  saves: typeof indexedDB !== 'undefined' ? createIdbSaveStore() : createMemorySaveStore(),
  clock: browserClock,
  files: browserFileIO,
  entropy: browserEntropy,
  loadTheme: (themeId) => loadThemeFiles(themeId).raw,
  gameVersion: pkg.version,
  dev,
  engine,
  userAgent: navigator.userAgent,
});
store.initContent('default');

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

render(h(App, { store }), root);
