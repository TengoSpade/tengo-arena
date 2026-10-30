/**
 * One fighter's token, drawn by the viewer above any skin (tech-020) to the UI designer's specification
 * (docs/design/mockups/arena-notes.md §1; components.css §25.3). Every colour, alpha, size and duration comes from
 * the palette and `palette.metrics`; the only numbers here are the designer's proportions of the disc.
 *
 * Two containers per unit:
 * - `root` (depth-sorted with the other bodies), bottom to top: side ring with its plate keylines, facing wedge,
 *   the skin's body, the role-glyph plate and glyph(s), hit wash, selection brackets, the down diamond.
 * - `overlay` (above all bodies, so a body never hides it): crown chip, and above the disc, bottom to top, the focus
 *   bar, the HP bar with the hatched shield segment, the row of rule badge and status pips ("+n" for the rest), the
 *   cast bar, the Freshness tag and the name.
 *
 * Static geometry is drawn at layout time (zoom or palette changed); per frame only transforms, scales, alpha and
 * visibility change. The viewer translates `root` and never rotates or scales it (bodies pick their own direction
 * from `UnitRenderState.facing`); only its own wedge turns, and a downed fighter's plate and ring are flattened with
 * the body.
 */
import { Container, Graphics } from 'pixi.js';
import type { ArenaPalette, ArenaUnitInfo, PipKind, StatusCue, TeamColors, UnitRenderState } from '../../types';
import { DESTROY_ALL } from '../destroy';
import type { FlashLimiter } from '../flash-limiter';
import type { BodyFrame, BodyVisual } from '../skin';
import { buildGlyph } from './glyphs';
import { Chip, type ChipEnv } from './chip';
import type { TextFactory } from './text';

/** Downed bodies, plates and rings are flattened to this height (notes §1; opacity is `metrics.downOpacity`). */
export const DOWN_FLATTEN = 0.6;
const MAX_PIPS = 4;
const STACK_GAP = 2;
const ROW_GAP = 4;
/** zIndex added to the selected or hovered token so it sorts above the rest. */
const RAISE_Z = 1e6;
/** A stack keeps this far inside the host's edge (px): beyond it the stack moves below the disc, or sideways. */
const EDGE_MARGIN = 2;
/** The Freshness tag shows for the first 3 s of the round (20 ticks per second). */
const TAG_TICKS = 60;
/** A hit is fresh enough to flash while it is within this many ticks of the tick shown (so a seek never flashes). */
const FRESH_TICKS = 4;
/** Name chip: at most 11 em wide (arena-notes .alabel); characters at about 0.58 em each. */
const NAME_MAX_CHARS = 19;
/** The Freshness tag's name when the context carries no label from content (the shipped labels, O36). */
const FATIGUE_TAG_FALLBACK: Record<'ready' | 'tired' | 'spent', string> = { ready: 'Winded', tired: 'Tired', spent: 'Spent' };

export interface TokenEnv extends ChipEnv {
  palette: ArenaPalette;
  text: TextFactory;
  /** CSS px per metre: the disc is one metre across. */
  pxPerMetre: number;
  /** Bumped on every relayout so cached chip drawings refresh. */
  version: number;
}

/** What one frame tells a token beyond the unit's own state. */
export interface TokenFrame {
  x: number;
  y: number;
  tick: number;
  /** Screen angle of the facing wedge (radians). */
  facing: number;
  /** The side colour (the ring, the wedge and the down diamond). */
  ring: number;
  hardControl: boolean;
  /** 0..1 of the hit wash, already limited. */
  flash: number;
  selected: boolean;
  /** Under the pointer (raised like the selection; no other mark). */
  hovered: boolean;
  reducedMotion: boolean;
  labels: 'off' | 'selected' | 'all';
  /** Pips to draw, hard control first; `pipMore` statuses did not fit. */
  pips: readonly StatusCue[];
  pipCount: number;
  pipMore: number;
  /** Cast bar: progress 0..1 and the ability name, or progress -1 for none. */
  cast: number;
  castName: string;
  focusMax: number;
  /** The host's size (CSS px): a stack never leaves it. */
  viewW: number;
  viewH: number;
  body: BodyFrame;
}

