/**
 * Market › Renewals: next season's projected wage room (AL-R002-T006). A renewal's new terms start next season, and a
 * contract that ends this season is gone by then, so a renewal is judged against what the club will have to pay next
 * season, not this season's bill: the projected wage budget, less the contracts that continue, less the renewals
 * already agreed (and pending offers that run into it). The contracts that end unrenewed are not counted, and the
 * panel names them. Every figure is core's (FinanceView.nextSeason); this only lays it out.
 */
import type { ContentDB } from '../../../core/content';
import type { GameState } from '../../../core/model';
import { Panel, tipAttrs } from '../../components';
import { fmtMoney } from '../league/lib/format';
import { notCounted, type ClubMarket } from './model';
import { t } from './text';

export function NextSeasonRoom({ game, content, market, asks }: { game: GameState; content: ContentDB; market: ClubMarket; asks?: { count: number; total: number } }) {
  const n = market.nextSeason;
  if (!n) return null;
  const left = notCounted(game, n);
  const over = n.wageRoom < 0;
  return (
    <Panel title={t('room.title')} icon="finances" subtitle={t('room.subtitle', { season: n.season })} testId="market-next-room">
      <div class="room">
        <dl class="kv room__calc" data-testid="next-room-calc">
          <div>
            <dt {...tipAttrs(t('room.budgetTip'))}>{t('room.budget')}</dt>
            <dd class="u-num" data-testid="next-room-budget">
              {fmtMoney(n.projectedWageBudget, content)}
            </dd>
          </div>
          <div>
            <dt {...tipAttrs(t('room.continuingTip'))}>− {t('room.continuing')}</dt>
            <dd class="u-num" data-testid="next-room-continuing">
              −{fmtMoney(n.continuing, content)}
            </dd>
          </div>
          <div>
            <dt {...tipAttrs(t('room.agreedTip'))}>− {t('room.agreed')}</dt>
            <dd class="u-num" data-testid="next-room-agreed">
              −{fmtMoney(n.agreedRenewals, content)}
            </dd>
          </div>
          {n.pendingOffers > 0 && (
            <div>
              <dt {...tipAttrs(t('room.pendingTip'))}>− {t('room.pending', { season: n.season })}</dt>
              <dd class="u-num" data-testid="next-room-pending">
                −{fmtMoney(n.pendingOffers, content)}
              </dd>
            </div>
          )}
          <div class="room__total">
            <dt>{t('room.total')}</dt>
            <dd class={`u-num ${over ? 'u-bad' : 'u-good'}`} data-testid="next-room-total">
              {over ? `${t('room.over')} ${fmtMoney(-n.wageRoom, content)}` : t('room.per', { n: fmtMoney(n.wageRoom, content) })}
            </dd>
          </div>
        </dl>
        <div class="room__side" data-testid="next-room-notcounted">
          <h3 class="room__h">{t('room.notCounted')}</h3>
          {left.length > 0 ? (
            <>
              <ul class="room__list" role="list">
                {left.map((f) => (
                  <li key={f.id}>
                    <span>{f.name}</span> <span class="u-num u-muted">{fmtMoney(f.wage, content)}</span>
                  </li>
                ))}
              </ul>
              <p class="u-xs u-muted">
                {t('room.notCountedText', { wage: fmtMoney(n.expiring.wagePerWeek, content) })}
              </p>
            </>
          ) : (
            <p class="u-sm u-muted">{t('room.nothingExpiring')}</p>
          )}
          {asks && asks.count > 1 && (
            <p class={`u-sm room__all ${asks.total > n.wageRoom ? 'u-bad' : 'u-good'}`} data-testid="next-room-all" data-fits={asks.total > n.wageRoom ? 'no' : 'yes'}>
              {asks.total > n.wageRoom
                ? t('room.allOver', { n: asks.count, total: fmtMoney(asks.total, content), over: fmtMoney(asks.total - n.wageRoom, content) })
                : t('room.allFit', { n: asks.count, total: fmtMoney(asks.total, content), left: fmtMoney(n.wageRoom - asks.total, content) })}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
