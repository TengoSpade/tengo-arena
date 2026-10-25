/**
 * Modal dialog on the native <dialog> (04 §9: dialogs as <dialog>, initial
 * focus, Esc closes, focus returns to the opener). Only dialogs the player
 * opened appear (04 notification budget).
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

export function Modal({ open, onClose, title, icon, size, children, footer, footerNote, onEnter, testId }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const opener = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
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
      const target =
        dlg.querySelector<HTMLElement>('[data-autofocus]') ??
        dlg.querySelector<HTMLElement>('.modal__footer .btn--primary, .modal__footer .btn--danger') ??
        dlg.querySelector<HTMLElement>('button, [href], input, select');
      target?.focus();
    } else if (dlg.open || dlg.hasAttribute('open')) {
      if (typeof dlg.close === 'function') dlg.close();
      dlg.removeAttribute('open');
      if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    dlg.addEventListener('cancel', onCancel);
    return () => dlg.removeEventListener('cancel', onCancel);
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
