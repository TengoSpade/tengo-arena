/**
 * The M2 placeholder skin (T1: "placeholder sprites or simple shapes first"; WP-M2D).
 *
 * Bodies are flat shapes generated at load, no image files: a filled circle of the fighter radius (0.5 m) in
 * the side's primary with a secondary rim, flattened and at 40% opacity when downed (asset-006). The floor is a
 * flat mid-value plane with a centre line and walls (04 §5). Everything with game meaning (ring, role glyphs,
 * bars, pips, badges, cues) is drawn by the viewer, not here.
 *
 * Interface notes (tech-020): the viewer translates and depth-sorts `body.view` and never rotates it; a disc has
 * no facing, so this skin ignores `state.facing` (the viewer's own wedge shows it). There are no textures, so
 * `prepare` has nothing to load and `destroy` has nothing to release beyond the Graphics objects.
 */
import { Container, Graphics } from 'pixi.js';
import type { ArenaPalette, ArenaUnitInfo, TeamColors, UnitRenderState } from '../../types';
import { DESTROY_ALL } from '../../viewer/destroy';
import { mixColor } from '../../viewer/palette';
import type { ArenaSkin, BodyFrame, BodyVisual, SkinContext } from '../../viewer/skin';

/** Fighter radius, metres (03 §1). */
const BODY_RADIUS_M = 0.5;
/** Downed bodies (asset-006): flattened to this fraction of their height, at this opacity. */
const DOWNED_FLATTEN = 0.45;
const DOWNED_ALPHA = 0.4;
/** How long the flatten takes at 1x while playing; paused or seeking snaps. */
const FLATTEN_MS = 160;
const WALL_THICKNESS_M = 0.3;

class DiscBody implements BodyVisual {
  readonly view = new Container();
  private readonly disc = new Graphics();
  private drawnRadius = -1;
  /** 0 = standing, 1 = fully downed. */
  private flat = 0;
  private destroyed = false;

  constructor(private readonly colors: TeamColors) {
    this.view.addChild(this.disc);
    this.view.eventMode = 'none';
  }

  update(state: UnitRenderState, frame: BodyFrame): void {
    if (this.destroyed) return;
    const radius = BODY_RADIUS_M * frame.pxPerMetre;
    if (radius !== this.drawnRadius) this.draw(radius);
    const target = state.standing ? 0 : 1;
    if (frame.reducedMotion || frame.dtMs <= 0) {
      this.flat = target;
    } else {
      const step = frame.dtMs / FLATTEN_MS;
      this.flat = target > this.flat ? Math.min(target, this.flat + step) : Math.max(target, this.flat - step);
    }
    this.disc.scale.y = 1 - (1 - DOWNED_FLATTEN) * this.flat;
    this.view.alpha = 1 - (1 - DOWNED_ALPHA) * this.flat;
  }

  private draw(radius: number): void {
    this.drawnRadius = radius;
    const rim = Math.max(2, radius * 0.16);
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
    return new DiscBody(colors);
  }

  createFloor(arenaCm: { width: number; height: number }, pxPerMetre: number): Container {
    const palette = this.palette;
    const w = (arenaCm.width / 100) * pxPerMetre;
    const h = (arenaCm.height / 100) * pxPerMetre;
    const wall = Math.max(4, WALL_THICKNESS_M * pxPerMetre);
    const floor = palette?.floor ?? 0x4a463c;
    const wallColor = palette?.wall ?? 0x8a8272;
    const dark = palette ? palette.theme === 'dark' : true;
    const edge = mixColor(wallColor, dark ? 0x000000 : 0xffffff, 0.45);
    const line = mixColor(floor, palette?.text ?? 0xebe6da, 0.2);

    const root = new Container();
    root.eventMode = 'none';
    const g = new Graphics();
    // Walls read as the boundary: a slab around the field with a darker inner edge.
    g.rect(-wall, -wall, w + wall * 2, h + wall * 2).fill({ color: wallColor });
    g.rect(0, 0, w, h).fill({ color: floor });
    g.rect(0, 0, w, h).stroke({ width: 2, color: edge, alignment: 1 });
    // Centre line: the only marking (no decoration that could be mistaken for gameplay, open-019).
    g.moveTo(w / 2, 0).lineTo(w / 2, h).stroke({ width: 2, color: line, alpha: 0.9 });
    root.addChild(g);
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
