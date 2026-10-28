/* Arena screen mock: demo behaviour only (state switch, pause and speed, reduced motion, focus-ring demo,
   color-vision simulation). Not production code; the viewer and the screen are built by WP-M2D and WP-M2E.
   Loaded after mockups.js, which provides theme, tooltips, toasts and the color-vision filters. */
(function () {
  'use strict';
  var root = document.documentElement;
  var screen = document.getElementById('arena');
  var play = document.getElementById('play');
  var params = new URLSearchParams(location.search);
  var STATES = ['play', 'live', 'paused', 'round-end', 'replay'];
  var state = STATES.indexOf(params.get('state')) >= 0 ? params.get('state') : 'paused';
  var buttons = document.querySelectorAll('[data-state-btn]');

  function setState(s) {
    state = s;
    var isPlay = s === 'play';
    play.hidden = !isPlay;
    screen.hidden = isPlay;
    if (!isPlay) {
      screen.setAttribute('data-state', s);
      screen.querySelectorAll('[data-only]').forEach(function (el) {
        el.hidden = el.getAttribute('data-only').split(' ').indexOf(s) < 0;
      });
    }
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-state-btn') === s ? 'true' : 'false'); });
    try { var q = new URLSearchParams(location.search); q.set('state', s); history.replaceState(null, '', '?' + q.toString()); } catch (e) { /* ignore */ }
  }

  buttons.forEach(function (b) { b.addEventListener('click', function () { setState(b.getAttribute('data-state-btn')); }); });

  /* Pause, play, Watch */
  document.addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    if (act && act.getAttribute('data-act') === 'pause') setState('paused');
    else if (act && act.getAttribute('data-act') === 'play' && state === 'paused') setState('live');
    var watch = e.target.closest('[data-watch]');
    if (watch) { e.preventDefault(); setState('live'); }
    var card = e.target.closest('.afighter');
    if (card) {
      card.parentNode.querySelectorAll('.afighter').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      card.setAttribute('aria-pressed', 'true');
    }
  });

  /* Reduced motion and focus-ring demo */
  var motion = document.getElementById('toggle-motion');
  motion.addEventListener('click', function () {
    var on = motion.getAttribute('aria-pressed') !== 'true';
    motion.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) root.setAttribute('data-motion', 'reduced'); else root.removeAttribute('data-motion');
  });
  var focusBtn = document.getElementById('toggle-focus');
  focusBtn.addEventListener('click', function () {
    var on = focusBtn.getAttribute('aria-pressed') !== 'true';
    focusBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    document.body.classList.toggle('demo-focus', on);
  });
  if (params.get('focus') === '1') { focusBtn.setAttribute('aria-pressed', 'true'); document.body.classList.add('demo-focus'); }
  if (params.get('motion') === 'reduced') { motion.setAttribute('aria-pressed', 'true'); root.setAttribute('data-motion', 'reduced'); }

  /* Color-vision simulation over the whole mock (mockups.js builds the SVG filters; it targets .main,
     which here is only the hidden Play match screen, so the filter is moved to the page wrapper). */
  var cvd = document.getElementById('cvd');
  function applyCvd() {
    document.querySelectorAll('.main').forEach(function (m) { m.style.filter = ''; });
    var f = cvd.value === 'none' ? '' : 'url(#cvd-' + cvd.value + ')';
    [screen, play].forEach(function (el) { el.style.filter = f; });
  }
  cvd.addEventListener('change', applyCvd);
  if (params.get('cvd')) { cvd.value = params.get('cvd'); }
  applyCvd();

  /* Keys (capture phase, so the shared shortcuts in mockups.js do not also fire) */
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (state === 'play') {
      if (e.shiftKey && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); e.stopPropagation(); window.alToast('Simulate', 'Mock: the match would be played without the arena.', 'info'); }
      return;
    }
    var k = e.key;
    if (k === ' ' || e.code === 'Space') {
      e.preventDefault(); e.stopPropagation();
      if (state === 'live') setState('paused'); else if (state === 'paused' || state === 'replay') setState(state === 'paused' ? 'live' : 'replay');
      return;
    }
    if (k === '1' || k === '2' || k === '4') {
      e.stopPropagation();
      screen.querySelectorAll('.ahud .segmented button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-speed') === k ? 'true' : 'false'); });
      return;
    }
    if (state === 'paused' && (k === 'i' || k === 'I')) {
      e.stopPropagation();
      var insp = screen.querySelector('.ainspect');
      insp.hidden = !insp.hidden;
      return;
    }
    if (k === 'Escape' && state === 'paused') {
      var panel = screen.querySelector('.ainspect');
      if (panel) panel.hidden = true;
    }
  }, true);

  setState(state);
})();
