/**
 * Offer dialog (04 ui-market): wage stepper, length, the fighter's ask, the
 * deterministic terms check, signing cost, balance, roster and wage bill
 * after, with a meter against the wage budget. One component for the three
 * contract paths: free-agent offers (answered at week processing; Send needs
 * no confirmation), renewals and trials signings (answered at once and
 * binding: the primary button names the action and the amount, D-M).
 */
import { useEffect, useState } from 'preact/hooks';
import type { ContentDB } from '../../../core/content';
import type { ClubId, Command, Fighter, GameState, OfferResponse } from '../../../core/model';
import type { EngineError } from '../../../core/util';
import { Meter, Modal, showToast } from '../../components';
import type { GameStore } from '../../store';
import type { Wp7Engine } from '../league/lib/engine';
import { fmtMoney, fmtPctBp } from '../league/lib/format';
import { Callout, ClassTag, Portrait, Segmented } from '../league/lib/ui';
import { tryView } from '../league/lib/views';
import { greedLabel, termsCheck, type ClubMarket, type OfferKind } from './model';
import { t } from './text';

export interface OfferTarget {
  fighterId: Fighter['id'];
  kind: OfferKind;
  /** Start values (a pending offer being changed, a counter). */
  wage?: number;
  seasons?: number;
}

function errText(error: EngineError, m: ClubMarket, content: ContentDB): string {
  const d = (error.details ?? {}) as Record<string, unknown>;
  switch (error.code) {
    case 'roster.full':
      return m.pendingOffers > 0
        ? t('disabled.fullPending', { roster: m.roster, pending: m.pendingOffers, cap: m.cap })
        : t('err.roster.full', { roster: m.roster, cap: m.cap });
    case 'wage.budget':
      return t('err.wage.budget', { excess: fmtMoney(Number(d['excess'] ?? 0), content) });
    case 'cash.balance':
      return t('err.cash.balance', { cost: fmtMoney(Number(d['signingCost'] ?? 0), content) });
    case 'finance.embargo':
      return t('err.finance.embargo', { min: fmtMoney(m.tierMinWage, content) });
    default:
      return t('err.generic', { message: error.message });
  }
}

