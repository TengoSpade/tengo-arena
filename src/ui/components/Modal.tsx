/**
 * Modal dialog on the native <dialog> (04 §9: dialogs as <dialog>, initial
 * focus, Esc closes, focus returns to the opener). Only dialogs the player
 * opened appear (04 notification budget).
 *
 * Focus always lands inside: on [data-autofocus], else the primary footer button, else the first
 * control, else the dialog itself (it is focusable, tabindex -1). A re-render, a route change or the
 * opener leaving the page can take it away right after opening, and a focused control that goes
 * (disabled, removed) drops it to <body>; both are put back, so a dialog's keys work at once.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { t } from '../text';
import { Icon, type IconName } from './Icon';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ComponentChildren;
  icon?: IconName;
  size?: 'narrow' | 'wide';
  children?: ComponentChildren;
  /** Buttons, right-aligned. */
  footer?: ComponentChildren;
  /** Left side of the footer (small muted text). */
  footerNote?: ComponentChildren;
  /** Enter inside the dialog (outside text areas and buttons) calls this. */
  onEnter?: () => void;
  testId?: string;
}

/** Where focus goes when a dialog opens (or gets lost). */
function initialFocusTarget(dlg: HTMLDialogElement): HTMLElement {
  return (
    dlg.querySelector<HTMLElement>('[data-autofocus]') ??
    dlg.querySelector<HTMLElement>('.modal__footer .btn--primary, .modal__footer .btn--danger') ??
    dlg.querySelector<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ??
    dlg
  );
}

/** True when focus is outside the dialog or on nothing (<body>). */
function focusLost(dlg: HTMLDialogElement): boolean {
  const a = document.activeElement;
  return !a || a === document.body || a === document.documentElement || !dlg.contains(a);
}

export function Modal({ open, onClose, title, icon, size, children, footer, footerNote, onEnter, testId }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const opener = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return undefined;
    if (open) {
      opener.current = document.activeElement;
      if (!dlg.open) {
        if (typeof dlg.showModal === 'function') {
          try {
            dlg.showModal();
          } catch {
            dlg.setAttribute('open', '');
          }
        } else dlg.setAttribute('open', '');
      }
      initialFocusTarget(dlg).focus();
      // Focus taken away in the same tick (a re-render, a route change): put it back once things settle.
      const recheck = () => {
        if ((dlg.open || dlg.hasAttribute('open')) && focusLost(dlg)) initialFocusTarget(dlg).focus();
      };
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(recheck) : 0;
      const timer = setTimeout(recheck, 150);
      return () => {
        if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    } else if (dlg.open || dlg.hasAttribute('open')) {
      if (typeof dlg.close === 'function') dlg.close();
      dlg.removeAttribute('open');
      if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    // The focused control went away (disabled, removed): focus fell to <body>. Bring it back into the dialog.
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget) return;
      setTimeout(() => {
        if ((dlg.open || dlg.hasAttribute('open')) && focusLost(dlg)) initialFocusTarget(dlg).focus();
      }, 0);
    };
    dlg.addEventListener('cancel', onCancel);
    dlg.addEventListener('focusout', onFocusOut);
    return () => {
      dlg.removeEventListener('cancel', onCancel);
      dlg.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Enter' && onEnter) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag !== 'TEXTAREA' && tag !== 'BUTTON' && tag !== 'A' && tag !== 'SELECT') {
        e.preventDefault();
        onEnter();
      }
    }
    // Keep global shortcuts (Space = Continue, digits = screens) out of dialogs.
    e.stopPropagation();
  };

  return (
    <dialog
      ref={ref}
      class={`modal${size ? ` modal--${size}` : ''}`}
      tabIndex={-1}
      aria-labelledby={titleId}
      data-testid={testId}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          <header class="modal__header">
            {icon && <Icon name={icon} size="lg" />}
            <h2 class="modal__title" id={titleId}>
              {title}
            </h2>
            <button class="icon-btn modal__close" type="button" aria-label={t('common.close')} onClick={onClose}>
              <Icon name="close" />
            </button>
          </header>
          <div class="modal__body">{children}</div>
          {(footer || footerNote) && (
            <footer class="modal__footer">
              <span class="modal__footer-note">{footerNote}</span>
              {footer}
            </footer>
          )}
        </>
      )}
    </dialog>
  );
}
