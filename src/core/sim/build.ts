/**
 * Fight-input builders for the balance harness and tests: plain fighters with
 * uniform attributes (03-combat §8 reference situation: all attributes 10,
 * CQ 50, default presets, human, no traits) and overrides.
 */
import { combatRating, type ContentDB } from '../content';
import { asId, type ClassId, type ClubId, type FighterId, type FightFighterInput, type RaceId, type SideInput, type StatId, type TacticsPresetId, type TraitId } from '../model';
import { ATTR_IDS } from './tables';

export interface FighterSpec {
  classId: string;
  fighterId?: string;
  /** Every attribute (default 10). */
  baseStat?: number;
  /** Per-attribute overrides. */
  stats?: Partial<Record<(typeof ATTR_IDS)[number], number>>;
  presetId?: string;
  row?: 'front' | 'back';
  captainQuality?: number;
  traitIds?: string[];
  raceId?: string;
  rating?: number;
}

export function fighterInput(content: ContentDB, spec: FighterSpec, slot: number, idPrefix = 'f'): FightFighterInput {
  const k = content.classes.require(spec.classId);
  const base = spec.baseStat ?? 10;
  const stats = Object.fromEntries(ATTR_IDS.map((id) => [id, spec.stats?.[id] ?? base])) as Record<StatId, number>;
  return {
    fighterId: asId<FighterId>(spec.fighterId ?? `${idPrefix}-${slot}`),
    classId: asId<ClassId>(k.id),
    raceId: asId<RaceId>(spec.raceId ?? content.races.list[0]?.id ?? 'human'),
    row: spec.row ?? k.startingRow,
    slot,
    stats,
    captainQuality: spec.captainQuality ?? content.combat.captain.defaultCq,
    traitIds: (spec.traitIds ?? []).map((t) => asId<TraitId>(t)),
    tactics: { kind: 'preset', presetId: asId<TacticsPresetId>(spec.presetId ?? k.defaultPresetId) },
    // Same formula as fighter ratings (D-Q): the OVR of these stats unless a test pins one.
    rating: spec.rating ?? combatRating(content, k.id, stats),
  };
}

export function sideInput(
  content: ContentDB,
  clubId: string,
  specs: readonly (FighterSpec | string)[],
  captainIndex = 0,
  viceCaptainIndex: number | null = null,
): SideInput {
  return {
    clubId: asId<ClubId>(clubId),
    fighters: specs.map((s, i) => fighterInput(content, typeof s === 'string' ? { classId: s } : s, i, clubId)),
    captainIndex,
    viceCaptainIndex,
    chemistry: 0,
  };
}