export function OfferDialog({
  target,
  onClose,
  store,
  engine,
  game,
  content,
  clubId,
  market,
}: {
  target: OfferTarget | null;
  onClose: () => void;
  store: GameStore;
  engine: Wp7Engine;
  game: GameState;
  content: ContentDB;
  clubId: ClubId;
  market: ClubMarket;
}) {
  const fighter = target ? game.fighters[target.fighterId] : undefined;
  const kind = target?.kind ?? 'free-agent';
  const askFor = (seasons: number) => {
    if (!fighter) return 0;
    const a = tryView(() => engine.ask(game, fighter.id, clubId, seasons, content));
    return a.ok ? a.value : 0;
  };
  const preferred = (() => {
    const list = market.lengths.map((s) => ({ s, a: askFor(s) })).sort((x, y) => x.a - y.a || x.s - y.s);
    return list[0]?.s ?? 1;
  })();
  const [seasons, setSeasons] = useState(target?.seasons ?? preferred);
  const [wage, setWage] = useState(target?.wage ?? askFor(target?.seasons ?? preferred));
  const [answer, setAnswer] = useState<OfferResponse | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!target) return;
    const s = target.seasons ?? preferred;
    setSeasons(s);
    setWage(target.wage ?? askFor(s));
    setAnswer(null);
    setSendError(null);
  }, [target?.fighterId, target?.kind]);

  if (!target || !fighter) return <Modal open={false} onClose={onClose} title="" />;

  const view = tryView(() => engine.fighterView(game, fighter.id, content));
  const v = view.ok ? view.value : null;
  const neg = game.market.negotiations.find(
    (n) => n.fighterId === fighter.id && n.clubId === clubId && n.season === game.calendar.season && n.kind === (kind === 'renewal' ? 'renewal' : 'free-agent'),
  );
  const counterValid = neg?.counterWage != null && (neg.validUntilWeek ?? 0) >= game.calendar.weekIndex;
  const ask = askFor(seasons);
  const required = counterValid ? neg!.counterWage! : ask;
  const terms = termsCheck(content, fighter, wage, required);
  const { label: greed } = greedLabel(content, fighter.contractProfile.greedBp);
  const check = tryView(() => engine.checkOffer(game, { clubId, fighterId: fighter.id, wagePerWeek: wage, seasons, kind }, content));
  const legal = check.ok && check.value.ok ? check.value.value : null;
  const illegal = check.ok && !check.value.ok ? errText(check.value.error, market, content) : !check.ok ? check.error : null;
  const own = game.market.offers.find((o) => o.fighterId === fighter.id && o.clubId === clubId);
  const replaced = kind === 'renewal' ? (fighter.contract?.wagePerWeek ?? 0) : own ? own.wagePerWeek : 0;
  const billAfter = market.wageBill + market.pendingWages - replaced + wage;
  const share = market.wageBudget > 0 ? billAfter / market.wageBudget : 1;
  const rosterAfter = kind === 'renewal' ? market.roster + market.pendingOffers : market.roster + market.pendingOffers + (own ? 0 : 1);
  const endSeason = (kind === 'renewal' ? (fighter.contract?.endSeason ?? game.calendar.season) : game.calendar.season - 1) + seasons;
  const race = content.races.get(fighter.raceId)?.name ?? fighter.raceId;
  const patience = neg ? neg.patienceLeft : kind === 'renewal' ? content.economy.negotiation.renewalOffersPerSeason : content.economy.negotiation.freeAgentRefusalsPerClubPerSeason;
  const rivals = game.market.offers.filter((o) => o.fighterId === fighter.id && o.clubId !== clubId).length;
  const step = (n: number) => setWage((w) => Math.max(5, Math.floor((w + n) / 5) * 5));

  const send = () => {
    if (sending || illegal) return;
    setSending(true);
    setSendError(null);
    let command: Command;
    if (kind === 'free-agent') {
      command = { type: 'offer.make', clubId, fighterId: fighter.id, wagePerWeek: wage, seasons, acceptCounter: counterValid && wage >= required };
    } else if (kind === 'renewal') {
      command = { type: 'contract.renew', clubId, fighterId: fighter.id, wagePerWeek: wage, seasons };
    } else {
      command = { type: 'trials.sign', clubId, fighterId: fighter.id, wagePerWeek: wage, seasons };
    }
    const r = store.dispatch(command);
    setSending(false);
    if (!r.ok) {
      setSendError(errText(r.error, market, content));
      return;
    }
    const response = r.value.response;
    const wageText = fmtMoney(wage, content);
    const lengthText = seasons === 1 ? t('season1') : t('seasonsLong', { n: seasons });
    if (kind === 'free-agent') {
      showToast({
        kind: 'good',
        title: t('toast.sent', { name: fighter.name.full }),
        sub: t('toast.sentSub', { wage: wageText, seasons: lengthText }),
        undo: () => store.dispatch({ type: 'offer.withdraw', clubId, fighterId: fighter.id }),
      });
      onClose();
      return;
    }
    if (!response || response.kind === 'accepted' || response.kind === 'pending') {
      showToast({
        kind: 'good',
        title: kind === 'renewal' ? t('toast.renewed', { name: fighter.name.full }) : t('toast.signed', { name: fighter.name.full }),
        sub: kind === 'renewal' ? t('toast.renewedSub', { wage: wageText, end: endSeason }) : t('toast.signedSub', { wage: wageText, seasons: lengthText }),
      });
      onClose();
      return;
    }
    setAnswer(response);
    if (response.kind === 'countered') setWage(response.counterWage);
  };

  const title =
    kind === 'renewal' ? t('offer.renewTitle', { name: fighter.name.full }) : kind === 'trials' ? t('offer.trialsTitle', { name: fighter.name.full }) : t('offer.title', { name: fighter.name.full });
  const primary = kind === 'renewal' ? t('offer.renew', { wage: fmtMoney(wage, content) }) : kind === 'trials' ? t('offer.sign', { wage: fmtMoney(wage, content) }) : t('offer.send');

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      size="wide"
      title={title}
      testId="offer-dialog"
      onEnter={send}
      footerNote={kind === 'renewal' ? t('offer.noteRenew') : kind === 'trials' ? t('offer.noteTrials') : t('offer.note')}
      footer={
        <>
          <button type="button" class="btn btn--ghost" onClick={onClose}>
            {t('offer.cancel')} <kbd>Esc</kbd>
          </button>
          <button type="button" class="btn btn--primary" onClick={send} disabled={Boolean(illegal) || sending} data-testid="offer-send">
            {primary} <kbd>Enter</kbd>
          </button>
        </>
      }
    >
      <div class="offer-head">
        <Portrait content={content} fighter={fighter} size="sm" />
        <div class="u-sm u-muted">
          <ClassTag content={content} classId={fighter.classId} /> · {t('offer.sub', { race, age: fighter.age, rating: v?.rating ?? '?', potential: v?.potential ?? '?', greed })}
        </div>
      </div>
      <div class="l-grid offer-grid">
        <div class="span-6 l-stack">
          <div class="field">
            <label class="field__label" for="offer-wage">
              {t('offer.wage')}
            </label>
            <div class="l-row">
              <button class="btn btn--icon btn--sm" type="button" aria-label={t('offer.minus')} onClick={() => step(-5)}>
                <span class="icon" data-icon="minus" aria-hidden="true" />
              </button>
              <input
                class="input u-num offer-wage"
                id="offer-wage"
                inputMode="numeric"
                value={wage}
                data-autofocus
                onInput={(e) => {
                  const n = Number((e.target as HTMLInputElement).value.replace(/[^\d]/g, ''));
                  if (Number.isFinite(n)) setWage(n);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    step((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 25 : 5));
                  }
                }}
              />
              <button class="btn btn--icon btn--sm" type="button" aria-label={t('offer.plus')} onClick={() => step(5)}>
                <span class="icon" data-icon="plus" aria-hidden="true" />
              </button>
              <span class="u-sm u-muted">
                {t('offer.asks')}{' '}
                <strong class="u-num" data-testid="offer-ask">
                  {fmtMoney(required, content)}
                </strong>
              </span>
            </div>
            <span class="field__hint">{t('offer.step')}</span>
          </div>
          <div class="field">
            <span class="field__label">{t('offer.length')}</span>
            <Segmented
              label={t('offer.length')}
              value={String(seasons)}
              options={market.lengths.map((s) => ({ value: String(s), label: s === 1 ? t('season1') : t('seasonsLong', { n: s }) }))}
              onChange={(s) => {
                const n = Number(s);
                setSeasons(n);
                if (!counterValid) setWage(askFor(n));
              }}
            />
            <span class="field__hint">{t('offer.lengthHint', { end: endSeason, pref: preferred === 1 ? t('season1') : t('seasonsLong', { n: preferred }) })}</span>
          </div>
        </div>
        <div class="span-6 l-stack" data-testid="offer-terms">
          {answer && answer.kind === 'countered' ? (
            <Callout kind="warn" title={t('offer.countered', { wage: fmtMoney(answer.counterWage, content) })}>
              {t('offer.counteredText', { wage: fmtMoney(answer.counterWage, content) })}
            </Callout>
          ) : answer && answer.kind === 'refused' ? (
            <Callout kind="bad" title={t('offer.refused')}>
              {answer.reason}
            </Callout>
          ) : terms.verdict === 'acceptable' ? (
            <Callout kind="good" title={t('offer.terms.acceptable')}>
              {kind === 'free-agent' ? t('offer.terms.acceptableText', { rivals }) : t('offer.terms.acceptableRenew')}
            </Callout>
          ) : terms.verdict === 'counter' ? (
            <Callout kind="warn" title={t('offer.terms.counter', { counter: fmtMoney(terms.counter ?? 0, content) })}>
              {t('offer.terms.counterText', { greed, flex: fmtPctBp(terms.flexBp) })}
            </Callout>
          ) : (
            <Callout kind="bad" title={t('offer.terms.refused')}>
              {t('offer.terms.refusedText', { greed, flex: fmtPctBp(terms.flexBp), patience })}
            </Callout>
          )}
          {(illegal || sendError) && (
            <Callout kind="bad" title={sendError ?? illegal ?? ''} />
          )}
          <dl class="kv">
            <div>
              <dt>{kind === 'free-agent' ? t('offer.signing') : t('offer.signingNow')}</dt>
              <dd>{legal ? fmtMoney(legal.signingCost, content) : '—'}</dd>
            </div>
            <div>
              <dt>{t('offer.balanceAfter')}</dt>
              <dd>{legal ? fmtMoney(market.balance - legal.signingCost, content) : '—'}</dd>
            </div>
            <div>
              <dt>{t('offer.rosterAfter')}</dt>
              <dd>
                {rosterAfter} / {market.cap} {rosterAfter >= market.cap && <span class="tag tag--warn">{t('offer.full')}</span>}
              </dd>
            </div>
          </dl>
          <div class="l-stack l-stack--xs">
            <div class="l-row u-sm">
              <span class="u-muted">{t('offer.billAfter')}</span>
              <span class="l-push u-num">
                <strong>{fmtMoney(billAfter, content)}</strong> <span class="u-muted">{t('offer.billOf', { budget: fmtMoney(market.wageBudget, content) })}</span>
              </span>
            </div>
            <Meter value={share} mark={1} state={share > 1 ? 'bad' : share > 0.9 ? 'warn' : 'good'} />
            <span class="u-xs u-faint">
              {t('offer.billNote', { pct: `${Math.round(share * 100)}%`, room: fmtMoney(market.wageBudget - billAfter, content) })}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