/** One status pip: a plate chip outlined in the family colour with the family silhouette. */
class PipSlot {
  readonly view = new Container();
  private readonly bg = new Graphics();
  private glyph: Graphics | null = null;
  private kind: PipKind | null = null;
  private version = -1;

  constructor() {
    this.view.eventMode = 'none';
    this.view.addChild(this.bg);
    this.view.visible = false;
  }

  /** Show `kind` at the palette's size. */
  show(kind: PipKind, env: TokenEnv): void {
    this.view.visible = true;
    if (this.kind === kind && this.version === env.version) return;
    this.kind = kind;
    this.version = env.version;
    const p = env.palette;
    const s = p.metrics.pipSizePx;
    const color = p.pipColor[kind];
    // A 1.5 px outline in the family colour is what keeps the pip 3:1 against the floor.
    this.bg.clear().roundRect(0, 0, s, s, 3).fill({ color: p.plate }).roundRect(0.75, 0.75, s - 1.5, s - 1.5, 3).stroke({ width: 1.5, color });
    this.glyph?.destroy(DESTROY_ALL);
    this.glyph = buildGlyph(p.pipGlyphSvg[kind] ?? '', s * 0.66);
    this.glyph.tint = color;
    this.glyph.position.x += s / 2;
    this.glyph.position.y += s / 2;
    this.view.addChild(this.glyph);
  }

  hide(): void {
    this.view.visible = false;
  }
}

export class Token {
  readonly root = new Container();
  readonly overlay = new Container();
  // root
  private readonly ringGroup = new Container();
  private readonly ringG = new Graphics();
  private readonly wedge = new Graphics();
  private readonly plateGroup = new Container();
  private readonly plateG = new Graphics();
  private glyphs: Graphics[] = [];
  private readonly flashDisc = new Graphics();
  private readonly selection = new Graphics();
  private readonly downMark = new Graphics();
  // overlay
  private readonly stack = new Container();
  private readonly bars = new Container();
  private readonly track = new Graphics();
  private readonly hp = new Graphics();
  private readonly shield = new Graphics();
  private readonly focus = new Graphics();
  private readonly row = new Container();
  private readonly badge: Chip;
  private readonly pipSlots: PipSlot[] = [];
  private readonly more: Chip;
  private readonly cast: Chip;
  private readonly tag: Chip;
  private readonly name: Chip;
  private readonly crown = new Container();
  private readonly crownG = new Graphics();

  private env: TokenEnv;
  private colors: TeamColors;
  private drawnRing = -1;
  private drawnDown = -1;
  private drawnShieldPx = -1;
  private barW = 0;
  private bottomY = 0;
  /** The stack is drawn below the disc (above would leave the host). */
  private below = false;
  private badgeText = '';
  private tagText = '';
  private nameText = '';
  /** The Freshness tag and the (truncated) name never change within a round: built once. */
  private readonly tagLabel: string;
  private readonly nameLabel: string;
  private destroyed = false;
  /** The stack's reach above the disc centre (0 when it is below or hidden), half its width and its sideways nudge (px). */
  private stackAboveExtent = 0;
  private stackHalfW = 0;
  private isRaised = false;
  /** The last hit already considered for a flash, and the flash in progress (wall ms). */
  private lastHitSeen: number | null = null;
  private flashStartMs = Number.NEGATIVE_INFINITY;

