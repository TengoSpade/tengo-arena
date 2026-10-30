/**
 * Class tag: role glyph(s) + class name (04 asset-003; hybrids show both
 * glyphs side by side). Role names come from content (combat.json
 * archetypes), never from code.
 */
import { t } from '../text';
import { RoleGlyph } from './marks';
import { tipAttrs, type Tip } from './Tooltip';

export interface ClassTagProps {
  name: string;
  /** Archetype ids, one (base class) or two (hybrid). */
  roles: readonly string[];
  /** Role display names in the same order (for the hybrid tooltip and screen readers). */
  roleNames?: readonly string[];
  tip?: Tip;
  /** A starter class (beginner pick): a small star after the name. */
  starter?: boolean;
}

export function ClassTag({ name, roles, roleNames, tip, starter }: ClassTagProps) {
  const names = roleNames ?? roles;
  const hybrid = roles.length > 1;
  const autoTip = hybrid ? t('class.hybridTip', { roles: names.join(t('common.and')) }) : undefined;
  return (
    <span class="class-tag" {...tipAttrs(tip ?? autoTip)}>
      {hybrid ? (
        <span>
          {roles.map((r) => (
            <RoleGlyph key={r} role={r} />
          ))}
        </span>
      ) : (
        roles[0] && <RoleGlyph role={roles[0]} />
      )}
      <span class="u-sr-only">{names.join(', ')}: </span>
      {name}
      {starter && (
        <span class="class-tag__star" {...tipAttrs(t('class.starterTip'))}>
          <span aria-hidden="true">★</span>
          <span class="u-sr-only"> {t('class.starter')}</span>
        </span>
      )}
    </span>
  );
}
