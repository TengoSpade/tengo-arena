/**
 * Stand-ins for the modules WP5 integrates (sim, tactics, fighters, league,
 * economy): small deterministic implementations of their contracts so the
 * season engine, AI and soak can be exercised end to end without them
 * (05 §9.2: "stubs first"). Used by WP5 tests and `npm run soak -- --stand-ins`.
 * They are NOT game rules and are never wired into the shipped game.
 */
import { createAi } from '../../ai';
import type { RuleList } from '../../tactics';
import { asId, type ClassId } from '../../model';
import { engineError, err, ok } from '../../util';
import { aiPortsOf, type GamePorts } from '../ports';
import { makeStandInEconomy } from './economy';
import { standInFighters } from './fighters';
import { standInLeague } from './league';
import { standInSim } from './sim';

export { STAND_IN_ENGINE_VERSION } from './sim';

export function createStandInPorts(overrides: Partial<GamePorts> = {}): GamePorts {
  const fighters = overrides.fighters ?? standInFighters();
  const partial: Omit<GamePorts, 'ai'> = {
    sim: overrides.sim ?? standInSim(),
    tactics: overrides.tactics ?? {
      resolveTactics: (assignment, classId: ClassId, content) => {
        if (assignment.kind !== 'preset') return err(engineError('tactics.custom-unavailable', 'custom rule lists arrive in M3'));
        const preset = content.presets.get(assignment.presetId);
        const klass = content.classes.get(classId);
        if (!preset || !klass || !klass.presetIds.includes(preset.id)) {
          return err(engineError('tactics.preset-class', `Preset "${assignment.presetId}" is not a preset of class "${classId}"`));
        }
        const list: RuleList = { presetId: asId(preset.id), stance: preset.stance, rules: preset.rules };
        return ok(list);
      },
    },
    fighters,
    league: overrides.league ?? standInLeague(),
    economy: overrides.economy ?? makeStandInEconomy(fighters),
  };
  const ai = overrides.ai ?? createAi(aiPortsOf({ ...partial, ai: undefined as never }));
  return { ...partial, ai };
}
