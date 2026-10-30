/**
 * Settings › Match day › Watching (05-technical-m2 §A7, owner answers Q54 and Q58): whether Play match offers Watch or
 * Simulate or just does one, the remembered speed, the auto-pause triggers, the names over fighters and "pause when
 * the window is hidden". Per-device settings: they live in the UI settings record, never in a save, so they follow
 * the player across careers. Every change applies at once with Undo (D-M).
 */
import type { ArenaSettings, WatchPreference } from '../../store';
import type { Speed } from '../../../render';
import { Panel, showToast } from '../../components';
import { settings, updateArenaSettings, updateSettings } from '../../store';
import { Segmented } from '../league/lib/ui';
import { t } from './text';

type Patch = Parameters<typeof updateArenaSettings>[0];

function change(patch: Patch, what: string): void {
  const before = settings.value;
  updateArenaSettings(patch);
  showToast({ kind: 'accent', title: t('changed', { what }), undo: () => updateSettings(before) });
}

const AUTO_PAUSE: { key: 'ownDowned' | 'enemyDowned' | 'ownCaptainDown' | 'overtime'; label: Parameters<typeof t>[0] }[] = [
  { key: 'ownDowned', label: 'arena.ap.ownDowned' },
  { key: 'ownCaptainDown', label: 'arena.ap.ownCaptainDown' },
  { key: 'overtime', label: 'arena.ap.overtime' },
  { key: 'enemyDowned', label: 'arena.ap.enemyDowned' },
];

export function ArenaPanel() {
  const a: ArenaSettings = settings.value.arena;
  const lowHp = a.autoPause.ownHpBelowPct;
  return (
    <Panel title={t('arena.title')} icon="play" subtitle={t('arena.subtitle')} class="span-12" testId="settings-arena">
      <div class="matchday">
        <section class="l-stack l-stack--sm">
          <h3 class="panel-section__title">{t('arena.play')}</h3>
          <div class="field">
            <span class="field__label">{t('arena.preference')}</span>
            <Segmented<WatchPreference>
              label={t('arena.preference')}
              value={a.watchPreference}
              onChange={(v) => change({ watchPreference: v }, t('arena.preference'))}
              options={[
                { value: 'ask', label: t('arena.pref.ask'), tip: t('arena.pref.askTip') },
                { value: 'watch', label: t('arena.pref.watch'), tip: t('arena.pref.watchTip') },
                { value: 'simulate', label: t('arena.pref.simulate'), tip: t('arena.pref.simulateTip') },
              ]}
            />
            <span class="field__hint">{t('arena.preferenceHint')}</span>
          </div>
          <div class="field">
            <span class="field__label">{t('arena.speed')}</span>
            <Segmented<'1' | '2' | '4'>
              label={t('arena.speed')}
              value={String(a.speed) as '1' | '2' | '4'}
              onChange={(v) => change({ speed: Number(v) as Speed }, t('arena.speed'))}
              options={[
                { value: '1', label: '1x' },
                { value: '2', label: '2x' },
                { value: '4', label: '4x' },
              ]}
            />
          </div>
          <div class="field">
            <span class="field__label">{t('arena.labels')}</span>
            <Segmented<ArenaSettings['labels']>
              label={t('arena.labels')}
              value={a.labels}
              onChange={(v) => change({ labels: v }, t('arena.labels'))}
              options={[
                { value: 'off', label: t('arena.labels.off') },
                { value: 'selected', label: t('arena.labels.selected') },
                { value: 'all', label: t('arena.labels.all') },
              ]}
            />
          </div>
          <label class="l-row settings-switch">
            <input class="switch" type="checkbox" role="switch" checked={a.pauseWhenHidden} onChange={(e) => change({ pauseWhenHidden: (e.target as HTMLInputElement).checked }, t('arena.hidden'))} data-testid="arena-pause-hidden" />
            <span class="l-stack l-stack--xs">
              <span class="u-strong">{t('arena.hidden')}</span>
              <span class="u-xs u-muted">{t('arena.hiddenText')}</span>
            </span>
          </label>
        </section>
        <section class="l-stack l-stack--sm">
          <h3 class="panel-section__title">{t('arena.autoPause')}</h3>
          <p class="u-xs u-muted">{t('arena.autoPauseText')}</p>
          {AUTO_PAUSE.map((r) => (
            <label key={r.key} class="check">
              <input type="checkbox" checked={a.autoPause[r.key]} onChange={(e) => change({ autoPause: { [r.key]: (e.target as HTMLInputElement).checked } }, t(r.label))} data-testid={`autopause-${r.key}`} />
              {t(r.label)}
            </label>
          ))}
          <label class="check">
            <input
              type="checkbox"
              checked={lowHp !== null}
              onChange={(e) => change({ autoPause: { ownHpBelowPct: (e.target as HTMLInputElement).checked ? 25 : null } }, t('arena.ap.ownHp'))}
              data-testid="autopause-ownHpBelowPct"
            />
            {t('arena.ap.ownHp', { n: lowHp ?? 25 })}
          </label>
          <p class="u-xs u-faint">{t('arena.defaults', { on: AUTO_PAUSE.slice(0, 3).map((r) => t(r.label)).join(', ') })}</p>
        </section>
      </div>
    </Panel>
  );
}

