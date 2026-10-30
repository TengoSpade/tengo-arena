/**
 * ui-settings · Settings (04 §6.3, not mocked): pacing presets (D-L) and
 * autosave, interface (theme, scale, density, tooltip delay), accessibility
 * (reduce motion, status colours), audio (placeholder: no sounds in M1) and
 * the shortcut list. Settings live outside careers (05 §5) in WP6's settings
 * store; every change applies at once with Undo (D-M), no dialog.
 */
import type { ScreenProps } from '../../app/routes';
import { Kbd, PageHeader, Panel, showToast } from '../../components';
import { AUTOSAVE_SLOTS, DEFAULT_SETTINGS, pacingStops, settings, updateSettings, type PacingPreset, type PacingStops, type UiSettings } from '../../store';
import { Segmented } from '../league/lib/ui';
import { MatchDayPanel, applyPresetToClub, useOptionalMatchDay } from './MatchDayPanel';
import { TicketsPanel } from './TicketsPanel';
import { t } from './text';
import './settings.css';

const PRESETS: PacingPreset[] = ['thorough', 'balanced', 'streamlined', 'custom'];
const STOPS: (keyof PacingStops)[] = ['lineup', 'reportAlways', 'reportOnLoss', 'reportOnInjury'];
const SCALE = { min: 0.85, max: 1.5, step: 0.05 };

/** Apply a reversible change at once, with Undo (D-M). */
function change(patch: Partial<UiSettings>, what: string): void {
  const before = settings.value;
  updateSettings(patch);
  showToast({ kind: 'accent', title: t('changed', { what }), undo: () => updateSettings(before) });
}

