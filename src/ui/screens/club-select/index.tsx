/**
 * ui-new, flow-state-002 · New career: club select (04 §6.3). Left column
 * (4/12): tier filter and the world seed under Advanced; main (8/12): club
 * cards of the selected tier; bottom bar: the chosen club and Start career
 * (a binding commit: one dialog with the consequences).
 * Card data: crest, name, city and arena, tier, season budget and wage
 * budget, mean roster rating, club captain, prestige, roster cap, AI
 * personality; the lowest tier is "Recommended for a first career".
 * Keys: arrows move between cards, Enter picks, Ctrl Enter starts.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Club, ClubId } from '../../../core/model';
import type { ScreenProps } from '../../app/routes';
import { navigate } from '../../app/router';
import { installShortcuts } from '../../app/shortcuts';
import { ConfirmButton, Crest, Empty, Icon, PageHeader, Panel, Rating, Segmented, Tag, crestLetters, showToast, tipAttrs } from '../../components';
import { formatMoney } from '../../format';
import { useStore } from '../../store';
import { safeView, useEngine } from '../../store/engine';
import { fighterViewOf } from '../../store/views';
import { format } from '../../text';
import './club-select.css';

const T = {
  eyebrow: 'New career',
  title: 'Choose your club',
  meta: 'Every club plays by the same rules',
  meta2: 'Pick a tier, then a club',
  tier: 'Tier',
  tierFilter: 'Tier filter',
  advanced: 'Advanced',
  seed: 'World seed',
  seedHint: 'The same seed gives the same world. Regenerating replaces this unstarted world.',
  regenerate: 'Regenerate',
  recommended: 'Recommended for a first career',
  budget: 'Season budget',
  budgetTip: 'Season budget fixed at the season setup (central grant, sponsor, projected gates).',
  wageBudget: 'Wage budget',
  wageBudgetTip: 'Wage budget per week: offers that take the wage bill over it are refused.',
  meanRating: 'Mean rating',
  meanRatingTip: 'Mean rating of the club’s best five fighters.',
  captain: 'Captain',
  prestige: 'Prestige',
  prestigeTip: 'Prestige 0–100: drives sponsor money and how attractive the club is to free agents.',
  rosterCap: 'Roster cap',
  rosterCapTip: 'Roster places in this tier (O2).',
  personalityTip: 'AI manager style if the club were AI-run: {text}',
  pick: 'Pick a club to manage',
  chosen: '{club} · {tier}',
  start: 'Start career',
  startTitle: 'Start a career with {club}',
  startText: 'Your club is fixed for this career. You start in preseason week P1 (Trials Day).',
  startConfirm: 'Start with {club}',
  started: 'Career started with {club}',
  noWorld: 'No world yet',
  noWorldText: 'Start a new career from the title screen.',
  back: 'Title screen',
  cardsLabel: 'Clubs of the {tier}',
  rosterLabel: '{n} fighters',
} as const;

export default function ClubSelectScreen(_props: ScreenProps) {
  const store = useStore();
  const engine = useEngine();
  const state = store.game.value;
  const content = store.content.value;
  const tiers = content?.leagues.tiers ?? [];
  const lowest = tiers.length ? Math.max(...tiers.map((x) => x.level)) : 1;
  const [tierLevel, setTierLevel] = useState<number>(lowest);
  const [picked, setPicked] = useState<ClubId | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [seed, setSeed] = useState(state?.rng.root ?? '');
  const gridRef = useRef<HTMLDivElement>(null);

  const clubs = useMemo(() => {
    if (!state || !content) return [];
    const tier = content.tierByLevel(tierLevel);
    return Object.values(state.clubs)
      .filter((c) => c.tierId === tier.id)
      .sort((a, b) => b.prestige - a.prestige || (a.name < b.name ? -1 : 1));
  }, [state, content, tierLevel]);

  const info = (club: Club) => {
    const roster = state ? safeView(() => engine.roster(state, club.id), []) : [];
    const ratings = state && content ? roster.map((f) => fighterViewOf(engine, state, content, f.id)?.rating).filter((v): v is number => v !== undefined) : [];
    const best = [...ratings].sort((a, b) => b - a).slice(0, 5);
    const mean = best.length ? Math.round(best.reduce((s, v) => s + v, 0) / best.length) : null;
    const finance = state && content ? safeView(() => engine.financeView(state, club.id, content), null) : null;
    return { roster, mean, finance };
  };

  const start = () => {
    if (!picked) return;
    const club = state?.clubs[picked];
    const res = store.dispatch({ type: 'club.choose', clubId: picked });
    if (res.ok) {
      showToast({ title: format(T.started, { club: club?.name ?? '' }), kind: 'good' });
      navigate('#/home');
    }
  };

  useEffect(
    () =>
      installShortcuts(() => ({
        'ctrl+Enter': () => {
          document.querySelector<HTMLButtonElement>('[data-testid="start-career"]')?.click();
        },
      })),
    [],
  );

  if (!state || !content) {
    return (
      <main class="page" data-testid="screen-club-select">
        <Empty icon="league" title={T.noWorld} text={T.noWorldText} actions={<a class="btn" href="#/new-game">{T.back}</a>} />
      </main>
    );
  }

  const tier = content.tierByLevel(tierLevel);
  const pickedClub = picked ? state.clubs[picked] : null;
  const pickedTier = pickedClub ? content.tiers.get(pickedClub.tierId) : null;
  const pickedInfo = pickedClub ? info(pickedClub) : null;

  const onGridKey = (e: KeyboardEvent) => {
    const cards = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('.club-card') ?? [])];
    const i = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const cols = Math.max(1, Math.round((gridRef.current?.clientWidth ?? 1) / (cards[0]?.clientWidth || 1)));
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : 0;
    if (!delta) return;
    e.preventDefault();
    cards[Math.max(0, Math.min(cards.length - 1, i + delta))]?.focus();
  };

  return (
    <main class="club-select" data-testid="screen-club-select">
      <div class="page club-select__page">
        <PageHeader
          eyebrow={T.eyebrow}
          title={T.title}
          meta={[T.meta, T.meta2]}
          actions={
            <a class="btn btn--ghost" href="#/new-game">
              <Icon name="chevron-left" />
              {T.back}
            </a>
          }
        />
        <div class="l-grid">
          <div class="span-4 l-stack">
            <Panel title={T.tier} icon="league" bodyClass="l-stack">
              <Segmented<string>
                label={T.tierFilter}
                value={String(tierLevel)}
                onChange={(v) => setTierLevel(Number(v))}
                options={[...tiers].sort((a, b) => a.level - b.level).map((x) => ({ id: String(x.level), label: x.shortName, tip: `${x.name} · roster cap ${x.rosterCap}` }))}
              />
              <dl class="kv">
                <div>
                  <dt>{tier.name}</dt>
                  <dd {...tipAttrs(`Ratings in this tier are usually ${tier.ratingBand.min}–${tier.ratingBand.max}.`)}>
                    {`${tier.ratingBand.min}–${tier.ratingBand.max}`}
                  </dd>
                </div>
                <div>
                  <dt>{T.rosterCap}</dt>
                  <dd {...tipAttrs(T.rosterCapTip)}>{tier.rosterCap}</dd>
                </div>
              </dl>
              {tier.level === lowest && (
                <Tag kind="accent" icon="star">
                  {T.recommended}
                </Tag>
              )}
            </Panel>
            <Panel title={T.advanced} icon="settings" actions={<button class="btn btn--sm btn--ghost" type="button" aria-expanded={advanced ? 'true' : 'false'} onClick={() => setAdvanced((a) => !a)}><Icon name={advanced ? 'chevron-up' : 'chevron-down'} /></button>}>
              {advanced ? (
                <div class="l-stack l-stack--sm">
                  <label class="field">
                    <span class="field__label">{T.seed}</span>
                    <input class="input" type="text" value={seed} onInput={(e) => setSeed((e.target as HTMLInputElement).value)} />
                    <span class="field__hint">{T.seedHint}</span>
                  </label>
                  <button
                    class="btn btn--sm"
                    type="button"
                    disabled={store.busy.value}
                    onClick={async () => {
                      const res = await store.newGame(seed.trim() ? { seed: seed.trim() } : undefined);
                      if (res.ok) setPicked(null);
                    }}
                  >
                    <Icon name="refresh" />
                    {T.regenerate}
                  </button>
                </div>
              ) : (
                <span class="u-sm u-faint">{T.seedHint}</span>
              )}
            </Panel>
          </div>
          <div class="span-8">
            <div class="l-autogrid club-select__grid" ref={gridRef} role="group" aria-label={format(T.cardsLabel, { tier: tier.name })} onKeyDown={onGridKey}>
              {clubs.map((club) => {
                const tpl = content.clubs.get(club.id);
                const i = info(club);
                const captain = club.captainId ? state.fighters[club.captainId] : undefined;
                const personality = content.aiPersonalities.get(club.aiPersonalityId);
                return (
                  <button
                    key={club.id}
                    type="button"
                    class="card card--choice club-card"
                    aria-pressed={picked === club.id ? 'true' : 'false'}
                    data-testid={`club-card-${club.id}`}
                    onClick={() => setPicked(club.id)}
                  >
                    <span class="club-card__head">
                      <Crest primary={club.colors.primary} secondary={club.colors.secondary} code={crestLetters(club)} size="lg" />
                      <span class="club-card__name">
                        <span class="club-card__title">{club.name}</span>
                        <span class="u-xs u-muted">
                          {tpl?.city} · {tpl?.arena}
                        </span>
                      </span>
                    </span>
                    {tpl?.motto && <span class="club-card__motto u-display">{`“${tpl.motto}”`}</span>}
                    <dl class="kv club-card__kv">
                      <div>
                        <dt>{T.budget}</dt>
                        <dd {...tipAttrs(T.budgetTip)}>{i.finance ? formatMoney(i.finance.seasonBudget) : '—'}</dd>
                      </div>
                      <div>
                        <dt>{T.wageBudget}</dt>
                        <dd {...tipAttrs(T.wageBudgetTip)}>{i.finance ? formatMoney(i.finance.wageBudgetPerWeek, { perWeek: true }) : '—'}</dd>
                      </div>
                      <div>
                        <dt>{T.meanRating}</dt>
                        <dd {...tipAttrs(T.meanRatingTip)}>{i.mean !== null ? <Rating value={i.mean} /> : '—'}</dd>
                      </div>
                      <div>
                        <dt>{T.captain}</dt>
                        <dd {...tipAttrs(captain?.name.full ?? null)}>{captain?.name.full ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>{T.prestige}</dt>
                        <dd {...tipAttrs(T.prestigeTip)}>{club.prestige}</dd>
                      </div>
                      <div>
                        <dt>{T.rosterCap}</dt>
                        <dd {...tipAttrs(format(T.rosterLabel, { n: i.roster.length }))}>
                          {i.roster.length} / {tier.rosterCap}
                        </dd>
                      </div>
                    </dl>
                    <span class="l-cluster l-cluster--xs">
                      {personality && (
                        <Tag kind="outline" tip={format(T.personalityTip, { text: personality.description })}>
                          {personality.label}
                        </Tag>
                      )}
                      {tier.level === lowest && <Tag kind="accent">{T.recommended}</Tag>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <footer class="club-select__bar" aria-label={T.chosen}>
        <div class="club-select__bar-inner">
          {pickedClub ? (
            <span class="entity">
              <Crest primary={pickedClub.colors.primary} secondary={pickedClub.colors.secondary} code={crestLetters(pickedClub)} size="md" />
              <span class="entity__stack">
                <span class="entity__name">{pickedClub.name}</span>
                <span class="entity__sub">
                  {format(T.chosen, { club: content.clubs.get(pickedClub.id)?.city ?? '', tier: pickedTier?.name ?? '' })}
                </span>
              </span>
            </span>
          ) : (
            <span class="u-muted">{T.pick}</span>
          )}
          <ConfirmButton
            class="l-push"
            variant="primary"
            size="lg"
            icon="play"
            testId="start-career"
            disabled={!pickedClub}
            disabledReason={T.pick}
            title={format(T.startTitle, { club: pickedClub?.name ?? '' })}
            description={T.startText}
            consequences={
              pickedClub && pickedInfo
                ? [
                    { label: T.tier, value: pickedTier?.name ?? '' },
                    { label: T.budget, value: pickedInfo.finance ? formatMoney(pickedInfo.finance.seasonBudget) : '—' },
                    { label: T.wageBudget, value: pickedInfo.finance ? formatMoney(pickedInfo.finance.wageBudgetPerWeek, { perWeek: true }) : '—' },
                    { label: T.rosterCap, value: `${pickedInfo.roster.length} / ${pickedTier?.rosterCap ?? ''}` },
                  ]
                : []
            }
            confirmLabel={format(T.startConfirm, { club: pickedClub?.shortName ?? '' })}
            onConfirm={start}
          >
            {pickedClub ? T.start : T.pick} <kbd>Ctrl Enter</kbd>
          </ConfirmButton>
        </div>
      </footer>
    </main>
  );
}
