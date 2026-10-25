/** Status tag (`.tag`): colour is always paired with a word (04 §9). */
import type { ComponentChildren } from 'preact';
import { Icon, type IconName } from './Icon';
import { tipAttrs, type Tip } from './Tooltip';

export type TagKind = 'good' | 'bad' | 'warn' | 'info' | 'accent' | 'outline';

export interface TagProps {
  kind?: TagKind;
  icon?: IconName;
  tip?: Tip;
  class?: string;
  children: ComponentChildren;
}

export function Tag({ kind, icon, tip, class: cls, children }: TagProps) {
  const className = ['tag', kind ? `tag--${kind}` : '', cls ?? ''].filter(Boolean).join(' ');
  return (
    <span class={className} {...tipAttrs(tip)}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}
