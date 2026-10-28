/**
 * The skin interface (05-technical-m2 §A5, tech-020): how fighters' BODIES and the floor look. The viewer owns
 * everything that carries game meaning and draws it above any skin: the side ring, the role glyph(s), the
 * facing wedge, HP / shield / focus bars, status pips, the captain crown, the rule badge, telegraphs and cues
 * (art research §2: "sprites add to the token and never replace it"). So a skin can never hide a cue that
 * vis-003 depends on, and swapping placeholder shapes for sprites touches only a skin.
 *
 * A sprite skin (open-032) implements this with atlases: a base layer plus two greyscale team-mask layers
 * tinted with TeamColors.primary and .secondary (research §6), animation picked from UnitRenderState.action
 * and the facing quantised to the directions the owner chooses (art §12 Q4).
 */
import type { Container, Renderer } from 'pixi.js';
import type { ContentDB } from '../../core/content';
import type { ArenaPalette, ArenaUnitInfo, TeamColors, UnitRenderState } from '../types';

export interface SkinContext {
  renderer: Renderer;
  content: ContentDB;
  palette: ArenaPalette;
}

/** Per-frame facts a body may animate with. */
export interface BodyFrame {
  /** Sampled tick (fractional). */
  tick: number;
  /** Wall-clock ms since the last frame (0 while paused). */
  dtMs: number;
  speed: 1 | 2 | 4;
  reducedMotion: boolean;
  /** CSS px per metre at the current zoom. */
  pxPerMetre: number;
}

export interface BodyVisual {
  /** Positioned by the viewer at the unit's screen point; the body draws around (0, 0), facing +x. */
  readonly view: Container;
  update(state: UnitRenderState, frame: BodyFrame): void;
  destroy(): void;
}

export interface ArenaSkin {
  readonly id: string;
  /** Load or generate textures once per viewer (placeholder: generated; sprites: atlases from the bundle, no network). */
  load(ctx: SkinContext): Promise<void>;
  createBody(info: ArenaUnitInfo, colors: TeamColors): BodyVisual;
  /** Floor, centre line and walls (04 §5 environment direction); row markers are the viewer's (kickoff only). */
  createFloor(arenaCm: { width: number; height: number }, pxPerMetre: number): Container;
  /** The palette changed (theme switch). */
  setPalette(palette: ArenaPalette): void;
  destroy(): void;
}
