/* global window, document, performance, requestAnimationFrame, cancelAnimationFrame, getComputedStyle, indexedDB */
/*
 * Injected into every page the smoke opens (Page.addScriptToEvaluateOnNewDocument). Plain JavaScript, not
 * TypeScript: it is serialised into the browser as text, so it must not depend on the build tool's output.
 * Everything hangs off window.__smoke. Nothing here changes the game; it records and looks.
 */
(() => {
  if (window.__smoke) return;
  const S = {};

  // ---- the arena test hook (05-technical-m2 §A7 "Test hook", tech-027) --------------------------------------
  const arena = () => window.__arena || null;
  const viewer = () => {
    const a = arena();
    return a && a.viewer ? a.viewer : null;
  };
  S.viewerReady = () => !!viewer();

  const read = (v, name) => {
    const x = v ? v[name] : undefined;
    return typeof x === 'function' ? x.call(v) : x;
  };
  /** The viewer's current fight tick: viewer.tick when it has one (cheap), else frame().tick. */
  const readTick = () => {
    const v = viewer();
    if (!v) return NaN;
    try {
      const t = read(v, 'tick');
      if (typeof t === 'number') return t;
      const f = typeof v.frame === 'function' ? v.frame() : null;
      return f && typeof f.tick === 'number' ? f.tick : NaN;
    } catch {
      return NaN;
    }
  };
  S.tick = readTick;

  S.hookInfo = () => {
    const a = arena();
    const v = viewer();
    const names = ['frame', 'seek', 'play', 'pause', 'setSpeed', 'stats', 'logHash', 'loadFixtureRound'];
    const methods = {};
    for (const n of names) methods[n] = !!v && typeof v[n] === 'function';
    return {
      arena: !!a,
      arenaKeys: a ? Object.keys(a) : [],
      viewer: !!v,
      methods,
      extras: v ? ['project', 'viewTransform', 'colors', 'arenaCm', 'playing', 'tick', 'headTick', 'endTick'].filter((n) => v[n] !== undefined) : [],
      hasState: !!a && typeof a.state === 'function',
    };
  };

  // ---- requestAnimationFrame recorder: frame times, the fight tick per frame, named marks -------------------
  const R = { running: false, t: [], k: [], marks: [], id: 0 };
  const loop = (ts) => {
    if (!R.running) return;
    R.t.push(ts);
    R.k.push(readTick());
    R.id = requestAnimationFrame(loop);
  };
  S.rafStart = () => {
    if (R.running) cancelAnimationFrame(R.id);
    R.t = [];
    R.k = [];
    R.marks = [];
    R.running = true;
    R.id = requestAnimationFrame(loop);
    return performance.now();
  };
  S.rafMark = (name) => {
    const t = performance.now();
    R.marks.push({ name, t });
    return t;
  };
  S.rafPeek = () => ({ frames: R.t.length, lastTick: R.k.length ? R.k[R.k.length - 1] : NaN, now: performance.now() });
  S.rafPeekSeries = () => ({ t: R.t.slice(), tick: R.k.slice() });
  S.rafStop = () => {
    R.running = false;
    cancelAnimationFrame(R.id);
    return { t: R.t, tick: R.k, marks: R.marks };
  };

  // ---- GPU and canvas -----------------------------------------------------------------------------------------
  S.gpu = () => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { renderer: null, vendor: null };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
        vendor: ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
      };
    } catch {
      return { renderer: null, vendor: null };
    }
  };

  /** The largest canvas on the page (the arena), its CSS rectangle and whether it holds a live WebGL context. */
  S.canvas = () => {
    const all = Array.from(document.querySelectorAll('canvas'));
    let best = null;
    let area = 0;
    for (const c of all) {
      const r = c.getBoundingClientRect();
      if (r.width * r.height > area) {
        area = r.width * r.height;
        best = c;
      }
    }
    if (!best) return null;
    const r = best.getBoundingClientRect();
    // getContext returns the existing context for its own type and null for another type.
    const gl = (() => {
      try {
        return best.getContext('webgl2') || best.getContext('webgl');
      } catch {
        return null;
      }
    })();
    return {
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      pixelWidth: best.width,
      pixelHeight: best.height,
      count: all.length,
      webgl: !!gl,
      contextLost: gl ? gl.isContextLost() : null,
      label: best.getAttribute('aria-label'),
      role: best.getAttribute('role'),
    };
  };

  /** Resolve CSS custom properties (any colour syntax) to rgb() strings in the current theme. */
  S.palette = (names) => {
    const out = {};
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    document.documentElement.appendChild(probe);
    for (const n of names) {
      probe.style.color = '';
      probe.style.color = 'var(' + n + ')';
      out[n] = getComputedStyle(probe).color;
    }
    probe.remove();
    return out;
  };

  // ---- finding things on the page ----------------------------------------------------------------------------
  const visible = (el) => {
    if (!(el instanceof window.HTMLElement) && !(el instanceof window.SVGElement)) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
  };
  const textOf = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

  /**
   * spec: { css?: string, text?: string (regex source), flags?: string, nth?: number, within?: string }.
   * Returns the first visible match's centre (viewport CSS px) after scrolling it into view, or null.
   */
  S.locate = (spec) => {
    const root = spec.within ? document.querySelector(spec.within) : document;
    if (!root) return null;
    const re = spec.text ? new RegExp(spec.text, spec.flags || 'i') : null;
    const found = [];
    for (const el of Array.from(root.querySelectorAll(spec.css || '*'))) {
      if (!visible(el)) continue;
      if (re && !re.test(textOf(el))) continue;
      // Prefer the innermost match when selecting by text on a generic selector.
      if (re && !spec.css && Array.from(el.children).some((c) => visible(c) && re.test(textOf(c)))) continue;
      found.push(el);
    }
    const el = found[spec.nth || 0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      width: r.width,
      height: r.height,
      text: textOf(el).slice(0, 120),
      testId: el.getAttribute('data-testid'),
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      tag: el.tagName.toLowerCase(),
    };
  };

  S.exists = (css) => !!document.querySelector(css);
  S.count = (css) => document.querySelectorAll(css).length;
  S.textOfFirst = (css) => {
    const el = document.querySelector(css);
    return el ? textOf(el) : null;
  };

  /** Buttons and links on the page, for the diagnostics of a step that could not find its control. */
  S.controls = () =>
    Array.from(document.querySelectorAll('button, a[href], [role="button"], input, select'))
      .filter(visible)
      .slice(0, 60)
      .map((el) => ({ tag: el.tagName.toLowerCase(), testId: el.getAttribute('data-testid'), text: textOf(el).slice(0, 60), disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true' }));

  S.pageText = (max) => (document.body ? document.body.innerText : '').replace(/\n{3,}/g, '\n\n').slice(0, max || 1500);

  /**
   * What is on screen, as text and structure, for the vis-003 pre-check: all visible text, the live regions,
   * and every element that carries a role glyph (data-role) with the text of its row.
   */
  S.evidence = () => {
    const rows = Array.from(document.querySelectorAll('[data-role]'))
      .filter(visible)
      .map((el) => {
        const row = el.closest('[data-unit],[data-fighter],li,tr,[role="listitem"],button') || el.parentElement;
        return { role: el.getAttribute('data-role'), aria: el.getAttribute('aria-label'), row: row ? textOf(row).slice(0, 160) : '' };
      });
    return {
      text: document.body ? document.body.innerText : '',
      live: Array.from(document.querySelectorAll('[aria-live]')).map((el) => textOf(el)),
      roles: rows,
      canvasLabel: (() => {
        const c = S.canvas();
        return c ? c.label : null;
      })(),
      hash: window.location.hash,
    };
  };

  /**
   * The game's own saves, as the page's IndexedDB holds them (src/platform/save-store.idb.ts: database arena-league,
   * store saves, records { slotId, meta, json }): the slot asked for and only that one (null when it is not there: a
   * stale or different save must never stand in for it); with no slot given, the newest. Opening a database that does not exist
   * would create it empty and break the app's own first open, so the page asks which databases exist first.
   */
  S.readSave = async (slot) => {
    const dbs = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
    if (!dbs.some((d) => d.name === 'arena-league')) return null;
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('arena-league');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains('saves')) return null;
      const store = db.transaction('saves', 'readonly').objectStore('saves');
      const ask = (req) =>
        new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      let rec = slot ? await ask(store.get(slot)) : undefined;
      if (!rec && !slot) {
        const all = await ask(store.getAll());
        all.sort((a, b) => String((b.meta && b.meta.savedAt) || '').localeCompare(String((a.meta && a.meta.savedAt) || '')));
        rec = all[0];
      }
      return rec ? { slotId: rec.slotId, savedAt: (rec.meta && rec.meta.savedAt) || null, json: rec.json } : null;
    } finally {
      db.close();
    }
  };

  window.__smoke = S;
})();
