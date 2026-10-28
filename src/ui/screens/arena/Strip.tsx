/**
 * The bottom fighter strip (04 §4, mockups/arena.html `.astrip`; 05-technical-m2 §A7, §A18): both sides, ten card
 * buttons, ours on the left, front row before back row. Each card shows the portrait, name and captain mark, the live rule
 * badge, an HP bar with its hatched shield and a percentage, the role glyph(s) and class, the Freshness tag and, when
 * down, "Downed · <cause>". FOCUS IS SELECTION (A18): Tab walks the ten cards in the normal order, so it never traps,
 * and a click focuses its card. Side is the card's left border (solid for ours, double for theirs) and the place.
 */
import type { ReadonlySignal } from '@preact/signals';
import type { ArenaFrameState, ArenaRoundContext, ArenaUnitInfo } from '../../../render';
import { RoleGlyph, tipAttrs } from '../../components';
import type { HudInfo } from './Hud';
import { t } from './text';

export function ArenaStrip({
  ctx,
  hud,
  frame,
  selected,
  downCause,
  onSelect,
  onToggle,
  onInspect,
  onSimulate,
  roleName,
}: {
  ctx: ArenaRoundContext;
  hud: HudInfo;
  frame: ReadonlySignal<ArenaFrameState | null>;
  selected: ReadonlySignal<number | null>;
  /** Who downed a unit, from the key moments shown so far (never from the log). */
  downCause: (unit: number) => string | null;
  /** Called when a card gets focus or is clicked: the card is the selection. */
  onSelect: (unit: number) => void;
  /** Space on a focused card plays or pauses (the shell's shortcut map leaves Space and Enter to a focused button). */
  onToggle: () => void;
  /** Enter on a focused card opens the inspector. */
  onInspect: () => void;
  /** Shift Space on a card: Simulate the rest (live only). */
  onSimulate?: () => void;
  roleName: (role: string) => string;
}) {
  const f = frame.value;
  const sel = selected.value;
  const card = (u: ArenaUnitInfo, ours: boolean) => {
    const st = f?.units.find((x) => x.unit === u.unit);
    const max = st?.maxHp ?? 0;
    const hp = st?.hp ?? 0;
    const hpFrac = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 1;
    const shieldFrac = st && st.shield !== null && max > 0 ? Math.max(0, Math.min(1 - hpFrac, st.shield / max)) : 0;
    const down = st ? !st.standing : false;
    const cause = down ? downCause(u.unit) : null;
    const rule = st?.rule?.label ?? null;
    const fresh = u.fatigueTag && u.freshness !== null ? t(u.fatigueTag === 'tired' ? 'freshTired' : 'freshSpent', { n: u.freshness }) : null;
    const label = [
      u.name,
      `${u.className} (${u.roles.map(roleName).join(' / ')})`,
      t(ours ? 'stripYours' : 'stripOpp'),
      down ? (cause ? `${t('stripDowned')} · ${cause}` : t('stripDowned')) : max > 0 ? `${Math.round(hpFrac * 100)}% HP` : null,
      rule && !down ? t('stripRule', { label: rule }) : null,
      st?.isCaptain ? t('stripCaptain') : null,
      fresh,
    ]
      .filter(Boolean)
      .join(', ');
    return (
      <button
        key={u.unit}
        class={`afighter${down ? ' is-down' : ''}`}
        type="button"
        data-testid={`strip-unit-${u.unit}`}
        data-side={ours ? 'us' : 'them'}
        data-fighter={u.fighterId}
        data-down={down ? 'true' : undefined}
        aria-pressed={sel === u.unit ? 'true' : 'false'}
        aria-label={label}
        onFocus={() => onSelect(u.unit)}
        onClick={() => onSelect(u.unit)}
        onKeyDown={(e) => {
          // Buttons keep Space and Enter for themselves, so the arena's keys are handled here on a focused card.
          if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            e.stopPropagation();
            if (e.shiftKey && onSimulate) onSimulate();
            else onToggle();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onInspect();
          }
        }}
      >
        <span class="portrait portrait--sm" data-role={u.roles[0] ?? 'melee'} data-race={u.raceId} aria-hidden="true" />
        <span class="afighter__body">
          <span class="afighter__line">
            <span class="afighter__name">{u.name}</span>
            {st?.isCaptain && (
              <span class="captain-mark" {...tipAttrs(t('stripCaptain'))}>
                <span class="u-sr-only">{t('stripCaptain')}</span>
              </span>
            )}
          </span>
          {down ? (
            <span class="afighter__line">
              <span class="afighter__downmark" data-testid={`strip-down-${u.unit}`}>
                {cause ? `${t('stripDowned')} · ${cause}` : t('stripDowned')}
              </span>
            </span>
          ) : (
            <span class="afighter__line">
              {rule && (
                <span class="rule__id" data-testid={`strip-rule-${u.unit}`} {...tipAttrs(rule === 'S' ? t('stripStance') : rule === 'T' ? t('stripForced') : t('stripRuleTip'))}>
                  {rule}
                </span>
              )}
              <span class="afighter__hp" style={{ '--hp': hpFrac, '--sh': shieldFrac } as Record<string, number>}>
                <i class="abar__hp" style={{ '--hp': hpFrac } as Record<string, number>} />
                {shieldFrac > 0 && <i class="abar__shield" style={{ '--sh': shieldFrac } as Record<string, number>} />}
              </span>
              <span class="afighter__pct">{max > 0 ? `${Math.round(hpFrac * 100)}%` : ''}</span>
            </span>
          )}
          <span class="afighter__line">
            {u.roles.map((r) => (
              <RoleGlyph key={r} role={r} label={roleName(r)} />
            ))}
            <span class="afighter__class">{u.className}</span>
            {fresh && (
              <span class="tag tag--warn" data-testid={`strip-fresh-${u.unit}`} {...tipAttrs(t('stripFreshTip', { tag: fresh }))}>
                {fresh.replace(/[()]/g, '')}
              </span>
            )}
            {u.entered && <span class="u-xs u-faint" {...tipAttrs(t('stripEntered'))}>{t('stripSub')}</span>}
          </span>
        </span>
      </button>
    );
  };
  const group = (side: 0 | 1, ours: boolean, club: string) => {
    const units = ctx.units
      .filter((u) => u.side === side)
      .sort((a, b) => (hud.rows[a.unit] === hud.rows[b.unit] ? a.unit - b.unit : hud.rows[a.unit] === 'front' ? -1 : 1));
    return (
      <div class="astrip__side" role="group" aria-label={t(ours ? 'hudSide' : 'hudSideThem', { club })}>
        {units.map((u) => card(u, ours))}
      </div>
    );
  };
  return (
    <footer class="astrip" aria-label={t('stripLabel')} data-testid="arena-strip">
      {group(hud.left.side, hud.left.ours || hud.left.side === (ctx.playerSide ?? 0), hud.left.name)}
      {group(hud.right.side, false, hud.right.name)}
    </footer>
  );
}
