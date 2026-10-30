/** Compare up to 3 free agents against one of our fighters (04 ui-market compare tray). */
import type { ContentDB } from '../../../core/content';
import type { FighterView } from '../../../core/game';
import type { FighterId, GameState } from '../../../core/model';
import { Modal } from '../../components';
import { fmtMoney } from '../league/lib/format';
import type { MarketRow } from './model';
import { t } from './text';

interface Col {
  id: FighterId;
  current: boolean;
  name: string;
  sub: string;
  view: FighterView | null;
  wage: number;
  contract: string;
  pos: number;
  neg: number;
}

export function CompareDialog({
  open,
  onClose,
  game,
  content,
  ours,
  oursView,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  game: GameState;
  content: ContentDB;
  ours: FighterId | null;
  oursView: FighterView | null;
  rows: MarketRow[];
}) {
  const traitsOf = (id: FighterId) => {
    const f = game.fighters[id];
    const list = f?.traits.map((x) => content.traits.get(x.id)) ?? [];
    return { pos: list.filter((x) => x && x.polarity !== 'negative').length, neg: list.filter((x) => x?.polarity === 'negative').length };
  };
  const cols: Col[] = [];
  const of = ours ? game.fighters[ours] : undefined;
  if (of) {
    cols.push({
      id: of.id,
      current: true,
      name: of.name.full,
      sub: t('compare.yours', { class: content.classes.get(of.classId)?.name ?? '' }),
      view: oursView,
      wage: of.contract?.wagePerWeek ?? 0,
      contract: of.contract ? t('compare.contractTo', { n: of.contract.endSeason }) : '—',
      ...traitsOf(of.id),
    });
  }
  for (const r of rows) {
    cols.push({
      id: r.fighter.id,
      current: false,
      name: r.fighter.name.full,
      sub: t('compare.free', { class: content.classes.get(r.fighter.classId)?.name ?? '' }),
      view: r.view,
      wage: r.ask,
      contract: t('compare.contractAsk', { n: r.preferred }),
      ...traitsOf(r.fighter.id),
    });
  }
  type Line = { label: string; values: (number | null)[]; text?: (string | null)[]; higher: boolean | null };
  const lines: Line[] = [
    { label: t('compare.rating'), values: cols.map((c) => c.view?.rating ?? null), higher: true },
    { label: t('compare.potential'), values: cols.map((c) => c.view?.potential ?? null), higher: true },
    {
      label: t('compare.age'),
      values: cols.map((c) => c.view?.humanAge ?? null),
      text: cols.map((c) => {
        const f = game.fighters[c.id];
        return f ? `${content.races.get(f.raceId)?.name ?? f.raceId} ${f.age} (${c.view?.humanAge ?? '?'})` : null;
      }),
      higher: null,
    },
    ...content.stats.list.map((s) => ({ label: s.name, values: cols.map((c) => c.view?.stats[s.id as never] ?? null), higher: true })),
    { label: t('compare.wage'), values: cols.map((c) => c.wage), text: cols.map((c) => fmtMoney(c.wage, content)), higher: false },
    { label: t('compare.contract'), values: cols.map(() => null), text: cols.map((c) => c.contract), higher: null },
    { label: t('compare.traits'), values: cols.map((c) => c.pos - c.neg), text: cols.map((c) => t('compare.traitsCount', { pos: c.pos, neg: c.neg })), higher: true },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      icon="compare"
      title={t('compare.title')}
      footerNote={t('compare.note')}
      testId="compare-dialog"
      footer={
        <button type="button" class="btn" onClick={onClose}>
          {t('offer.cancel')} <kbd>Esc</kbd>
        </button>
      }
    >
      <div class="compare" style={{ '--cols': cols.length }}>
        <span />
        {cols.map((c) => (
          <div key={c.id} class={c.current ? 'compare__head compare__cell is-current' : 'compare__head compare__cell'}>
            <span>{c.name}</span>
            <span class="u-xs u-muted">{c.sub}</span>
          </div>
        ))}
        {lines.map((line) => {
          const nums = line.values.filter((x): x is number => x !== null);
          const best = line.higher === null || nums.length < 2 ? null : line.higher ? Math.max(...nums) : Math.min(...nums);
          const unique = best !== null && nums.filter((x) => x === best).length === 1;
          return [
            <span key={`${line.label}-l`} class="compare__label">
              {line.label}
            </span>,
            ...cols.map((c, i) => {
              const val = line.values[i];
              const cls = ['compare__cell', c.current ? 'is-current' : '', unique && val === best ? 'is-best' : ''].filter(Boolean).join(' ');
              return (
                <span key={`${line.label}-${c.id}`} class={cls}>
                  {line.text?.[i] ?? (val ?? '—')}
                </span>
              );
            }),
          ];
        })}
      </div>
    </Modal>
  );
}