  constructor(
    readonly info: ArenaUnitInfo,
    readonly body: BodyVisual,
    colors: TeamColors,
    env: TokenEnv,
  ) {
    this.env = env;
    this.colors = colors;
    this.tagLabel = info.fatigueTag !== null && info.freshness !== null ? `${info.fatigueLabel ?? FATIGUE_TAG_FALLBACK[info.fatigueTag]} (${Math.round(info.freshness)})` : '';
    this.nameLabel = info.name.length > NAME_MAX_CHARS ? `${info.name.slice(0, NAME_MAX_CHARS - 1)}…` : info.name;
    this.root.eventMode = 'none';
    this.overlay.eventMode = 'none';
    for (const c of [this.ringGroup, this.plateGroup, this.stack, this.bars, this.row, this.crown]) c.eventMode = 'none';
    for (const g of [this.ringG, this.wedge, this.plateG, this.flashDisc, this.selection, this.downMark, this.track, this.hp, this.shield, this.focus, this.crownG]) g.eventMode = 'none';

    this.ringGroup.addChild(this.ringG);
    this.plateGroup.addChild(this.plateG);
    this.root.addChild(this.ringGroup, this.wedge, body.view, this.plateGroup, this.flashDisc, this.selection, this.downMark);

    this.badge = new Chip(env.text, 'badge');
    this.more = new Chip(env.text, 'label');
    this.cast = new Chip(env.text, 'label');
    this.tag = new Chip(env.text, 'label');
    this.name = new Chip(env.text, 'label');
    for (let i = 0; i < MAX_PIPS; i++) this.pipSlots.push(new PipSlot());
    this.bars.addChild(this.track, this.focus, this.hp, this.shield);
    this.row.addChild(this.badge.view, ...this.pipSlots.map((s) => s.view), this.more.view);
    this.stack.addChild(this.bars, this.row, this.cast.view, this.tag.view, this.name.view);
    this.crown.addChild(this.crownG);
    this.overlay.addChild(this.stack, this.crown);
    for (const v of [this.badge.view, this.more.view, this.cast.view, this.tag.view, this.name.view, this.crown, this.flashDisc, this.selection, this.downMark, this.shield]) v.visible = false;
    this.layout(env, colors);
  }

  /** The disc's diameter: a metre of arena, or the body's own size when it draws a readable token (skin.ts BodyVisual.diameterPx). */
  private discPx(): number {
    return this.body.diameterPx ? this.body.diameterPx(this.env.pxPerMetre) : this.env.pxPerMetre;
  }

  /** Disc radius and ring geometry: shared by drawing and stacking. */
  private geometry(): { r: number; gap: number; ringW: number; line: number; double: boolean; outer: number } {
    const m = this.env.palette.metrics;
    const r = 0.5 * this.discPx();
    const double = this.colors.ringStyle === 'double';
    // solid: keyline, ring, 1 px keyline; double: keyline, line, gap, line, 1 px keyline (components.css §25.3)
    const outer = double ? r + m.ringGapPx * 2 + m.ringLinePx * 2 + 1 : r + m.ringGapPx + m.ringWidthPx + 1;
    return { r, gap: m.ringGapPx, ringW: m.ringWidthPx, line: m.ringLinePx, double, outer };
  }

