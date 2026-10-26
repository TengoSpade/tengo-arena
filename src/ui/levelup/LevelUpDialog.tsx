/**
 * Level-up dialog (M1.1 WP-D; progression.md sys-development "level-up offers", combat-skills.md
 * ranks and perks): one fighter, his oldest waiting level-up. Three option cards (stat: current →
 * new and the rating change; ability rank: the next rank's change; perk: effect, tier, requirements),
 * each saying why it was offered; illegal options greyed; the optional trait offer (two traits or
 * neither); Auto-pick (what his policy would take), Later (keeps it queued) and Confirm.
 * Keys: 1–3 pick an option, 4/5 a trait, 6 neither, A auto-pick, Enter confirms, Esc later.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ContentDB } from '../../core/content';
import type { LevelUpView } from '../../core/game';
import type { Fighter, FighterId, GameState, LevelUpModeSetting } from '../../core/model';
import { Callout, Kbd, Modal, TraitBadge, tipAttrs, traitPolarity } from '../components';
import { playerText } from '../format';
import { effectiveStats, levelInfo, optionText, pickLine } from '../m11/model';
import { RankPips, XpBar } from '../m11/parts';
import { useStore, type AppStore } from '../store';
import { useEngine } from '../store/engine';
import { useMatchDay } from '../store/match-day';
import { fighterViewOf } from '../store/views';
import { ClassTag, Portrait } from '../screens/league/lib/ui';
import { t } from './text';
import './levelup.css';

export interface LevelUpDialogProps {
  fighterId: FighterId;
  /** Closed: `done` true when a level-up was resolved (the host may open the next one). */
  onClose: (done: boolean) => void;
}

export function LevelUpDialog({ fighterId, onClose }: LevelUpDialogProps) {
  const store = useStore() as AppStore;
  const engine = useEngine();
  const md = useMatchDay(store);
  const state = store.game.value;
  const content = store.content.value;
  const view = state ? md.levelUpView(state, fighterId) : null;
  const fighter = state?.fighters[fighterId];
  if (!state || !content || !fighter || !view || view.pending.length === 0) return null;
  return <Dialog state={state} content={content} fighter={fighter} view={view} onClose={onClose} md={md} engine={engine} />;
}

