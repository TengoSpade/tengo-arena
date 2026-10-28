/**
 * ui-new, flow-state-001 · Title screen (04 §6.3): Continue (latest save;
 * disabled with "No saves yet"), New career, Load, Settings, Quit.
 * Keys: Enter = Continue, N = New career.
 * New career generates the world (createWorld with a fresh seed, or a typed
 * seed under Advanced, P-05) and opens the club select (flow-state-002).
 */
import { useEffect, useState } from 'preact/hooks';
import type { SaveMeta } from '../../../core/model';
import type { ScreenProps } from '../../app/routes';
import { navigate } from '../../app/router';
import { installShortcuts } from '../../app/shortcuts';
import { Icon, showToast, tipAttrs } from '../../components';
import { formatDateTime, formatPlaytime } from '../../format';
import { useStore } from '../../store';
import { watchingMatch } from '../../store/arena';
import { t } from '../../text';

const T = {
  tagline: 'Fantasy arena league manager',
  continue: 'Continue',
  continueNone: 'No saves yet',
  continueTip: 'Load the latest save: {label}',
  newCareer: 'New career',
  newCareerTip: 'Generate a new world, then pick your club.',
  load: 'Load',
  settings: 'Settings',
  quit: 'Quit',
  quitTip: 'Close the window or tab to quit. Progress is in your saves.',
  advanced: 'Advanced',
  seed: 'World seed',
  seedHint: 'Leave empty for a random world. The same seed always gives the same world.',
  seedPlaceholder: 'random',
  generating: 'Generating the world',
  latest: 'Latest save',
  saved: '{when} · {time} played',
  loaded: 'Loaded {label}',
  failed: 'World generation failed',
  failedText: 'Nothing was created. Try again, or note the seed for a bug report: {seed}',
  tryAgain: 'Try again',
} as const;

export default function NewGameScreen(_props: ScreenProps) {
  const store = useStore();
  const [latest, setLatest] = useState<SaveMeta | null | undefined>(undefined);
  const [advanced, setAdvanced] = useState(false);
  const [seed, setSeed] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const busy = store.busy.value;

  useEffect(() => {
    let alive = true;
    void store.listSaves().then((metas) => {
      if (alive) setLatest(metas[0] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  const startNew = async () => {
    if (busy) return;
    setFailed(null);
    const res = await store.newGame(seed.trim() ? { seed: seed.trim() } : undefined);
    if (res.ok) navigate('#/club-select');
    else setFailed(res.error.code);
  };

  const continueLatest = async () => {
    if (!latest || busy) return;
    const res = await store.load(latest.slotId);
    if (res.ok) {
      showToast({ title: t('save.loaded', { label: latest.label }), kind: 'good' });
      // A save with a round waiting to be watched resumes in the arena (A3, A7); anything else on Home.
      navigate(watchingMatch(store.game.value) ? '#/arena' : '#/home');
    }
  };

  useEffect(
    () =>
      installShortcuts(() => ({
        Enter: () => (latest ? void continueLatest() : false),
        n: () => void startNew(),
      })),
    [latest, seed, busy],
  );

  return (
    <main class="title-screen" data-testid="screen-new-game">
      <section class="panel panel--hero title-screen__panel" aria-labelledby="title-heading">
        <div class="title-screen__head">
          <h1 class="title-screen__title u-display" id="title-heading">
            {t('app.title')}
          </h1>
          <p class="u-muted">{T.tagline}</p>
        </div>
        <div class="title-screen__menu l-stack l-stack--sm">
          <button
            class="btn btn--primary btn--lg btn--block"
            type="button"
            data-testid="title-continue"
            aria-disabled={latest ? undefined : 'true'}
            onClick={() => void continueLatest()}
            {...tipAttrs(latest ? T.continueTip.replace('{label}', latest.label) : T.continueNone)}
          >
            <Icon name="play" />
            {latest === null ? T.continueNone : T.continue}
            {latest && <kbd>Enter</kbd>}
          </button>
          {latest && (
            <p class="u-xs u-faint title-screen__latest">
              {T.latest}: {latest.label} · {T.saved.replace('{when}', formatDateTime(latest.savedAt)).replace('{time}', formatPlaytime(latest.playtimeSec))}
            </p>
          )}
          <button class="btn btn--lg btn--block" type="button" data-testid="title-new" onClick={() => void startNew()} disabled={busy} {...tipAttrs(T.newCareerTip)}>
            <Icon name="plus" />
            {busy ? T.generating : T.newCareer} <kbd>N</kbd>
          </button>
          <div class="title-screen__row">
            <a class="btn btn--block" href="#/saves">
              <Icon name="load" />
              {T.load}
            </a>
            <a class="btn btn--block" href="#/settings">
              <Icon name="settings" />
              {T.settings}
            </a>
            <button class="btn btn--ghost btn--block" type="button" aria-disabled="true" {...tipAttrs(T.quitTip)}>
              {T.quit}
            </button>
          </div>
          <button class="btn btn--sm btn--ghost title-screen__advanced" type="button" aria-expanded={advanced ? 'true' : 'false'} onClick={() => setAdvanced((a) => !a)}>
            <Icon name={advanced ? 'chevron-up' : 'chevron-down'} />
            {T.advanced}
          </button>
          {advanced && (
            <label class="field">
              <span class="field__label">{T.seed}</span>
              <input class="input" type="text" value={seed} placeholder={T.seedPlaceholder} onInput={(e) => setSeed((e.target as HTMLInputElement).value)} />
              <span class="field__hint">{T.seedHint}</span>
            </label>
          )}
          {failed && (
            <div class="callout callout--bad" role="alert">
              <Icon name="warning" />
              <div>
                <div class="callout__title">{T.failed}</div>
                <div class="callout__text">{T.failedText.replace('{seed}', seed || store.game.value?.rng.root || '—')}</div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