  /** The palette, zoom or colours changed: redraw the static geometry. */
  layout(env: TokenEnv, colors: TeamColors): void {
    this.env = env;
    this.colors = colors;
    const p = env.palette;
    const m = p.metrics;
    const g = this.geometry();
    const diameter = this.discPx();
    this.drawnRing = -1;
    this.drawnDown = -1;
    this.drawnShieldPx = -1;

    // Hit wash on the body.
    this.flashDisc.clear().circle(0, 0, g.r).fill({ color: p.hitFlash });

    // Selection: four corner brackets in the selection colour, on a plate halo, around the ring.
    const half = g.r + (g.double ? g.gap * 2 + g.line * 2 : g.gap + g.ringW) + 7;
    const len = m.pipSizePx * 0.6;
    this.selection.clear();
    for (const [color, width] of [
      [p.plate, 4],
      [p.select, 2],
    ] as const) {
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          this.selection
            .moveTo(sx * half, sy * (half - len))
            .lineTo(sx * half, sy * half)
            .lineTo(sx * (half - len), sy * half)
            .stroke({ width, color, join: 'miter', cap: 'square' });
        }
      }
    }

    // Role-glyph plate: a fixed plate behind the glyph(s), so the role hue never depends on the club colours. A body that
    // draws the roles itself (the token body: role-coloured disc, OVR, glyphs or label) gets no second plate.
    if (this.body.drawsRole) this.plateG.clear();
    else this.drawPlate(diameter);

    // Bars: a track with an edge hairline around it; fills are unit rects scaled per frame.
    this.barW = Math.max(m.barWidthM * env.pxPerMetre, 3 * m.pipSizePx);
    const barH = m.barHeightPx;
    const focusH = barH * 0.6;
    this.track
      .clear()
      .rect(-1, 0, this.barW + 2, barH + 1 + focusH + 2)
      .fill({ color: p.edge })
      .rect(0, 1, this.barW, barH)
      .fill({ color: p.track })
      .rect(0, 1 + barH + 1, this.barW, focusH)
      .fill({ color: p.track });
    this.hp.clear().rect(0, 0, 1, barH).fill({ color: 0xffffff });
    this.hp.tint = p.hp;
    this.focus.clear().rect(0, 0, 1, focusH).fill({ color: 0xffffff });
    this.focus.tint = p.focus;
    this.hp.position.set(0, 1);
    this.focus.position.set(0, 1 + barH + 1);
    this.shield.position.set(0, 1);

    // Crown chip at the top right of the disc.
    const cw = Math.max(diameter * 0.42, m.pipSizePx * 0.85);
    this.crownG.clear().circle(0, 0, cw / 2).fill({ color: p.plate });
    const k = cw * 0.33;
    this.crownG.poly([-k, k * 0.6, -k * 1.05, -k * 0.7, -k * 0.4, -k * 0.15, 0, -k, k * 0.4, -k * 0.15, k * 1.05, -k * 0.7, k, k * 0.6]).fill({ color: p.ink });
    this.crown.position.set(diameter * 0.51, -diameter * 0.51);

    // The stack above the disc: its bottom edge sits a few px above the ring.
    this.bottomY = -(g.double ? g.r + g.gap * 2 + g.line * 2 + 5 : g.r + g.gap + g.ringW + 4);
    for (const slot of this.pipSlots) slot.hide();
    this.badgeText = '';
    this.tagText = '';
    this.nameText = '';
  }

  private drawPlate(diameter: number): void {
    const p = this.env.palette;
    for (const gl of this.glyphs) gl.destroy(DESTROY_ALL);
    this.glyphs = [];
    const roles = this.info.roles.slice(0, 2);
    // A plate about a third of the disc across; a hybrid's plate is wider so its two glyphs side by side fit. Radii and
    // glyph sizes are the designer's tokens, read from the palette's metrics.
    const hybrid = roles.length > 1;
    this.plateG.clear();
    if (roles.length > 0) this.plateG.circle(0, 0, diameter * (hybrid ? p.metrics.plateRadiusHybridM : p.metrics.plateRadiusM)).fill({ color: p.plate });
    const size = diameter * (hybrid ? p.metrics.glyphSizeHybridM : p.metrics.glyphSizeM);
    const gap = diameter * 0.03;
    const total = roles.length * size + (roles.length - 1) * gap;
    roles.forEach((role, i) => {
      const glyph = buildGlyph(p.roleGlyphSvg[role] ?? '', size, role);
      glyph.tint = p.roles[role];
      glyph.position.x += -total / 2 + i * (size + gap) + size / 2;
      this.plateGroup.addChild(glyph);
      this.glyphs.push(glyph);
    });
  }

  /** The ring with its keylines and the wedge, in the current side colour. */
  private drawRing(color: number): void {
    const p = this.env.palette;
    const g = this.geometry();
    const ring = this.ringG;
    ring.clear();
    // A plate keyline between body and ring, the ring (one line, or two), and a 1 px keyline outside.
    ring.circle(0, 0, g.r + g.gap / 2).stroke({ width: g.gap, color: p.plate });
    if (g.double) {
      ring.circle(0, 0, g.r + g.gap + g.line / 2).stroke({ width: g.line, color });
      ring.circle(0, 0, g.r + g.gap + g.line + g.gap / 2).stroke({ width: g.gap, color: p.plate });
      ring.circle(0, 0, g.r + g.gap * 2 + g.line + g.line / 2).stroke({ width: g.line, color });
    } else {
      ring.circle(0, 0, g.r + g.gap + g.ringW / 2).stroke({ width: g.ringW, color });
    }
    ring.circle(0, 0, g.outer - 0.5).stroke({ width: 1, color: p.plate });
    // Wedge: a small point on the ring in the facing direction (pointing east before it is rotated).
    const m = this.discPx();
    const w = m * 0.2;
    const h = m * 0.26;
    this.wedge
      .clear()
      .poly([g.outer, -h / 2, g.outer + w, 0, g.outer, h / 2])
      .fill({ color })
      .stroke({ width: 1, color: p.plate, join: 'round' });
  }

  private drawDown(color: number): void {
    const p = this.env.palette;
    const d = Math.max(this.discPx() * 0.5, p.metrics.pipSizePx * 0.9) / 2;
    this.downMark
      .clear()
      .poly([0, -d * 1.2, d * 1.2, 0, 0, d * 1.2, -d * 1.2, 0])
      .fill({ color })
      .stroke({ width: 2, color: p.plate, join: 'round' });
  }

  /** Apply one frame. Allocation-free except when a text or a chip changes. */
  update(u: UnitRenderState, f: TokenFrame): void {
    if (this.destroyed) return;
    const p = this.env.palette;
    const m = p.metrics;
    const dead = !u.standing;

    this.root.position.set(f.x, f.y);
    // Depth by screen y; the selected or hovered token (and its stack) is drawn above every other (owner, 2026-10-30:
    // bunched tokens overlap, the one being looked at must not be hidden).
    this.isRaised = f.selected || f.hovered;
    const raise = this.isRaised ? RAISE_Z : 0;
    this.root.zIndex = f.y + raise;
    this.overlay.position.set(f.x, f.y);
    this.overlay.zIndex = f.y + raise;
    this.body.update(u, f.body);

    // The side ring: ours solid, theirs double (the colour-free cue); hard control greys it and keeps the style.
    const ringColor = f.hardControl ? p.textMuted : f.ring;
    if (ringColor !== this.drawnRing) {
      this.drawnRing = ringColor;
      this.drawRing(ringColor);
    }
    if (f.ring !== this.drawnDown) {
      this.drawnDown = f.ring;
      this.drawDown(f.ring);
    }
    const flat = dead ? DOWN_FLATTEN : 1;
    const alpha = dead ? m.downOpacity : 1;
    this.ringGroup.scale.y = flat;
    this.ringGroup.alpha = alpha;
    this.plateGroup.scale.y = flat;
    this.plateGroup.alpha = alpha;
    this.wedge.visible = !dead;
    this.wedge.rotation = f.facing;
    this.selection.visible = f.selected;
    this.downMark.visible = dead;

    if (f.flash > 0.001 && !dead) {
      this.flashDisc.visible = true;
      this.flashDisc.alpha = f.flash * m.hitFlashAlpha;
    } else {
      this.flashDisc.visible = false;
    }

    // Everything above the disc is hidden for a downed fighter.
    this.overlay.visible = !dead;
    if (dead) {
      this.stackAboveExtent = 0;
      return;
    }
    this.crown.visible = u.isCaptain;

    const barH = m.barHeightPx;
    const focusH = barH * 0.6;
    const shield = u.shield !== null && u.shield > 0 ? u.shield : 0;
    const denom = Math.max(1, u.maxHp, u.hp + shield);
    const hpW = Math.max(0, Math.min(1, u.hp / denom)) * this.barW;
    this.hp.scale.x = u.hp > 0 ? Math.max(hpW, 1) : 0;
    this.shield.visible = shield > 0;
    if (shield > 0) {
      const sw = Math.max(2, Math.round((shield / denom) * this.barW));
      this.shield.position.x = hpW;
      if (sw !== this.drawnShieldPx) {
        this.drawnShieldPx = sw;
        this.drawShield(sw, barH);
      }
    }
    this.focus.visible = u.focus !== null;
    if (u.focus !== null) this.focus.scale.x = Math.max(0, Math.min(1, u.focus / Math.max(1, f.focusMax))) * this.barW;

    // ---- The stack above the disc (arena-notes §1). First each item's content and size, then where the stack goes:
    // above the disc, or below it when above would leave the host (the north wall), nudged sideways to stay inside.
    const rem = m.pipSizePx;
    const lineH = m.labelSizePx * 1.3;
    const blockH = barH + 1 + focusH + 2;

    // Row: the rule badge, up to four pips (hard control first), "+n" for the rest.
    const rule = u.rule;
    let x = 0;
    let badgeW = 0;
    this.badge.view.visible = rule !== null;
    if (rule) {
      this.badgeText = rule.label;
      badgeW = this.badge.set(rule.label, this.env, rem * 1.45, rem * 0.28, rem);
      x = badgeW;
    }
    let shownPips = 0;
    for (let i = 0; i < MAX_PIPS; i++) {
      const slot = this.pipSlots[i]!;
      const kind = i < f.pipCount ? f.pips[i]!.pip : null;
      if (kind === null || kind === undefined) {
        slot.hide();
        continue;
      }
      slot.show(kind, this.env);
      x += x > 0 ? (shownPips === 0 ? ROW_GAP : STACK_GAP) : 0;
      slot.view.position.set(x, 0);
      x += rem;
      shownPips++;
    }
    this.more.view.visible = f.pipMore > 0;
    if (f.pipMore > 0) {
      x += x > 0 ? (shownPips === 0 ? ROW_GAP : STACK_GAP) : 0;
      const w = this.more.set(`+${f.pipMore}`, this.env, 0, rem * 0.25, rem);
      this.more.view.position.set(x, 0);
      x += w;
    }
    const rowW = Math.max(0, x);
    const rowH = rowW > 0 ? rem : 0;
    this.row.position.x = -rowW / 2;
    if (rule) {
      // The badge pulses on a new decision (state.pulse is 0 under reduced motion).
      this.badge.view.pivot.set(badgeW / 2, rem / 2);
      this.badge.view.position.set(badgeW / 2, rem / 2);
      this.badge.view.scale.set(f.reducedMotion ? 1 : 1 + 0.35 * rule.pulse);
    }

    // Cast bar: the ability name over its progress. (The one place a cast's name is written: no second label.)
    const casting = f.cast >= 0;
    this.cast.view.visible = casting;
    const castW = casting ? this.cast.set(f.castName, this.env, this.barW, rem * 0.35, lineH, f.cast) : 0;
    const castH = casting ? lineH : 0;

    // Freshness tag (first 3 s), then the name.
    const tagText = f.tick < TAG_TICKS ? this.tagLabel : '';
    this.tag.view.visible = tagText !== '';
    this.tagText = tagText;
    const tagW = tagText !== '' ? this.tag.set(tagText, this.env, 0, rem * 0.35, lineH) : 0;
    const tagH = tagText !== '' ? lineH : 0;
    const showName = f.labels === 'all' || (f.labels === 'selected' && f.selected);
    this.name.view.visible = showName;
    this.nameText = showName ? this.nameLabel : '';
    const nameH = showName ? m.labelSizePx * 1.35 : 0;
    const nameW = showName ? this.name.set(this.nameLabel, this.env, 0, rem * 0.4, nameH) : 0;

    // Where: the stack's height decides. Above the disc unless that leaves the host and below fits.
    let total = blockH;
    if (rowH > 0) total += STACK_GAP + rowH;
    if (castH > 0) total += STACK_GAP + castH;
    if (tagH > 0) total += STACK_GAP + tagH;
    if (nameH > 0) total += STACK_GAP + nameH;
    // `base` is from the disc centre to the stack's near edge; below the disc it also clears what the body prints under
    // itself (the token body's class name).
    const baseAbove = -this.bottomY;
    const baseBelow = baseAbove + (this.body.extentBelowPx?.(this.env.pxPerMetre) ?? 0);
    const fitsAbove = f.y - baseAbove - total >= EDGE_MARGIN;
    const below = !fitsAbove && f.viewH - (f.y + baseBelow + total) >= EDGE_MARGIN;
    this.below = below;
    const base = below ? baseBelow : baseAbove;
    const halfW = Math.max(this.barW, rowW, castW, tagW, nameW) / 2;
    let dx = 0;
    if (f.x - halfW < EDGE_MARGIN) dx = EDGE_MARGIN - (f.x - halfW);
    else if (f.x + halfW > f.viewW - EDGE_MARGIN) dx = f.viewW - EDGE_MARGIN - (f.x + halfW);
    this.stack.x = dx;
    this.stackAboveExtent = below ? 0 : base + total;
    this.stackHalfW = halfW;

    // Outward from the disc: the bars first (focus nearest the disc), then row, cast bar, tag, name. Below the disc the
    // same order runs downwards, and the bars block is mirrored so the focus bar is still the nearest.
    let o = 0;
    this.bars.scale.y = below ? -1 : 1;
    this.bars.position.set(-this.barW / 2, below ? base + blockH : -(base + blockH));
    o += blockH + STACK_GAP;
    if (rowH > 0) {
      this.row.position.y = below ? base + o : -(base + o) - rowH;
      o += rowH + STACK_GAP;
    }
    if (castH > 0) {
      this.cast.view.position.set(-castW / 2, below ? base + o : -(base + o) - castH);
      o += castH + STACK_GAP;
    }
    if (tagH > 0) {
      this.tag.view.position.set(-tagW / 2, below ? base + o : -(base + o) - tagH);
      o += tagH + STACK_GAP;
    }
    if (nameH > 0) this.name.view.position.set(-nameW / 2, below ? base + o : -(base + o) - nameH);
  }

  /** The shield segment: hatched, with 1 px lines along its top and bottom (components.css .abar__shield). */
  private drawShield(w: number, h: number): void {
    const color = this.env.palette.shield;
    const g = this.shield;
    g.clear();
    g.rect(0, 0, w, 1).fill({ color }).rect(0, h - 1, w, 1).fill({ color });
    const pitch = 5.7;
    for (let a = -h; a < w; a += pitch) {
      const xs = Math.max(a, 0);
      const xe = Math.min(a + h, w);
      if (xe <= xs) continue;
      g.moveTo(xs, h - (xs - a)).lineTo(xe, h - (xe - a));
    }
    g.stroke({ width: 1.4, color });
  }

  /**
   * The hit wash level for this frame (0..1). A hit flashes when it is fresh and playing is continuous, for
   * `metrics.hitFlashMs` of wall time, if the limiter admits it; seeking, pausing and reduced motion never flash.
   */
  flashLevel(u: UnitRenderState, tick: number, playing: boolean, reducedMotion: boolean, limiter: FlashLimiter, nowMs: number): number {
    const flashMs = this.env.palette.metrics.hitFlashMs;
    const hit = u.lastHitTick;
    if (hit !== this.lastHitSeen) {
      this.lastHitSeen = hit;
      const fresh = hit !== null && playing && !reducedMotion && flashMs > 0 && tick >= hit && tick - hit <= FRESH_TICKS;
      // A hit the limiter refuses shows no wash at all (its number and impact still read), and never cuts short one in progress.
      if (fresh && limiter.admit(u.unit, nowMs)) this.flashStartMs = nowMs;
      else if (!fresh) this.flashStartMs = Number.NEGATIVE_INFINITY;
    }
    if (!playing || reducedMotion || flashMs <= 0) return 0;
    const age = nowMs - this.flashStartMs;
    if (age < 0 || age >= flashMs) return 0;
    return 1 - age / flashMs;
  }

  /** What the token is showing right now (tests and the dev harness). */
  shown(): {
    bars: boolean;
    hpPx: number;
    shield: boolean;
    focus: boolean;
    cast: boolean;
    pips: number;
    more: string | null;
    badge: string | null;
    badgeScale: number;
    crown: boolean;
    downMark: boolean;
    selected: boolean;
    ringAlpha: number;
    flat: number;
    wedge: number;
    flash: number;
    tag: string;
    name: string | null;
    hpTint: number;
    focusTint: number;
    barsHeight: number;
    /** The stack is drawn below the disc, and how far it was nudged sideways to stay in the host. */
    stackBelow: boolean;
    stackDx: number;
    /** Plate width of the first role glyph (px), to check the hybrid size. */
    glyphSize: number;
    /** Radius of the role plate (px). */
    plateRadius: number;
    /** Top y of each stack item (screen up is negative), for the order check. */
    stackY: { bars: number; row: number; cast: number; tag: number; name: number };
  } {
    const up = this.overlay.visible;
    return {
      bars: up,
      hpPx: this.hp.scale.x,
      shield: up && this.shield.visible,
      focus: up && this.focus.visible,
      cast: up && this.cast.view.visible,
      pips: up ? this.pipSlots.filter((s) => s.view.visible).length : 0,
      more: up && this.more.view.visible ? this.more.content : null,
      badge: up && this.badge.view.visible ? this.badgeText : null,
      badgeScale: this.badge.view.scale.x,
      crown: this.overlay.visible && this.crown.visible,
      downMark: this.downMark.visible,
      selected: this.selection.visible,
      ringAlpha: this.ringGroup.alpha,
      flat: this.ringGroup.scale.y,
      wedge: this.wedge.rotation,
      flash: this.flashDisc.visible ? this.flashDisc.alpha : 0,
      tag: up && this.tag.view.visible ? this.tagText : '',
      name: up && this.name.view.visible ? this.nameText : null,
      hpTint: this.hp.tint as number,
      focusTint: this.focus.tint as number,
      barsHeight: this.track.height,
      stackBelow: this.below,
      stackDx: this.stack.x,
      glyphSize: this.glyphs[0] ? this.glyphs[0].width : 0,
      plateRadius: this.plateG.width / 2,
      stackY: { bars: this.bars.y, row: this.row.y, cast: this.cast.view.y, tag: this.tag.view.y, name: this.name.view.y },
    };
  }

  // ---- What the scene needs to keep a body's label below the token clear of other tokens' stacks ----
  get standing(): boolean {
    return this.overlay.visible;
  }
  get raised(): boolean {
    return this.isRaised;
  }
  get stackAbove(): number {
    return this.stackAboveExtent;
  }
  get stackHalfWidth(): number {
    return this.stackHalfW;
  }
  get stackShift(): number {
    return this.stack.x;
  }
  get hasLabelBelow(): boolean {
    return this.body.setLabelBelowVisible !== undefined;
  }
  /** From the disc centre to the bottom of the body's label below it. */
  get belowReach(): number {
    return this.discPx() / 2 + (this.body.extentBelowPx?.(this.env.pxPerMetre) ?? 0);
  }
  get belowHalfWidth(): number {
    return (this.body.labelBelowWidthPx?.() ?? 0) / 2;
  }
  setLabelBelowVisible(on: boolean): void {
    this.body.setLabelBelowVisible?.(on);
  }

  /** Where the root is (for tests and hit-testing diagnostics). */
  get screenX(): number {
    return this.root.position.x;
  }
  get screenY(): number {
    return this.root.position.y;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const chip of [this.badge, this.more, this.cast, this.tag, this.name]) chip.dispose();
    this.body.destroy();
    this.root.destroy(DESTROY_ALL);
    this.overlay.destroy(DESTROY_ALL);
  }
}