function Dialog({
  state,
  content,
  fighter,
  view,
  onClose,
  md,
  engine,
}: {
  state: GameState;
  content: ContentDB;
  fighter: Fighter;
  view: LevelUpView;
  onClose: (done: boolean) => void;
  md: ReturnType<typeof useMatchDay>;
  engine: ReturnType<typeof useEngine>;
}) {
  const offer = view.pending[0]!;
  const key = `${fighter.id}:${offer.level}`;
  const [option, setOption] = useState<number | null>(null);
  const [trait, setTrait] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setOption(null);
    setTrait(null);
    setError(null);
  }, [key]);

  const stats = useMemo(() => effectiveStats(engine, state, content, fighter), [engine, state, content, fighter]);
  const rating = fighterViewOf(engine, state, content, fighter.id)?.rating ?? null;
  const info = levelInfo(engine, state, content, fighter);
  const auto = offer.autoPick;
  const autoLine = auto.optionIndex !== null ? pickLine(content, offer.options[auto.optionIndex]?.option ?? null) : t('autoNone');
  const legalCount = offer.options.filter((o) => o.legal).length;
  const needsOption = legalCount > 0;
  const canConfirm = !needsOption || option !== null;

  const confirm = (choice: { optionIndex: number | null; traitIndex: number | null }) => {
    const r = md.chooseLevelUp(fighter.id, offer.level, choice.optionIndex, choice.traitIndex);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    // More waiting for him: the dialog stays and shows the next one.
    if (view.pending.length <= 1) onClose(true);
  };

  // Keys work wherever focus is inside the dialog (the Modal keeps them from the game's shortcuts).
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest?.('[data-testid="levelup-dialog"]') || target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    const n = Number(k);
    if (n >= 1 && n <= 3 && offer.options[n - 1]?.legal) setOption(n - 1);
    else if ((k === '4' || k === '5') && offer.traitOffer?.[Number(k) - 4]) setTrait(Number(k) - 4);
    else if (k === '6' && offer.traitOffer) setTrait(null);
    else if (k === 'a') confirm(auto);
    else if (k === 'enter' && target.closest('.lu')) {
      if (canConfirm) confirm({ optionIndex: option, traitIndex: trait });
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, []);

  const kindLabel = { stat: t('kindStat'), rank: t('kindRank'), perk: t('kindPerk') } as const;
  const name = fighter.name.full;

  return (
    <Modal
      open
      size="wide"
      onClose={() => onClose(false)}
      onEnter={() => canConfirm && confirm({ optionIndex: option, traitIndex: trait })}
      title={t('title', { name, level: offer.level })}
      icon="level-up"
      testId="levelup-dialog"
      footerNote={<span class="u-xs u-faint">{t('keys')}</span>}
      footer={
        <>
          <ModeSelect value={fighter.levelUpMode} onChange={(m) => md.setLevelUpPolicy(fighter.id, m)} />
          <button class="btn btn--ghost" type="button" onClick={() => onClose(false)} data-testid="levelup-later" {...tipAttrs(t('laterTip'))}>
            {t('later')} <kbd>Esc</kbd>
          </button>
          <button class="btn" type="button" onClick={() => confirm(auto)} data-testid="levelup-auto" {...tipAttrs(t('autoTip', { pick: autoLine }))}>
            {t('auto')} <kbd>A</kbd>
          </button>
          <button
            class="btn btn--primary"
            type="button"
            aria-disabled={canConfirm ? undefined : 'true'}
            onClick={() => canConfirm && confirm({ optionIndex: option, traitIndex: trait })}
            data-testid="levelup-confirm"
            {...tipAttrs(canConfirm ? null : t('pickFirst'))}
          >
            {t('confirm')} <kbd>Enter</kbd>
          </button>
        </>
      }
    >
      <div class="lu" data-testid="levelup-body">
        <header class="lu__head">
          <span class="entity">
            <Portrait content={content} fighter={fighter} size="sm" />
            <span class="entity__stack">
              <span class="entity__name">{name}</span>
              <span class="entity__sub">
                <ClassTag content={content} classId={fighter.classId} /> · {content.races.get(fighter.raceId)?.name} {fighter.age}
                {rating !== null && ` · ${t('rating', { n: rating })}`}
              </span>
            </span>
          </span>
          <XpBar info={info} />
          {view.pending.length > 1 && <span class="tag tag--accent">{t('queue', { n: view.pending.length })}</span>}
        </header>

        <p class="u-sm u-muted lu__lead">{t('lead')}</p>
        {offer.options.length === 0 && <Callout kind="info" title={t('empty')} />}
        <div class="lu__options" role="radiogroup" aria-label={t('options')}>
          {offer.options.map((o, i) => {
            const text = optionText(content, fighter, stats, o.option);
            const ratingAfter = o.ratingAfter;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={option === i ? 'true' : 'false'}
                class={`lu-card${option === i ? ' is-picked' : ''}${o.legal ? '' : ' is-illegal'}`}
                data-kind={o.option.kind}
                disabled={!o.legal}
                onClick={() => setOption(i)}
                data-testid={`levelup-option-${i}`}
                {...tipAttrs(o.legal ? null : t('illegal'))}
              >
                <span class="lu-card__top">
                  <Kbd>{i + 1}</Kbd>
                  <span class="lu-card__kind">{kindLabel[o.option.kind]}</span>
                  {auto.optionIndex === i && <span class="tag tag--info">{t('autoMark')}</span>}
                </span>
                <span class="lu-card__title">{text.title}</span>
                <span class="lu-card__change u-num">{o.option.kind === 'stat' && o.statAfter !== null ? `${text.change.split(' → ')[0]} → ${o.statAfter}` : text.change}</span>
                {o.option.kind === 'rank' && <RankPips rank={o.option.toRank} label={t('rankPips', { n: o.option.toRank })} />}
                <span class="lu-card__detail">{o.option.kind === 'perk' ? playerText(text.detail) : text.detail}</span>
                {o.option.kind === 'stat' && rating !== null && ratingAfter !== null && (
                  <span class="lu-card__rating u-xs">{ratingAfter > rating ? t('ratingUp', { from: rating, to: ratingAfter }) : t('ratingSame', { n: rating })}</span>
                )}
                <span class="lu-card__why u-xs u-muted">{text.why}</span>
              </button>
            );
          })}
        </div>

        {offer.traitOffer && offer.traitOffer.length > 0 && (
          <section class="lu__traits" aria-label={t('traitTitle')} data-testid="levelup-traits">
            <h3 class="lu__traits-title">{t('traitTitle')}</h3>
            <p class="u-xs u-muted">{t('traitLead')}</p>
            <div class="lu__trait-row" role="radiogroup" aria-label={t('traitTitle')}>
              {offer.traitOffer.map((id, i) => {
                const tr = content.traits.get(id);
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={trait === i ? 'true' : 'false'}
                    class={`lu-trait${trait === i ? ' is-picked' : ''}`}
                    onClick={() => setTrait(trait === i ? null : i)}
                    data-testid={`levelup-trait-${i}`}
                  >
                    <Kbd>{i + 4}</Kbd>
                    {tr ? <TraitBadge name={tr.name} polarity={traitPolarity(tr)} /> : id}
                    <span class="u-xs u-muted">{tr ? playerText(tr.effectText ?? '') : ''}</span>
                  </button>
                );
              })}
              <button type="button" role="radio" aria-checked={trait === null ? 'true' : 'false'} class={`lu-trait${trait === null ? ' is-picked' : ''}`} onClick={() => setTrait(null)} data-testid="levelup-trait-none">
                <Kbd>6</Kbd>
                {t('neither')}
              </button>
            </div>
          </section>
        )}
        {error && <Callout kind="bad" title={error} />}
      </div>
    </Modal>
  );
}

const MODES: { id: LevelUpModeSetting; key: Parameters<typeof t>[0] }[] = [
  { id: 'inherit', key: 'modeInherit' },
  { id: 'manual', key: 'modeManual' },
  { id: 'auto', key: 'modeAuto' },
  { id: 'auto_stats', key: 'modeStats' },
  { id: 'auto_skills', key: 'modeSkills' },
];

/** Per-fighter level-up policy ("Ask me", auto modes, or the club default). */
export function ModeSelect({ value, onChange, testId }: { value: LevelUpModeSetting; onChange: (m: LevelUpModeSetting) => void; testId?: string }) {
  return (
    <label class="lu-mode u-xs" {...tipAttrs(t('modeTip'))}>
      <span class="u-muted">{t('mode')}</span>
      <select class="select select--sm" value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value as LevelUpModeSetting)} data-testid={testId ?? 'levelup-mode'}>
        {MODES.map((m) => (
          <option key={m.id} value={m.id}>
            {t(m.key)}
          </option>
        ))}
      </select>
    </label>
  );
}
