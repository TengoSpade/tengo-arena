/**
 * App entry. Loads the UI designer's stylesheets (if present) in cascade
 * order, then mounts the Preact app.
 *
 * import.meta.glob is used for the styles so the build does not fail while
 * src/ui/styles/ is still being written; each glob runs in source order.
 */
import { h, render } from 'preact';
import { loadThemeFiles } from './platform/content-loader';
import { App } from './ui/app/App';

import.meta.glob('./ui/styles/tokens.css', { eager: true });
import.meta.glob('./ui/styles/base.css', { eager: true });
import.meta.glob('./ui/styles/components.css', { eager: true });
import './ui/app/shell.css';

const root = document.getElementById('app');
if (!root) throw new Error('index.html is missing <div id="app">');

render(h(App, { content: loadThemeFiles('default') }), root);
