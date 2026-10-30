/**
 * Button that opens a commit dialog for a BINDING action (04 §6.2 class 2,
 * D-M): renew, sign a trials rookie, release, Kick off season, Advance to
 * season end, Start career, load a save, overwrite or delete a slot.
 * The dialog states the consequences in numbers; the primary button names
 * the action and the amount ("Release for 10,620 ts"). Enter confirms, Esc
 * cancels, no second "Are you sure?". The confirm button disables on press
 * (single commit). Reversible changes never use this component.
 */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { t } from '../text';
import { Icon, type IconName } from './Icon';
import { Modal } from './Modal';
import { tipAttrs, type Tip } from './Tooltip';

export interface Consequence {
  label: string;
  value: ComponentChildren;
  tip?: Tip;
}

export interface ConfirmButtonProps {
  /** Button label. */
  children: ComponentChildren;
  icon?: IconName;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'lg';
  /** Dialog title, e.g. "Release Brannoc Hale?" is avoided: "Release Brannoc Hale". */
  title: string;
  dialogIcon?: IconName;
  /** One or two sentences above the numbers. */
  description?: ComponentChildren;
  consequences?: readonly Consequence[];
  /** Warning callout for actions that cannot be undone (release, load, call-up). */
  warning?: ComponentChildren;
  /** Primary button text naming the action and the amount. */
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => unknown;
  disabled?: boolean;
  /** Why the button is disabled (tooltip; a tooltip is never the only way to an action). */
  disabledReason?: string;
  tip?: Tip;
  testId?: string;
  class?: string;
}

export function ConfirmButton(props: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const variant = props.variant && props.variant !== 'default' ? ` btn--${props.variant}` : '';
  const size = props.size ? ` btn--${props.size}` : '';

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await props.onConfirm();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        class={`btn${variant}${size}${props.class ? ` ${props.class}` : ''}`}
        aria-disabled={props.disabled ? 'true' : undefined}
        data-testid={props.testId}
        {...tipAttrs(props.disabled ? (props.disabledReason ?? props.tip) : props.tip)}
        onClick={() => {
          if (!props.disabled) setOpen(true);
        }}
      >
        {props.icon && <Icon name={props.icon} />}
        {props.children}
      </button>
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={props.title}
        icon={props.dialogIcon ?? props.icon}
        size="narrow"
        onEnter={() => void confirm()}
        testId={props.testId ? `${props.testId}-dialog` : undefined}
        footer={
          <>
            <button type="button" class="btn" onClick={() => setOpen(false)} disabled={busy}>
              {t('common.cancel')} <kbd>Esc</kbd>
            </button>
            <button
              type="button"
              class={`btn btn--${props.confirmVariant ?? 'primary'}`}
              onClick={() => void confirm()}
              disabled={busy}
              data-autofocus
              data-testid={props.testId ? `${props.testId}-confirm` : undefined}
            >
              {props.confirmLabel} <kbd>Enter</kbd>
            </button>
          </>
        }
      >
        <div class="l-stack">
          {props.description && <p class="u-sm">{props.description}</p>}
          {props.consequences && props.consequences.length > 0 && (
            <dl class="kv">
              {props.consequences.map((c) => (
                <div key={c.label}>
                  <dt>{c.label}</dt>
                  <dd {...tipAttrs(c.tip)}>{c.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {props.warning && (
            <div class="callout callout--warn" role="note">
              <Icon name="warning" />
              <div class="callout__text">{props.warning}</div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
