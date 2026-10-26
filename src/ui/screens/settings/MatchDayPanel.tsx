/**
 * Settings › Match day (M1.1 WP-D): the club's level-up default and pacing, the between-round pause,
 * and the auto-swap rules (combat-skills.md sys-match "Auto-swap"; progression.md "auto-pick and
 * pacing"). These are career settings stored with the club (commands levelup.policy, pacing.set,
 * autoswap.set), so they apply to the loaded career only. The pacing presets above set the level-up
 * pacing and the pause too (pacingForPreset).
 */
import type { AutoSwapMode, AutoSwapRules, LevelUpMode, LevelUpPacing, PauseBetweenRounds } from '../../../core/model';
import { useContext, useMemo } from 'preact/hooks';
import { Panel, Segmented, showToast, tipAttrs } from '../../components';
import { StoreContext, type GameStore, type PacingPreset } from '../../store';
import { useEngine } from '../../store/engine';
import { matchDayFacade, type MatchDayFacade } from '../../store/match-day';

/** The facade when a store is provided (Settings also renders without one, e.g. in tests). */
export function useOptionalMatchDay(): { store: GameStore | null; md: MatchDayFacade | null } {
  const store = useContext(StoreContext);
  const engine = useEngine();
  const md = useMemo(() => (store ? matchDayFacade(store, engine, () => store.content.value) : null), [store, engine]);
  return { store, md };
}

/** What a pacing preset means for match day (thorough stops for everything, streamlined for nothing). */
export function pacingForPreset(p: PacingPreset): { levelUpPacing: LevelUpPacing; pause: PauseBetweenRounds } | null {
  if (p === 'thorough') return { levelUpPacing: 'detailed', pause: 'always' };
  if (p === 'balanced') return { levelUpPacing: 'balanced', pause: 'when_urgent' };
  if (p === 'streamlined') return { levelUpPacing: 'fast', pause: 'never' };
  return null;
}

export function applyPresetToClub(md: MatchDayFacade | null, p: PacingPreset): void {
  const m = pacingForPreset(p);
  if (m && md) md.setPacing(m.levelUpPacing, m.pause);
}

const LEVELUP_DEFAULTS: { id: LevelUpMode; label: string }[] = [
  { id: 'manual', label: 'Ask me' },
  { id: 'auto', label: 'Auto (balanced)' },
  { id: 'auto_stats', label: 'Auto (favour stats)' },
  { id: 'auto_skills', label: 'Auto (favour skills)' },
];

function ok(r: { ok: boolean; error?: { message: string } }, what: string) {
  if (r.ok) showToast({ kind: 'accent', title: `Changed: ${what}` });
  else showToast({ kind: 'bad', title: r.error?.message ?? 'Not changed' });
}

