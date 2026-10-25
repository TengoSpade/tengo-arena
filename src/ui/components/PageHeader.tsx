/**
 * Page header: eyebrow, display-face title, one-line meta, page actions
 * (04 §6.1). Meta items are separated by the designer's `.sep-dot`.
 */
import { Fragment, type ComponentChildren } from 'preact';

export interface PageHeaderProps {
  eyebrow?: ComponentChildren;
  title: ComponentChildren;
  /** Short facts, joined with dots. Falsy items are skipped. */
  meta?: readonly ComponentChildren[];
  actions?: ComponentChildren;
  /** Above the header (breadcrumbs, prev/next). */
  before?: ComponentChildren;
}

export function PageHeader({ eyebrow, title, meta, actions, before }: PageHeaderProps) {
  const items = (meta ?? []).filter((m) => m !== null && m !== undefined && m !== false && m !== '');
  return (
    <>
      {before}
      <header class="page-header">
        <div class="page-header__text">
          {eyebrow !== undefined && <span class="page-header__eyebrow">{eyebrow}</span>}
          <h1 class="page-header__title">{title}</h1>
          {items.length > 0 && (
            <div class="page-header__meta">
              {items.map((item, i) => (
                <Fragment key={i}>
                  {i > 0 && <span class="sep-dot" aria-hidden="true" />}
                  <span>{item}</span>
                </Fragment>
              ))}
            </div>
          )}
        </div>
        {actions !== undefined && <div class="page-header__actions">{actions}</div>}
      </header>
    </>
  );
}
