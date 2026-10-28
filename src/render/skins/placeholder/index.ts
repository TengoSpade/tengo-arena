/**
 * The M2 placeholder skin (T1: "placeholder sprites or simple shapes first"; WP-M2D).
 *
 * Bodies are flat shapes generated at load, no image files: a filled circle of the fighter radius (0.5 m) in the
 * side's club primary with a secondary rim (the exact club colours: the body carries identity only, A18 decision 4),
 * flattened to 60% height at the palette's down opacity when downed (asset-006, arena-notes §1). The floor is a flat
 * plane with a centre line and a wall band outside the field (04 §5; components.css §25.2). Everything with game
 * meaning (ring, plate and role glyphs, bars, pips, badges, cues) is drawn by the viewer, not here.
 *
 * Interface notes (tech-020): the viewer translates and depth-sorts `body.view` and never rotates it; a disc has no
 * facing, so this skin ignores `state.facing` (the viewer's own wedge shows it). There are no textures, so `prepare`
 * has nothing to load and `destroy` has nothing to release beyond the Graphics objects. Colours and the down opacity
 * come from the palette it was given (`load`, `setPalette`).
 */
import { Container, Graphics } from 'pixi.js';
import type { ArenaMetrics, ArenaPalette, ArenaUnitInfo, TeamColors, UnitRenderState } from '../../types';
import { DESTROY_ALL } from '../../viewer/destroy';
import type { ArenaSkin, BodyFrame, BodyVisual, SkinContext } from '../../viewer/skin';

/** Fighter radius, metres (03 §1). */
const BODY_RADIUS_M = 0.5;
/** A downed body is flattened to this fraction of its height (arena-notes §1: 60%). */
const DOWNED_FLATTEN = 0.6;
/** The body rim (secondary colour) is this fraction of the disc diameter wide (components.css: inset m * 0.07). */
const RIM_OF_DIAMETER = 0.07;
/** How long the flatten takes at 1x while playing; paused or seeking snaps. */
const FLATTEN_MS = 160;
/** The wall band outside the field, metres (components.css .arena-wall: 0.35 m). */
const WALL_THICKNESS_M = 0.35;
/** Used before any palette arrives. */
const FALLBACK_DOWN_OPACITY = 0.4;

class DiscBody implements BodyVisual {
  readonly view = new Container();
  private readonly disc = new Graphics();
  private drawnRadius = -1;
  /** 0 = standing, 1 = fully downed. */
  private flat = 0;
  private destroyed = false;

  constructor(
    private readonly colors: TeamColors,
    private readonly metrics: () => ArenaMetrics | null,
  ) {
    this.view.addChild(this.disc);
    this.view.eventMode = 'none';
  }

  update(state: UnitRenderState, frame: BodyFrame): void {
    if (this.destroyed) return;
    const radius = BODY_RADIUS_M * frame.pxPerMetre;
    if (radius !== this.drawnRadius) this.draw(radius, frame.pxPerMetre);
    const target = state.standing ? 0 : 1;
    if (frame.reducedMotion || frame.dtMs <= 0) {
      this.flat = target;
    } else {
      const step = frame.dtMs / FLATTEN_MS;
      this.flat = target > this.flat ? Math.min(target, this.flat + step) : Math.max(target, this.flat - step);
    }
    const downOpacity = this.metrics()?.downOpacity ?? FALLBACK_DOWN_OPACITY;
    this.disc.scale.y = 1 - (1 - DOWNED_FLATTEN) * this.flat;
    this.view.alpha = 1 - (1 - downOpacity) * this.flat;
  }

  private draw(radius: number, diameter: number): void {
    this.drawnRadius = radius;
    const rim = Math.max(1.5, diameter * RIM_OF_DIAMETER);
    this.disc.clear();
    this.disc.circle(0, 0, radius).fill({ color: this.colors.primary });
    this.disc.circle(0, 0, radius - rim / 2).stroke({ width: rim, color: this.colors.secondary });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.view.destroy(DESTROY_ALL);
  }
}

class PlaceholderSkin implements ArenaSkin {
  readonly id = 'placeholder';
  private palette: ArenaPalette | null = null;
  private readonly floors = new Set<Container>();

  load(ctx: SkinContext): Promise<void> {
    this.palette = ctx.palette;
    return Promise.resolve();
  }

  /** Generated shapes only: nothing to fetch, nothing to release between rounds. */
  prepare(_units: readonly ArenaUnitInfo[]): Promise<void> {
    return Promise.resolve();
  }

  createBody(_info: ArenaUnitInfo, colors: TeamColors): BodyVisual {
    return new DiscBody(colors, () => this.palette?.metrics ?? null);
  }

  createFloor(arenaCm: { width: number; height: number }, pxPerMetre: number): Container {
    const p = this.palette;
    const w = (arenaCm.width / 100) * pxPerMetre;
    const h = (arenaCm.height / 100) * pxPerMetre;
    const wall = WALL_THICKNESS_M * pxPerMetre;
    const root = new Container();
    root.eventMode = 'none';
    if (p) {
      const g = new Graphics();
      // The wall band outside the field, with a thin plate keyline on its inner edge.
      g.rect(-wall, -wall, w + wall * 2, h + wall * 2).fill({ color: p.wall });
      g.rect(0, 0, w, h).fill({ color: p.floor });
      g.rect(0, 0, w, h).stroke({ width: 1, color: p.plate, alignment: 1 });
      // Centre line: the only marking here (the viewer draws the row markers).
      g.moveTo(w / 2, 0).lineTo(w / 2, h).stroke({ width: 2, color: p.line });
      root.addChild(g);
    }
    this.floors.add(root);
    root.on('destroyed', () => this.floors.delete(root));
    return root;
  }

  setPalette(palette: ArenaPalette): void {
    this.palette = palette;
  }

  destroy(): void {
    for (const floor of this.floors) if (!floor.destroyed) floor.destroy(DESTROY_ALL);
    this.floors.clear();
    this.palette = null;
  }
}

/** The M2 placeholder skin: generated shapes, no assets (Q59). */
export function placeholderSkin(): ArenaSkin {
  return new PlaceholderSkin();
}