export function MatchDayPanel() {
  const { store, md } = useOptionalMatchDay();
  const state = store?.game.value ?? null;
  const club = state?.playerClubId ? state.clubs[state.playerClubId] : undefined;
  if (!club || !md) {
    return (
      <Panel title="Match day" icon="swords" subtitle="Level-ups, between rounds and auto-swap" class="span-12" testId="settings-matchday">
        <p class="u-sm u-muted">These are career settings: load or start a career to change them.</p>
      </Panel>
    );
  }
  const rules = club.autoSwap;
  const setRules = (patch: Partial<AutoSwapRules>, what: string) => ok(md.setAutoSwap({ ...rules, ...patch }), what);
  const num = (key: 'freshnessBelow' | 'lostRoundBonus' | 'reserveMargin' | 'maxRatingGap', label: string, min: number, max: number, tip: string) => (
    <label class="field matchday-num" {...tipAttrs(tip)}>
      <span class="field__label">
        {label} <strong class="u-num">{rules[key]}</strong>
      </span>
      <input
        class="range"
        type="range"
        min={min}
        max={max}
        step={key === 'freshnessBelow' ? 5 : 1}
        value={rules[key]}
        disabled={rules.mode !== 'threshold'}
        onChange={(e) => setRules({ [key]: Number((e.target as HTMLInputElement).value) } as Partial<AutoSwapRules>, label)}
        data-testid={`autoswap-${key}`}
      />
    </label>
  );
  return (
    <Panel title="Match day" icon="swords" subtitle="Career settings, saved with your club" class="span-12" testId="settings-matchday">
      <div class="matchday">
        <section class="l-stack l-stack--sm">
          <h3 class="panel-section__title">Level-ups</h3>
          <label class="field" {...tipAttrs('How fighters on "Club default" resolve level-ups. A fighter can override it on his profile.')}>
            <span class="field__label">Club default</span>
            <select class="select" value={club.levelUpDefault} onChange={(e) => ok(md.setLevelUpPolicy(null, (e.target as HTMLSelectElement).value as LevelUpMode), 'level-up default')} data-testid="levelup-default">
              {LEVELUP_DEFAULTS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <div class="field" {...tipAttrs('Detailed: the dialog opens after the match report for every "Ask me" fighter who levelled. Balanced: only for those who played; the rest keep a badge. Fast: badges only, and a full queue resolves itself.')}>
            <span class="field__label">When level-ups interrupt</span>
            <Segmented<LevelUpPacing>
              label="Level-up pacing"
              value={club.levelUpPacing}
              onChange={(v) => ok(md.setPacing(v, club.pauseBetweenRounds), 'level-up pacing')}
              options={[
                { id: 'detailed', label: 'Detailed' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'fast', label: 'Fast' },
              ]}
            />
          </div>
        </section>
        <section class="l-stack l-stack--sm">
          <h3 class="panel-section__title">Between rounds</h3>
          <div class="field" {...tipAttrs('Always: your match pauses after every round that does not decide it. When urgent: only for an injury with a choice of reserves, a fighter below your auto-swap threshold, or the captain out. Never: the auto-swap rules decide.')}>
            <span class="field__label">Pause my match</span>
            <Segmented<PauseBetweenRounds>
              label="Pause between rounds"
              value={club.pauseBetweenRounds}
              onChange={(v) => ok(md.setPacing(club.levelUpPacing, v), 'pause between rounds')}
              options={[
                { id: 'always', label: 'Always' },
                { id: 'when_urgent', label: 'When urgent' },
                { id: 'never', label: 'Never' },
              ]}
            />
          </div>
          <p class="u-xs u-muted">The pacing presets above set this and the level-up pacing too: Thorough = Detailed + Always, Balanced = Balanced + When urgent, Streamlined = Fast + Never.</p>
        </section>
        <section class="l-stack l-stack--sm">
          <h3 class="panel-section__title">Auto-swap</h3>
          <div class="field" {...tipAttrs('The same rules suggest swaps on the between-round screen and decide them when the match does not pause. AI clubs play by the same rulebook.')}>
            <span class="field__label">Rule</span>
            <Segmented<AutoSwapMode>
              label="Auto-swap mode"
              value={rules.mode}
              onChange={(v) => setRules({ mode: v }, 'auto-swap')}
              options={[
                { id: 'threshold', label: 'Freshness threshold' },
                { id: 'injured_only', label: 'Injuries only' },
                { id: 'off', label: 'Off' },
              ]}
            />
          </div>
          {num('freshnessBelow', 'Swap below Freshness', 0, 80, 'An active fighter below this Freshness is swapped (lowest first) when a suitable reserve is available.')}
          {num('lostRoundBonus', 'Plus after a lost round', 0, 30, 'Added to the threshold after a round your side lost.')}
          {num('reserveMargin', 'Reserve at least this much fresher', 0, 40, 'The reserve needs the starter’s Freshness plus this.')}
          {num('maxRatingGap', 'Reserve within rating', 0, 20, 'The reserve may be at most this many rating points below the starter.')}
          <label class="l-row settings-switch">
            <input
              class="switch"
              type="checkbox"
              role="switch"
              checked={rules.keepOneForInjury}
              onChange={(e) => setRules({ keepOneForInjury: (e.target as HTMLInputElement).checked }, 'keep one swap for injuries')}
              data-testid="autoswap-keep"
            />
            <span class="l-stack l-stack--xs">
              <span class="u-strong">Keep one swap for injuries</span>
              <span class="u-xs u-muted">The last swap is not spent on Freshness before the last possible between-round step.</span>
            </span>
          </label>
        </section>
      </div>
    </Panel>
  );
}
