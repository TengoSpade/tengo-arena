/**
 * Panel: the designer's `.panel` with header (micro-title, subtitle,
 * actions), body and footer. Panels group by question ("Who plays?"),
 * not by data type (04 §1).
 */
import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { Icon, type IconName } from './Icon';
import { tipAttrs, type Tip } from './Tooltip';

export interface PanelProps {
  title?: ComponentChildren;
  icon?: IconName;
  subtitle?: ComponentChildren;
  subtitleTip?: Tip;
  /** Right side of the header. */
  actions?: ComponentChildren;
  /** Extra header content between the subtitle and the actions. */
  headerExtra?: ComponentChildren;
  footer?: ComponentChildren;
  footerClass?: string;
  footerLabel?: string;
  hero?: boolean;
  /** Body padding: default, tight, flush (tables) or none (caller renders its own sections). */
  body?: 'default' | 'tight' | 'flush' | 'none';
  bodyClass?: string;
  /** Grid span in an `.l-grid` (1-12). */
  span?: number;
  class?: string;
  id?: string;
  testId?: string;
  children?: ComponentChildren;
}

export function Panel(props: PanelProps) {
  const titleId = useId();
  const cls = ['panel', props.hero ? 'panel--hero' : '', props.span ? `span-${props.span}` : '', props.class ?? '']
    .filter(Boolean)
    .join(' ');
  const body = props.body ?? 'default';
  const bodyCls = ['panel__body', body === 'tight' ? 'panel__body--tight' : '', body === 'flush' ? 'panel__body--flush' : '', props.bodyClass ?? '']
    .filter(Boolean)
    .join(' ');
  const hasHeader = props.title !== undefined || props.actions !== undefined;
  return (
    <section class={cls} id={props.id} aria-labelledby={props.title !== undefined ? titleId : undefined} data-testid={props.testId}>
      {hasHeader && (
        <header class="panel__header">
          {props.title !== undefined && (
            <h2 class="panel__title" id={titleId}>
              {props.icon && <Icon name={props.icon} />}
              {props.title}
            </h2>
          )}
          {props.subtitle !== undefined && (
            <span class="panel__subtitle" {...tipAttrs(props.subtitleTip)}>
              {props.subtitle}
            </span>
          )}
          {props.headerExtra}
          {props.actions !== undefined && <div class="panel__actions">{props.actions}</div>}
        </header>
      )}
      {body === 'none' ? props.children : <div class={bodyCls}>{props.children}</div>}
      {props.footer !== undefined && (
        <footer class={`panel__footer${props.footerClass ? ` ${props.footerClass}` : ''}`} aria-label={props.footerLabel}>
          {props.footer}
        </footer>
      )}
    </section>
  );
}
