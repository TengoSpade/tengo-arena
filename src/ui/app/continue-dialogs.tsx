/**
 * The commit dialogs of Continue (kick off the season, advance to season end, expiring contracts).
 * A lazy chunk: the frame loads it shortly after start or when a dialog opens (05 bundle budget).
 */
import { Modal } from '../components/Modal';
import { formatMoney } from '../format';
import type { ClubContext } from '../store/views';
import { t } from '../text';
import { expiringUnrenewed } from './expiring';
import { marketViewRequest } from './intents';
import { navigate } from './router';

export type ConfirmVariant = 'kick-off' | 'season-end' | 'expiring';


export function ContinueConfirm({
  variant,
  ctx,
  onClose,
  onConfirm,
}: {
  variant: ConfirmVariant | null;
  ctx: ClubContext | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const kick = variant === 'kick-off';
  if (variant === 'expiring') {
    const expiring = expiringUnrenewed(ctx);
    const renew = () => {
      onClose();
      marketViewRequest.value = 'renewals';
      navigate('#/market');
    };
    return (
      <Modal
        open
        onClose={onClose}
        title={t('continue.expiringTitle', { n: expiring.length })}
        icon="contract"
        size="narrow"
        onEnter={renew}
        testId="expiring-confirm"
        footer={
          <>
            <button class="btn" type="button" onClick={onConfirm} data-testid="expiring-continue">
              {t('continue.expiringAnyway')}
            </button>
            <button class="btn btn--primary" type="button" onClick={renew} data-autofocus>
              {t('continue.expiringRenew')} <kbd>Enter</kbd>
            </button>
          </>
        }
      >
        <div class="l-stack">
          <p class="u-sm">{t('continue.expiringText')}</p>
          <ul class="checklist" role="list">
            {expiring.map((f) => (
              <li key={f.id} data-state="warn">
                {f.name.full} · {formatMoney(f.contract!.wagePerWeek, { perWeek: true })}
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    );
  }
  return (
    <Modal
      open={variant !== null}
      onClose={onClose}
      title={kick ? t('continue.kickOffTitle') : t('continue.seasonEndTitle')}
      icon={kick ? 'play' : 'calendar-check'}
      size="narrow"
      onEnter={onConfirm}
      testId="continue-confirm"
      footer={
        <>
          <button class="btn" type="button" onClick={onClose}>
            {t('common.cancel')} <kbd>Esc</kbd>
          </button>
          <button class="btn btn--primary" type="button" onClick={onConfirm} data-autofocus>
            {kick ? t('continue.kickOffConfirm') : t('continue.seasonEndConfirm')} <kbd>Enter</kbd>
          </button>
        </>
      }
    >
      <div class="l-stack">
        <p class="u-sm">{kick ? t('continue.kickOffText') : t('continue.seasonEndText')}</p>
        {ctx && (
          <dl class="kv">
            <div>
              <dt>{t('topbar.roster')}</dt>
              <dd>
                {ctx.roster.length} / {ctx.rosterCap}
              </dd>
            </div>
            {ctx.finance && (
              <>
                <div>
                  <dt>{t('topbar.wages')}</dt>
                  <dd>
                    {formatMoney(ctx.finance.wageBill)} / {formatMoney(ctx.finance.wageBudgetPerWeek)}
                  </dd>
                </div>
                <div>
                  <dt>{t('topbar.balance')}</dt>
                  <dd>{formatMoney(ctx.finance.balance)}</dd>
                </div>
              </>
            )}
          </dl>
        )}
      </div>
    </Modal>
  );
}
