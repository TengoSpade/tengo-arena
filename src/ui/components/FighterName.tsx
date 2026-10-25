/**
 * A fighter in a table or list: portrait (race bust, role tint), name
 * (link to the profile), captain crown or VC tag, rookie tag. Names
 * truncate with an ellipsis; the full name is in the tooltip.
 */
import type { ComponentChildren } from 'preact';
import { t } from '../text';
import { CaptainMark, Portrait, ViceCaptainTag } from './marks';
import { Tag } from './Tag';
import { overflowTipAttrs, tipAttrs, type Tip } from './Tooltip';

export interface FighterNameProps {
  name: string;
  /** Profile link (e.g. "#/fighter/f-12"); omit for plain text. */
  href?: string;
  role?: string;
  race?: string;
  portrait?: 'xs' | 'sm' | false;
  injured?: boolean;
  captain?: 'captain' | 'vice' | null;
  captainTip?: Tip;
  rookie?: boolean;
  /** Small second line (class, race and age). */
  sub?: ComponentChildren;
  tip?: Tip;
  /** Extra tags after the name. */
  after?: ComponentChildren;
}

export function FighterName(props: FighterNameProps) {
  const nameEl = props.href ? (
    <a class="entity__name" href={props.href} {...(props.tip ? tipAttrs(props.tip) : overflowTipAttrs(props.name))}>
      {props.name}
    </a>
  ) : (
    <span class="entity__name" {...(props.tip ? tipAttrs(props.tip) : overflowTipAttrs(props.name))}>
      {props.name}
    </span>
  );
  return (
    <span class="entity">
      {props.portrait !== false && <Portrait size={props.portrait ?? 'xs'} role={props.role} race={props.race} injured={props.injured} />}
      {props.sub !== undefined ? (
        <span class="entity__stack">
          {nameEl}
          <span class="entity__sub">{props.sub}</span>
        </span>
      ) : (
        nameEl
      )}
      {props.captain === 'captain' && <CaptainMark tip={props.captainTip} />}
      {props.captain === 'vice' && <ViceCaptainTag tip={props.captainTip} />}
      {props.rookie && (
        <Tag kind="info" tip={t('fighter.rookieTip')}>
          {t('fighter.rookie')}
        </Tag>
      )}
      {props.after}
    </span>
  );
}
