/**
 * The arena's side panels: the live feed of key moments (aria-live, polite) and the pause inspector (P-22). Both are
 * DOM over the canvas (tech-018) and take only what the session hands them, which for a live round is bounded by the
 * live head.
 */
import { Icon, Tag } from '../../components';
import type { FeedItem } from './feed';
import type { InspectorModel, TraceLine } from './inspect';
import { t } from './text';

export function ArenaFeed({ items, announcement, onJump }: { items: readonly FeedItem[]; announcement: string | null; onJump: (tick: number) => void }) {
  // Newest first: the moment the player is waiting for sits at the top.
  const list = [...items].reverse();
  return (
    <section class="arena-feed" data-testid="arena-feed" aria-label={t('feedTitle')}>
      <h2 class="arena-panel__title">{t('feedTitle')}</h2>
      {/* The polite live region: new moments and auto-pause causes are announced; the whole list is not re-read. */}
      <div class="u-sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="arena-announce">
        {announcement ?? (items.length > 0 ? items[items.length - 1]!.text : '')}
      </div>
      {list.length === 0 ? (
        <p class="u-sm u-muted" data-testid="feed-empty">
          {t('feedEmpty')}
        </p>
      ) : (
        <ol class="arena-feed__list" role="list" data-testid="feed-list">
          {list.map((m) => (
            <li key={m.key} class="arena-feed__item" data-kind={m.kind} data-side={m.side ?? undefined} data-ours={m.ours === null ? undefined : String(m.ours)} data-testid="feed-item">
              <button type="button" class="arena-feed__jump" onClick={() => onJump(m.tick)}>
                <span class="arena-feed__time u-num">{m.time}</span>
                <span class="arena-feed__mark" aria-hidden="true">
                  {m.kind === 'down' || m.kind === 'captain-down' ? '◆' : m.kind === 'overtime' || m.kind === 'end' ? '▮' : '○'}
                </span>
                <span class="arena-feed__text">{m.text}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function TraceList({ lines }: { lines: readonly TraceLine[] }) {
  return (
    <ol class="arena-trace" role="list">
      {lines.map((l, i) => (
        <li key={i} class={`arena-trace__line${l.fired ? ' is-fired' : ''}`} data-testid="trace-line" data-fired={l.fired ? 'true' : 'false'}>
          <span class="arena-trace__label u-num">{l.label}</span>
          <span class="arena-trace__sentence">{l.sentence}</span>
          <span class="arena-trace__why u-xs u-muted">{l.fired ? t('inspectFiredRule') : `${t('inspectSkipped')}: ${l.why}`}</span>
        </li>
      ))}
    </ol>
  );
}

export type ProbeState = 'idle' | 'loading' | 'failed' | 'ready';

export function ArenaInspector({
  model,
  paused,
  probe,
  hasSelection,
  onClose,
}: {
  model: InspectorModel | null;
  paused: boolean;
  probe: ProbeState;
  hasSelection: boolean;
  onClose: () => void;
}) {
  return (
    <aside class="arena-inspector" data-testid="arena-inspector" aria-label={t('inspectTitle')}>
      <header class="arena-inspector__head">
        <h2 class="arena-panel__title">{t('inspectTitle')}</h2>
        <button class="icon-btn" type="button" onClick={onClose} aria-label={t('inspectClose')} data-testid="inspector-close">
          <Icon name="close" />
        </button>
      </header>
      {!hasSelection || !model ? (
        <p class="u-sm u-muted" data-testid="inspector-none">
          {t('inspectNone')}
        </p>
      ) : !paused ? (
        <div data-testid="inspector-pause-first">
          <p class="u-strong">{t('inspectPauseFirst')}</p>
          <p class="u-sm u-muted">{t('inspectPauseFirstText')}</p>
        </div>
      ) : (
        <div class="arena-inspector__body l-stack l-stack--sm">
          <div class="arena-inspector__who">
            <strong data-testid="inspector-name">{model.unit.name}</strong>
            <span class="u-sm u-muted">
              {model.unit.className}
              {model.isCaptain ? ` · ${t('inspectCaptain')}` : ''}
            </span>
            {model.vitals && (
              <span class="u-sm u-num" data-testid="inspector-vitals">
                {t('stripHp', { hp: model.vitals.hp, max: model.vitals.maxHp })}
                {model.vitals.shield ? ` · ${t('stripShield', { n: model.vitals.shield })}` : ''}
              </span>
            )}
            {model.freshness && model.unit.fatigueTag && (
              <Tag kind="warn" tip={model.freshnessPenalty ?? undefined}>
                {model.freshness}
              </Tag>
            )}
          </div>

          <section aria-labelledby="insp-decision" data-testid="inspector-decision">
            <h3 class="panel-section__title" id="insp-decision">
              {t('inspectDecision')}
            </h3>
            {model.decision ? (
              <>
                <p class="arena-inspector__rule" data-testid="inspector-rule">
                  <span class="arena-trace__label u-num">{model.decision.label}</span> {model.decision.sentence}
                  {model.decision.target ? <span class="u-muted"> → {model.decision.target}</span> : null}
                </p>
                <p class="u-xs u-muted">{model.decision.react}</p>
                {model.decision.trace.length > 1 && (
                  <>
                    <h4 class="u-xs u-faint">{t('inspectWhyNote')}</h4>
                    <TraceList lines={model.decision.trace} />
                  </>
                )}
              </>
            ) : (
              <p class="u-sm u-muted">{t('inspectDecisionNone')}</p>
            )}
          </section>

          <section aria-labelledby="insp-now" data-testid="inspector-now">
            <h3 class="panel-section__title" id="insp-now">
              {t('inspectNow')}
            </h3>
            {probe === 'loading' && <p class="u-sm u-muted">{t('inspectNowLoading')}</p>}
            {(probe === 'failed' || probe === 'idle') && <p class="u-sm u-muted">{t('inspectNowFailed')}</p>}
            {probe === 'ready' && model.now && (
              <>
                {model.now.evaluation ? (
                  <p class="arena-inspector__rule" data-testid="inspector-now-rule">
                    <span class="arena-trace__label u-num">{model.now.evaluation.label}</span> {model.now.evaluation.sentence}
                    {model.now.evaluation.target ? <span class="u-muted"> → {model.now.evaluation.target}</span> : null}
                    {model.now.evaluation.same && <span class="u-xs u-faint"> · {t('inspectNowSame')}</span>}
                  </p>
                ) : (
                  <p class="u-sm u-muted" data-testid="inspector-blocked">
                    {t('inspectNowNone', { why: model.now.blocked ?? '' })}
                  </p>
                )}
                <p class="u-xs u-faint">{t('inspectNowNote')}</p>
                {model.now.pending && <p class="u-sm">{model.now.pending}</p>}
                {model.now.evaluation && model.now.evaluation.trace.length > 1 && <TraceList lines={model.now.evaluation.trace} />}
                <dl class="arena-inspector__facts u-sm">
                  <dt>{t('inspectCooldowns')}</dt>
                  <dd>
                    {model.now.cooldowns.map((c) => (
                      <span key={c.name} class="arena-inspector__fact" data-testid="inspector-cooldown">
                        {c.name}: {c.text}
                      </span>
                    ))}
                  </dd>
                  <dt>{t('inspectStatuses')}</dt>
                  <dd>
                    {model.now.statuses.length === 0 ? (
                      <span class="u-muted">{t('inspectNoStatuses')}</span>
                    ) : (
                      model.now.statuses.map((s) => (
                        <span key={s.name} class="arena-inspector__fact" data-testid="inspector-status">
                          {s.name} {s.text}
                        </span>
                      ))
                    )}
                  </dd>
                </dl>
              </>
            )}
          </section>

          {model.fires && (
            <section aria-labelledby="insp-fires" data-testid="inspector-fires">
              <h3 class="panel-section__title" id="insp-fires">
                {t('inspectFires')}
              </h3>
              <ul class="arena-inspector__fires u-sm" role="list">
                {model.fires.map((f) => (
                  <li key={f.label} class={f.count === 0 ? 'u-muted' : undefined}>
                    <span class="arena-trace__label u-num">{f.label}</span> {f.count > 0 ? `×${f.count}` : t('inspectFiresNever')}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
