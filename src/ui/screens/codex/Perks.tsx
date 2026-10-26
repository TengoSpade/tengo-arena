/**
 * Codex M1.1 (WP-D; combat-skills.md sys-ability-ranks, sys-perks): rank effects per ability and the
 * perk catalog by archetype and tier, with requirements and exclusions.
 */
import type { ContentDB } from '../../../core/content';
import { RoleGlyph, tipAttrs } from '../../components';
import { playerText } from '../../format';
import { perkRequiresText, tierRoman } from '../../m11/model';
import { PerkBadge } from '../../m11/parts';

/** "Rank II: …  Rank III: …" under an ability (null for an ability that does not rank). */
export function RankLines({ content, abilityId }: { content: ContentDB; abilityId: string }) {
  const row = content.abilityRanks(abilityId);
  if (!row || row.ranks.length === 0) return <div class="u-xs u-faint codex-ranks">Does not rank</div>;
  return (
    <ul class="codex-ranks" role="list" data-testid={`ranks-${abilityId}`}>
      {row.ranks.map((r) => (
        <li key={r.rank} class="u-xs" {...tipAttrs(`Rank ${tierRoman(r.rank)}: offered on skill levels; rank ${tierRoman(r.rank)} adds this to rank ${tierRoman(r.rank - 1)}.`)}>
          <span class="codex-ranks__n">{tierRoman(r.rank)}</span> {r.summary}
        </li>
      ))}
    </ul>
  );
}

const ARCHETYPE_ORDER = ['general', 'tank', 'melee', 'ranged', 'controller', 'healer'];

/** Perks of the given archetypes (the class's pool: general + its own), grouped by archetype and tier. */
export function PerkCatalog({ content, archetypes, testId }: { content: ContentDB; archetypes?: readonly string[]; testId?: string }) {
  const rules = content.perkRules;
  const shown = ARCHETYPE_ORDER.filter((a) => !archetypes || a === 'general' || archetypes.includes(a));
  const roleName = (id: string) => (id === 'general' ? 'General' : (content.vocabulary.roles.find((r) => r.id === id)?.name ?? id));
  return (
    <div class="codex-perks" data-testid={testId ?? 'perk-catalog'}>
      <p class="u-xs u-muted">
        Up to {rules.perkCap} perks, at most {rules.maxTier3} of tier III. Tier II needs a perk held; tier III two and one listed perk. Every 3rd level offers a skill: a perk or an ability rank.
      </p>
      {shown.map((a) => {
        const perks = content.perks.list.filter((p) => p.archetype === a).sort((x, y) => x.tier - y.tier || (x.name < y.name ? -1 : 1));
        if (perks.length === 0) return null;
        return (
          <section key={a} class="codex-perks__group" data-testid={`perks-${a}`}>
            <h3 class="panel-section__title">
              {a !== 'general' && <RoleGlyph role={a} label={roleName(a)} />} {roleName(a)}
            </h3>
            <ul class="codex-perks__list" role="list">
              {perks.map((p) => {
                const req = perkRequiresText(content, p.id);
                return (
                  <li key={p.id} class="codex-perk">
                    <PerkBadge content={content} perkId={p.id} />
                    <span class="u-sm">{playerText(p.text)}</span>
                    {req && <span class="u-xs u-faint">{req}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
