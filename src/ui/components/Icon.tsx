/** Icon from the designer's set (components.css section 1): a currentColor mask. */
export type IconName =
  | 'arrow-down' | 'arrow-right' | 'arrow-up' | 'bell' | 'bolt' | 'bug' | 'calendar-check' | 'check'
  | 'chevron-down' | 'chevron-left' | 'chevron-right' | 'chevron-up' | 'clock' | 'close' | 'codex'
  | 'coins' | 'compare' | 'contract' | 'crown' | 'eye' | 'fighter' | 'filter' | 'finances'
  | 'fixtures' | 'gem' | 'heart' | 'home' | 'info' | 'injury' | 'keyboard' | 'ko' | 'league'
  | 'level-up' | 'load' | 'mail' | 'market' | 'minus' | 'moon' | 'more' | 'pin' | 'play' | 'plus'
  | 'question' | 'refresh' | 'save' | 'scroll' | 'search' | 'settings' | 'shield' | 'sort'
  | 'sort-down' | 'sort-up' | 'squad' | 'star' | 'star-outline' | 'sun' | 'swords' | 'tactics'
  | 'target' | 'trend' | 'tri-down' | 'tri-up' | 'undo' | 'user-minus' | 'user-plus' | 'warning';

export interface IconProps {
  name: IconName;
  size?: 'sm' | 'lg';
  class?: string;
  /** Accessible label; without it the icon is decorative (aria-hidden). */
  label?: string;
}

export function Icon({ name, size, class: cls, label }: IconProps) {
  const className = ['icon', size ? `icon--${size}` : '', cls ?? ''].filter(Boolean).join(' ');
  return label ? (
    <span class={className} data-icon={name} role="img" aria-label={label} />
  ) : (
    <span class={className} data-icon={name} aria-hidden="true" />
  );
}
