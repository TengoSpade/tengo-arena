/**
 * The M2 placeholder skin (T1: "placeholder sprites or simple shapes first"; WP-M2D).
 *
 * Bodies are the owner's fighter token (2026-10-30; token-body.ts): a disc in the fighter's role colour (split
 * diagonally for a hybrid) with OVR and the role mark inside, a Freshness ring around it, the class name under it and a
 * thin club-colour rim, generated at load with no image files; flattened to 60% height at the palette's down opacity
 * when downed (asset-006, arena-notes §1). The viewer's side ring, bars and pips go around it. The floor is a flat
 * plane with a centre line and a wall band outside the field (04 §5; components.css §25.2). Everything with game
 * meaning (ring, plate and role glyphs, bars, pips, badges, cues) is drawn by the viewer, not here.
 *
 * Interface notes (tech-020): the viewer translates and depth-sorts `body.view` and never rotates it; a disc has no
 * facing, so this skin ignores `state.facing` (the viewer's own wedge shows it). There are no textures, so `prepare`
 * has nothing to load; the token text uses bitmap fonts baked once per palette (token-text.ts) and released in
 * `destroy`. Colours and the down opacity come from the palette it was given (`load`, `setPalette`).
 */
import { Container, Graphics } from 'pixi.js';
import type { ContentDB } from '../../../core/content';
import type { ArenaPalette, ArenaUnitInfo, TeamColors } from '../../types';
import { DESTROY_ALL } from '../../viewer/destroy';
import type { ArenaSkin, BodyVisual, SkinContext } from '../../viewer/skin';
import { TokenBody } from './token-body';
import { createPixiTokenText, type TokenTextFactory } from './token-text';

export { MIN_TOKEN_DIAMETER_PX, TOKEN_DIAMETER_M, OVR_CAPTION_MIN_DIAMETER_PX, freshnessTier, shortRoleLabel, tierColor, tokenDiameterPx, TokenBody } from './token-body';
export { createStubTokenText } from './token-text';

/** The wall band outside the field, metres (components.css .arena-wall: 0.35 m). */
const WALL_THICKNESS_M = 0.35;

export interface PlaceholderSkinOptions {
  /** The token's text seam (default: PixiJS bitmap fonts when the viewer has a renderer; tests pass a stub). */
  text?: TokenTextFactory;
}

class PlaceholderSkin implements ArenaSkin {
  readonly id = 'placeholder';
  private palette: ArenaPalette | null = null;
  private content: ContentDB | null = null;
  private text: TokenTextFactory | null;
  private readonly bodies = new Set<TokenBody>();
  private readonly floors = new Set<Container>();

  constructor(private readonly opts: PlaceholderSkinOptions) {
    this.text = opts.text ?? null;
  }

  load(ctx: SkinContext): Promise<void> {
    this.palette = ctx.palette;
    this.content = ctx.content;
    if (!this.text && ctx.renderer) {
      try {
        const factory = createPixiTokenText(ctx.renderer.resolution || 1, ctx.palette);
        factory.create('small').destroy(); // probe: installing a bitmap font needs a canvas 2D
        this.text = factory;
      } catch {
        this.text = null; // no canvas 2D: tokens without text rather than none
      }
    }
    this.text?.configure(ctx.palette);
    return Promise.resolve();
  }

  /** Generated shapes only: nothing to fetch, nothing to release between rounds. */
  prepare(_units: readonly ArenaUnitInfo[]): Promise<void> {
    return Promise.resolve();
  }

  createBody(info: ArenaUnitInfo, colors: TeamColors): BodyVisual {
    const body = new TokenBody(info, colors, { palette: () => this.palette, content: () => this.content, text: () => this.text });
    this.bodies.add(body);
    body.view.on('destroyed', () => this.bodies.delete(body));
    return body;
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
    this.text?.configure(palette);
    for (const body of this.bodies) body.restyle();
  }

  destroy(): void {
    for (const floor of this.floors) if (!floor.destroyed) floor.destroy(DESTROY_ALL);
    this.floors.clear();
    for (const body of [...this.bodies]) body.destroy();
    this.bodies.clear();
    if (!this.opts.text) this.text?.destroy();
    this.text = null;
    this.palette = null;
    this.content = null;
  }
}

/** The M2 placeholder skin: generated shapes, no assets (Q59). */
export function placeholderSkin(opts: PlaceholderSkinOptions = {}): ArenaSkin {
  return new PlaceholderSkin(opts);
}
