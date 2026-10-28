/**
 * The bottom fighter strip (04 §4, 05-technical-m2 §A7): both sides, ten buttons. Each shows the portrait, name, role
 * glyph(s), an HP bar with its shield segment, the live rule badge, the Freshness tag and a down marker; clicking
 * selects the fighter (the inspector's subject). Side is the ring colour AND the ring style (solid for the player's
 * side, double for the other), so it never rests on colour alone (04 §9). HP is neutral parchment on a dark track:
 * no red or green meaning.
 */
import type { ReadonlySignal } from '@preact/signals';
import type { ArenaFrameState, ArenaRoundContext, ArenaUnitInfo, UnitRenderState } from '../../../render';
import { Portrait, RoleGlyph, tipAttrs } from '../../components';
import { t } from './text';

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

export function ArenaStrip({
  ctx,
  frame,
  selected,
  onSelect,
  roleName,
}: {
  ctx: ArenaRoundContext;
  frame: ReadonlySignal<ArenaFrameState | null>;
  selected: ReadonlySignal<number | null>;
  onSelect: (unit: number) => void;
  roleName: (role: string) => string;
}) {
  const f = frame.value;
  const sel = selected.value;
  const bySide = (side: 0 | 1) => ctx.units.filter((u) => u.side === side);
  const card = (u: ArenaUnitInfo) => {
    const st: UnitRenderState | undefined = f?.units.find((x) => x.unit === u.unit);
    const colors = ctx.sides[u.side].colors;
    const hp = st ? st.hp : 0;
    const max = st ? st.maxHp : 0;
    const hpFrac = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 1;
    const shieldFrac = st && st.shield !== null && max > 0 ? Math.max(0, Math.min(1 - hpFrac + 0.0001, st.shield / max)) : 0;
    const down = st ? !st.standing : false;
    const rule = st?.rule?.label ?? null;
    const fresh = u.fatigueTag && u.freshness !== null ? t(u.fatigueTag === 'tired' ? 'freshTired' : 'freshSpent', { n: u.freshness }) : null;
    const label = [
      u.name,
      u.className,
      st && max > 0 ? t('stripHp', { hp, max }) : null,
      st?.shield ? t('stripShield', { n: st.shield }) : null,
      rule ? t('stripRule', { label: rule }) : null,
      st?.isCaptain ? t('stripCaptain') : null,
      down ? t('stripDowned') : null,
      fresh,
    ]
      .filter(Boolean)
      .join(', ');
    return (
      <li key={u.unit}>
        <button
          class={`arena-fighter${sel === u.unit ? ' is-selected' : ''}${down ? ' is-down' : ''}`}
          type="button"
          data-testid={`strip-unit-${u.unit}`}
          data-side={u.side}
          data-ring={colors.ringStyle}
          data-down={down ? 'true' : undefined}
          style={{ '--side-c': hex(colors.ring) } as Record<string, string>}
          aria-pressed={sel === u.unit ? 'true' : 'false'}
          aria-label={`${t('stripSelect', { name: u.name })}: ${label}`}
          onClick={() => onSelect(u.unit)}
        >
          <Portrait role={u.roles[0] ?? 'melee'} race={u.raceId} size="xs" />
          <span class="arena-fighter__text">
            <span class="arena-fighter__name">
              {u.name}
              {st?.isCaptain && (
                <span class="arena-fighter__crown" aria-hidden="true" {...tipAttrs(t('stripCaptain'))}>
                  {' '}
                  ♛
                </span>
              )}
            </span>
            <span class="arena-fighter__roles">
              {u.roles.map((r) => (
                <RoleGlyph key={r} role={r} label={roleName(r)} />
              ))}
            </span>
          </span>
          <span class="arena-fighter__hp" role="img" aria-label={st && max > 0 ? t('stripHp', { hp, max }) : ''} style={{ '--hp': hpFrac, '--shield': shieldFrac } as Record<string, number>}>
            <i class="arena-fighter__hp-fill" />
            <i class="arena-fighter__hp-shield" />
          </span>
          <span class="arena-fighter__badges">
            {rule && (
              <span class="arena-fighter__rule u-num" data-testid={`strip-rule-${u.unit}`} {...tipAttrs(rule === 'S' ? t('stripStance') : rule === 'T' ? t('stripForced') : null)}>
                {rule}
              </span>
            )}
            {fresh && (
              <span class="tag tag--warn arena-fighter__fresh" data-testid={`strip-fresh-${u.unit}`}>
                {fresh}
              </span>
            )}
            {u.entered && <span class="arena-fighter__mark" {...tipAttrs(t('stripEntered'))}>◂</span>}
            {down && (
              <span class="arena-fighter__down" aria-hidden="true">
                ◆
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };
  return (
    <section class="arena-strip" data-testid="arena-strip" aria-label={t('stripLabel')}>
      <ul class="arena-strip__side arena-strip__side--home" role="list">
        {bySide(0).map(card)}
      </ul>
      <ul class="arena-strip__side arena-strip__side--away" role="list">
        {bySide(1).map(card)}
      </ul>
    </section>
  );
}
