/* Arena League mockups: demo behaviour only (tooltips, sorting, tabs, modals,
   shortcuts, theme, toasts). Not production code; the architect owns src/.
   Every feature here is described in docs/design/_drafts/04-presentation.md. */
(function () {
  'use strict';
  var root = document.documentElement;

  /* ---------- storage (never required) ---------- */
  function load(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function save(key, v) { try { window.localStorage.setItem(key, v); } catch (e) { /* ignore */ } }

  /* ---------- theme ---------- */
  var params = new URLSearchParams(location.search);
  var theme = params.get('theme') || load('al-theme') || 'dark';
  root.setAttribute('data-theme', theme);
  if (params.get('scale')) root.style.setProperty('--ui-scale', params.get('scale'));

  function setTheme(t) {
    root.setAttribute('data-theme', t);
    save('al-theme', t);
    document.querySelectorAll('[data-action="theme"] .icon').forEach(function (i) {
      i.setAttribute('data-icon', t === 'dark' ? 'sun' : 'moon');
    });
  }

  /* ---------- toasts ---------- */
  function region() {
    var r = document.querySelector('.toast-region');
    if (!r) {
      r = document.createElement('div');
      r.className = 'toast-region';
      r.setAttribute('role', 'status');
      r.setAttribute('aria-live', 'polite');
      document.body.appendChild(r);
    }
    return r;
  }
  function toast(title, sub, kind, undo) {
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' toast--' + kind : '');
    t.innerHTML = '<span class="icon" data-icon="' + (kind === 'bad' ? 'warning' : kind === 'good' ? 'check' : 'info') + '" aria-hidden="true"></span>' +
      '<div class="toast__text"><div class="toast__title"></div>' + (sub ? '<div class="toast__sub"></div>' : '') + '</div>' +
      (undo ? '<button class="btn btn--sm btn--ghost toast__action" type="button"><span class="icon" data-icon="undo" aria-hidden="true"></span>Undo <kbd>Ctrl Z</kbd></button>' : '') +
      '<button class="icon-btn" type="button" aria-label="Dismiss"><span class="icon" data-icon="close" aria-hidden="true"></span></button>';
    t.querySelector('.toast__title').textContent = title;
    if (sub) t.querySelector('.toast__sub').textContent = sub;
    function close() { t.classList.add('is-leaving'); setTimeout(function () { t.remove(); }, 200); }
    t.querySelector('.icon-btn').addEventListener('click', close);
    if (undo) t.querySelector('.toast__action').addEventListener('click', function () { undo(); close(); });
    region().appendChild(t);
    setTimeout(close, undo ? 8000 : 5000);
  }
  window.alToast = toast;

  /* ---------- tooltips ---------- */
  var tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.id = 'al-tooltip';
  var tipTimer = null, tipTarget = null, pinned = false;

  function fillTip(el) {
    var ref = el.getAttribute('data-tip-ref');
    if (ref) {
      var tpl = document.getElementById(ref);
      tip.className = 'tooltip';
      tip.innerHTML = tpl ? tpl.innerHTML : '';
    } else {
      tip.className = 'tooltip tooltip--plain';
      tip.textContent = el.getAttribute('data-tip');
    }
  }
  function placeTip(el) {
    var r = el.getBoundingClientRect();
    var tr = tip.getBoundingClientRect();
    var gap = 8;
    var top = r.top - tr.height - gap;
    if (top < 8) top = r.bottom + gap;
    var left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
    if (top + tr.height > window.innerHeight - 8) top = window.innerHeight - tr.height - 8;
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }
  function showTip(el, now) {
    clearTimeout(tipTimer);
    var go = function () {
      if (!tip.isConnected) document.body.appendChild(tip);
      tipTarget = el;
      fillTip(el);
      tip.removeAttribute('data-open');
      tip.style.top = '-9999px';
      placeTip(el); // reads layout synchronously, so the fade-in transition still runs
      tip.setAttribute('data-open', '');
      el.setAttribute('aria-describedby', 'al-tooltip');
    };
    if (now) go(); else tipTimer = setTimeout(go, 280);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    if (pinned) return;
    tip.removeAttribute('data-open');
    if (tipTarget) tipTarget.removeAttribute('aria-describedby');
    tipTarget = null;
  }
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest('[data-tip],[data-tip-ref]');
    if (el && el !== tipTarget) { pinned = false; showTip(el, false); }
  });
  document.addEventListener('mouseout', function (e) {
    var el = e.target.closest('[data-tip],[data-tip-ref]');
    if (el && !el.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest('[data-tip],[data-tip-ref]');
    if (el) showTip(el, true);
  });
  document.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', function () { if (!pinned) hideTip(); }, true);

  /* ---------- sortable tables ---------- */
  function cellValue(row, idx) {
    var c = row.children[idx];
    if (!c) return '';
    var v = c.getAttribute('data-sort');
    if (v === null) v = c.textContent.trim();
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) || /[a-z]/i.test(v) && c.getAttribute('data-sort') === null ? String(v).toLowerCase() : n;
  }
  document.querySelectorAll('table[data-sortable]').forEach(function (table) {
    table.querySelectorAll('thead th .th-sort').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var th = btn.closest('th');
        var idx = Array.prototype.indexOf.call(th.parentNode.children, th);
        var dir = th.getAttribute('aria-sort') === 'descending' ? 'ascending' : 'descending';
        table.querySelectorAll('thead th[aria-sort]').forEach(function (o) { o.removeAttribute('aria-sort'); });
        th.setAttribute('aria-sort', dir);
        var body = table.tBodies[0];
        var rows = Array.prototype.slice.call(body.rows);
        rows.sort(function (a, b) {
          var x = cellValue(a, idx), y = cellValue(b, idx);
          var c = x > y ? 1 : x < y ? -1 : 0;
          return dir === 'ascending' ? c : -c;
        });
        rows.forEach(function (r) { body.appendChild(r); });
      });
    });
  });

  /* ---------- tabs ---------- */
  document.querySelectorAll('[role="tablist"]').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    function select(t) {
      tabs.forEach(function (o) {
        var on = o === t;
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        o.tabIndex = on ? 0 : -1;
        var p = o.getAttribute('aria-controls') && document.getElementById(o.getAttribute('aria-controls'));
        if (p) p.hidden = !on;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (k) { e.preventDefault(); var n = tabs[(i + k + tabs.length) % tabs.length]; n.focus(); select(n); }
      });
    });
  });

  /* ---------- segmented controls and toggles ---------- */
  document.querySelectorAll('.segmented').forEach(function (seg) {
    seg.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        seg.querySelectorAll('button').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        var show = b.getAttribute('data-show');
        if (show) {
          (seg.getAttribute('data-group') ? document.querySelectorAll('[data-pane="' + seg.getAttribute('data-group') + '"]') : []).forEach(function (p) {
            p.hidden = p.id !== show;
          });
        }
      });
    });
  });
  document.querySelectorAll('[data-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
  });

  /* ---------- modals ---------- */
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-open-modal]');
    if (opener) {
      var d = document.getElementById(opener.getAttribute('data-open-modal'));
      if (d && d.showModal) { hideTip(); d.showModal(); }
    }
    var closer = e.target.closest('[data-close]');
    if (closer) {
      var dlg = closer.closest('dialog');
      if (dlg) dlg.close();
      var msg = closer.getAttribute('data-close');
      if (msg) toast(msg, closer.getAttribute('data-close-sub'), closer.getAttribute('data-close-kind') || 'good',
        closer.hasAttribute('data-undo') ? function () { toast('Undone', 'Nothing was changed.', 'info'); } : null);
    }
    var tst = e.target.closest('[data-toast]');
    if (tst) toast(tst.getAttribute('data-toast'), tst.getAttribute('data-toast-sub'), tst.getAttribute('data-toast-kind'));
    var th = e.target.closest('[data-action="theme"]');
    if (th) setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
  document.querySelectorAll('dialog.modal').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  /* ---------- keyboard shortcuts ---------- */
  function typing(e) {
    var t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { pinned = false; hideTip(); return; }
    if (e.key === 'Shift' && tipTarget) { pinned = true; return; }
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toast('Search (Ctrl K)', 'Mockup: opens a quick-jump palette for fighters, clubs, classes and screens.', 'info');
      }
      return;
    }
    if (document.querySelector('dialog[open]')) return;
    var nav = document.querySelector('.sidenav a[data-key="' + e.key + '"]');
    if (nav) { e.preventDefault(); nav.click(); return; }
    if (e.key === '?') {
      var sc = document.getElementById('shortcuts');
      if (sc) { e.preventDefault(); sc.showModal(); }
      return;
    }
    if (e.key === ' ' || e.code === 'Space') {
      var c = document.querySelector('.continue');
      if (c) { e.preventDefault(); c.click(); }
      return;
    }
    var hot = document.querySelector('[data-hotkey="' + e.key.toLowerCase() + '"]');
    if (hot) { e.preventDefault(); hot.click(); hot.focus(); }
  });

  /* ---------- small page helpers ---------- */
  // Compare checkboxes (market)
  var tray = document.querySelector('[data-compare-count]');
  if (tray) {
    var update = function () {
      var n = document.querySelectorAll('input[data-compare]:checked').length;
      tray.textContent = n;
      document.querySelectorAll('[data-compare-needs]').forEach(function (b) {
        b.setAttribute('aria-disabled', n < 2 ? 'true' : 'false');
      });
    };
    document.querySelectorAll('input[data-compare]').forEach(function (c) { c.addEventListener('change', update); });
    update();
  }
  // Digest: mark done
  document.querySelectorAll('[data-done]').forEach(function (b) {
    b.addEventListener('click', function () {
      var li = b.closest('.digest__item');
      if (!li) return;
      li.classList.add('is-done');
      li.removeAttribute('data-unread');
      toast('Marked as done', li.querySelector('.digest__title span').textContent, 'good', function () {
        li.classList.remove('is-done');
      });
    });
  });
  // Lineup card selection
  document.querySelectorAll('.lineup-card[tabindex]').forEach(function (card) {
    card.addEventListener('click', function () {
      document.querySelectorAll('.lineup-card[aria-selected]').forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
      card.setAttribute('aria-selected', 'true');
    });
  });

  /* ---------- colour-vision simulation (review aid, components page) ---------- */
  var cvd = document.getElementById('cvd');
  if (cvd) {
    var svgNS = 'http://www.w3.org/2000/svg';
    var mats = {
      deutan: '0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0',
      protan: '0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0',
      tritan: '1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0',
      gray: '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0'
    };
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    Object.keys(mats).forEach(function (k) {
      var f = document.createElementNS(svgNS, 'filter');
      f.id = 'cvd-' + k;
      var m = document.createElementNS(svgNS, 'feColorMatrix');
      m.setAttribute('type', 'matrix');
      m.setAttribute('values', mats[k]);
      f.appendChild(m);
      svg.appendChild(f);
    });
    document.body.appendChild(svg);
    var applyCvd = function () {
      var target = document.querySelector('.main') || document.body;
      target.style.filter = cvd.value === 'none' ? '' : 'url(#cvd-' + cvd.value + ')';
    };
    cvd.addEventListener('change', applyCvd);
    if (params.get('cvd') && mats[params.get('cvd')]) { cvd.value = params.get('cvd'); applyCvd(); }
  }

  /* ---------- token swatches (components page) ---------- */
  document.querySelectorAll('[data-swatch]').forEach(function (s) {
    var name = s.getAttribute('data-swatch');
    s.style.setProperty('--swatch', 'var(' + name + ')');
    var out = s.querySelector('[data-swatch-value]');
    var paint = function () {
      if (out) out.textContent = getComputedStyle(root).getPropertyValue(name).trim();
    };
    paint();
    new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  });

  setTheme(theme);

  /* ---------- review hook: ?open=<dialog id> opens a dialog on load ---------- */
  var openId = params.get('open');
  if (openId) {
    var dlgToOpen = document.getElementById(openId);
    if (dlgToOpen && dlgToOpen.showModal) dlgToOpen.showModal();
  }
})();