export default function SettingsScreen(_props: ScreenProps) {
  const s = settings.value;
  const stops = pacingStops(s);
  const { md } = useOptionalMatchDay();
  return (
    <section class="page" data-testid="screen-settings">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        meta={[t('meta')]}
        actions={
          <button
            class="btn"
            type="button"
            data-testid="settings-reset"
            onClick={() => {
              const before = settings.value;
              updateSettings({ ...DEFAULT_SETTINGS, pacingCustom: { ...DEFAULT_SETTINGS.pacingCustom } });
              showToast({ kind: 'accent', title: t('resetDone'), undo: () => updateSettings(before) });
            }}
          >
            {t('reset')}
          </button>
        }
      />
      <div class="l-grid settings-grid">
        <Panel title={t('gameplay.title')} icon="play" subtitle={t('gameplay.subtitle')} class="span-7" testId="settings-gameplay">
          <div class="l-stack">
            <fieldset class="option-group">
              <legend class="field__label">{t('pacing.label')}</legend>
              {PRESETS.map((p) => (
                <label key={p} class="option-card" data-testid={`preset-${p}`}>
                  <input type="radio" name="pacing" value={p} checked={s.pacing === p} onChange={() => {
                      change({ pacing: p }, `${t('pacing.label')}: ${t(`pacing.${p}`)}`);
                      applyPresetToClub(md, p);
                    }} />
                  <span class="option-card__body">
                    <span class="option-card__name">
                      {t(`pacing.${p}`)}
                      {p === DEFAULT_SETTINGS.pacing && <span class="tag">{t('pacing.default')}</span>}
                    </span>
                    <span class="option-card__text">{t(`pacing.${p}Text`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div class="settings-stops" aria-live="polite">
              {STOPS.map((k) => (
                <label key={k} class="check">
                  <input
                    type="checkbox"
                    checked={stops[k]}
                    disabled={s.pacing !== 'custom'}
                    onChange={(e) => change({ pacing: 'custom', pacingCustom: { ...stops, [k]: (e.target as HTMLInputElement).checked } }, t(`stop.${k}`))}
                    data-testid={`stop-${k}`}
                  />
                  {t(`stop.${k}`)}
                </label>
              ))}
            </div>
            <p class="u-xs u-faint">{t('pacing.note')}</p>
            <label class="l-row settings-switch">
              <input class="switch" type="checkbox" role="switch" checked={s.autosave} onChange={(e) => change({ autosave: (e.target as HTMLInputElement).checked }, t('autosave.label'))} data-testid="autosave" />
              <span class="l-stack l-stack--xs">
                <span class="u-strong">{t('autosave.label')}</span>
                <span class="u-xs u-muted">{t('autosave.text', { n: AUTOSAVE_SLOTS.length })}</span>
              </span>
            </label>
          </div>
        </Panel>

        <div class="span-5 l-stack">
          <Panel title={t('interface.title')} icon="settings" testId="settings-interface">
            <div class="l-stack">
              <div class="field">
                <span class="field__label">{t('theme.label')}</span>
                <Segmented
                  label={t('theme.label')}
                  value={s.theme}
                  onChange={(v) => change({ theme: v }, t('theme.label'))}
                  options={[
                    { value: 'dark', label: t('theme.dark') },
                    { value: 'light', label: t('theme.light') },
                    { value: 'system', label: t('theme.system') },
                  ]}
                />
              </div>
              <div class="field">
                <label class="field__label settings-range-label" for="settings-scale">
                  <span>{t('scale.label')}</span>
                  <strong class="u-num">{Math.round(s.scale * 100)}%</strong>
                </label>
                <input
                  id="settings-scale"
                  class="range"
                  type="range"
                  min={SCALE.min}
                  max={SCALE.max}
                  step={SCALE.step}
                  value={s.scale}
                  onChange={(e) => change({ scale: Number((e.target as HTMLInputElement).value) }, t('scale.label'))}
                />
                <span class="field__hint">{t('scale.hint', { min: `${SCALE.min * 100}%`, max: `${SCALE.max * 100}%` })}</span>
              </div>
              <div class="field">
                <span class="field__label">{t('density.label')}</span>
                <Segmented
                  label={t('density.label')}
                  value={s.density}
                  onChange={(v) => change({ density: v }, t('density.label'))}
                  options={[
                    { value: 'comfortable', label: t('density.comfortable') },
                    { value: 'compact', label: t('density.compact') },
                  ]}
                />
              </div>
              <div class="field">
                <label class="field__label settings-range-label" for="settings-tooltip">
                  <span>{t('tooltip.label')}</span>
                  <strong class="u-num">{t('tooltip.value', { ms: s.tooltipDelayMs })}</strong>
                </label>
                <input
                  id="settings-tooltip"
                  class="range"
                  type="range"
                  min={0}
                  max={1000}
                  step={20}
                  value={s.tooltipDelayMs}
                  onChange={(e) => change({ tooltipDelayMs: Number((e.target as HTMLInputElement).value) }, t('tooltip.label'))}
                />
                <span class="field__hint">{t('tooltip.hint')}</span>
              </div>
            </div>
          </Panel>

          <Panel title={t('a11y.title')} icon="eye" testId="settings-a11y">
            <div class="l-stack">
              <div class="field">
                <span class="field__label">{t('motion.label')}</span>
                <Segmented
                  label={t('motion.label')}
                  value={s.reducedMotion}
                  onChange={(v) => change({ reducedMotion: v }, t('motion.label'))}
                  options={[
                    { value: 'system', label: t('motion.system') },
                    { value: 'on', label: t('motion.on') },
                    { value: 'off', label: t('motion.off') },
                  ]}
                />
              </div>
              <div class="field">
                <span class="field__label">{t('palette.label')}</span>
                <Segmented
                  label={t('palette.label')}
                  value={s.statusPalette}
                  onChange={(v) => change({ statusPalette: v }, t('palette.label'))}
                  options={[
                    { value: 'green-red', label: t('palette.green-red') },
                    { value: 'blue-orange', label: t('palette.blue-orange') },
                  ]}
                />
                <span class="field__hint">{t('palette.hint')}</span>
                <span class="l-cluster settings-palette-sample" aria-hidden="true">
                  <span class="tag tag--good">▲ +3</span>
                  <span class="tag tag--bad">▼ −2</span>
                  <span class="form">
                    <i class="form__r" data-r="W">
                      W
                    </i>
                    <i class="form__r" data-r="L">
                      L
                    </i>
                  </span>
                </span>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title={t('audio.title')} icon="bell" subtitle={t('audio.subtitle')} class="span-5" testId="settings-audio">
          <div class="l-stack settings-audio">
            {(['master', 'music', 'effects', 'interface'] as const).map((k) => (
              <label class="settings-range-label" key={k}>
                <span>{t(`audio.${k}`)}</span>
                <input class="range" type="range" min={0} max={100} value={80} disabled aria-disabled="true" />
              </label>
            ))}
            <label class="l-row u-sm">
              <input class="switch" type="checkbox" role="switch" disabled />
              <span>{t('audio.mute')}</span>
            </label>
          </div>
        </Panel>

        <Panel title={t('controls.title')} icon="keyboard" subtitle={t('controls.subtitle')} class="span-7" testId="settings-controls">
          <dl class="shortcut-list">
            <div>
              <dt>{t('controls.continue')}</dt>
              <dd>
                <Kbd>Space</Kbd>
              </dd>
            </div>
            <div>
              <dt>{t('controls.screens')}</dt>
              <dd>
                <Kbd>1</Kbd>–<Kbd>7</Kbd>
              </dd>
            </div>
            <div>
              <dt>{t('controls.save')}</dt>
              <dd>
                <Kbd>Ctrl</Kbd>
                <Kbd>S</Kbd>
              </dd>
            </div>
            <div>
              <dt>{t('controls.undo')}</dt>
              <dd>
                <Kbd>Ctrl</Kbd>
                <Kbd>Z</Kbd>
              </dd>
            </div>
            <div>
              <dt>{t('controls.back')}</dt>
              <dd>
                <Kbd>Esc</Kbd>
              </dd>
            </div>
            <div>
              <dt>{t('controls.search')}</dt>
              <dd>
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </dd>
            </div>
            <div>
              <dt>{t('controls.pin')}</dt>
              <dd>
                <Kbd>Shift</Kbd>
              </dd>
            </div>
            <div>
              <dt>{t('controls.table')}</dt>
              <dd>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <Kbd>Enter</Kbd>
              </dd>
            </div>
            <div>
              <dt>{t('controls.help')}</dt>
              <dd>
                <Kbd>?</Kbd>
              </dd>
            </div>
          </dl>
        </Panel>

        <MatchDayPanel />
        <TicketsPanel />
      </div>
    </section>
  );
}
