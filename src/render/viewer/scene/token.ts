/**
 * One fighter's token: the skin's body plus everything with game meaning, drawn by the viewer above any skin
 * (tech-020; asset-006). Two containers per unit:
 *
 * - `root` (depth-sorted with the other bodies): body, side ring (solid or double), facing wedge, role plate and
 *   glyph(s), selection ring, hit flash, down marker.
 * - `overlay` (above all bodies, never hidden by one): HP, shield and focus bars, cast bar, status pips, rule
 *   badge, captain crown, name label and the Freshness tag.
 *
 * Static geometry is drawn at layout time (pxPerMetre or palette changed); per frame only transforms, tints,
 * alpha and visibility change, so a frame allocates nothing here. The viewer translates `root` and never
 * rotates or scales it (bodies pick their own direction from `UnitRenderState.facing`); only the wedge, a mark
 * of ours, rotates.
 */
import { Container, Graphics } from 'pixi.js';
import type { ArenaPalette, ArenaUnitInfo, RoleId, StatusCue, TeamColors, UnitRenderState } from '../../types';
import type { BodyFrame, BodyVisual } from '../skin';
import { DESTROY_ALL } from '../destroy';
import type { FlashLimiter } from '../flash-limiter';
import { mixColor, type Chrome } from '../palette';
import type { TextFactory, TextLabel } from './text';

/** Overlay layout in "1080p px" (the overlay container scales with the zoom and the interface scale). */
const BASE_RADIUS = 26;
const BAR_W = 46;
const HP_H = 5;
const FOCUS_H = 2.5;
const CAST_H = 3;
const PIP = 11;
const MAX_PIPS = 4;
const BADGE_W = 22;
const BADGE_H = 14;

const HP_TOP = -(BASE_RADIUS + 15);
const FOCUS_TOP = -(BASE_RADIUS + 8.5);
const CAST_TOP = -(BASE_RADIUS + 23);
const PIPS_CY = -(BASE_RADIUS + 34);
const NAME_BOTTOM = -(BASE_RADIUS + 42);
const TAG_BOTTOM = -(BASE_RADIUS + 56);
const ROW_CY = HP_TOP + HP_H / 2;

/** A hit flash lasts this many ticks (200 ms of fight time). */
const FLASH_TICKS = 4;
/** A flash the limiter refused is drawn at this fraction of its intensity. */
const REFUSED_FLASH = 0.25;
/** The Freshness tag shows for the first 3 s of the round (20 ticks per second). */
const TAG_TICKS = 60;

export interface TokenEnv {
  palette: ArenaPalette;
  chrome: Chrome;
  text: TextFactory;
  /** CSS px per metre. */
  pxPerMetre: number;
  /** Interface scale (--ui-scale), 0.85 to 1.5. */
  uiScale: number;
  /** Overlay scale from zoom and interface scale. */
  overlayScale: number;
}

/** What one frame tells a token beyond the unit's own state. */
export interface TokenFrame {
  x: number;
  y: number;
  tick: number;
  /** Screen angle of the facing wedge (radians). */
  facing: number;
  ring: number;
  hardControl: boolean;
  /** 0..1 of the hit flash, already limited. */
  flash: number;
  selected: boolean;
  labels: 'off' | 'selected' | 'all';
  reducedMotion: boolean;
  /** Pips to draw, highest priority first (at most MAX_PIPS). */
  pips: readonly StatusCue[];
  pipCount: number;
  /** Cast bar progress 0..1, or -1 for none. */
  cast: number;
  focusMax: number;
  body: BodyFrame;
}

export class Token {
  readonly root = new Container();
  readonly overlay = new Container();
  private readonly ring = new Graphics();
  private readonly wedge = new Graphics();
  private readonly plate = new Graphics();
  private readonly glyphLayer = new Container();
  private readonly selection = new Graphics();
  private readonly flashDisc = new Graphics();
  private readonly downMark = new Graphics();

  private readonly track = new Graphics();
  private readonly hp = new Graphics();
  private readonly shield = new Graphics();
  private readonly focus = new Graphics();
  private readonly castTrack = new Graphics();
  private readonly cast = new Graphics();
  private readonly pipSlots: Graphics[] = [];
  private readonly pipKeys: string[] = [];
  private readonly badgePlate = new Graphics();
  private readonly badge: TextLabel;
  private readonly crown = new Graphics();
  private readonly name: TextLabel;
  private readonly tag: TextLabel;

  private glyphs: Graphics[] = [];
  private env: TokenEnv;
  private colors: TeamColors;
  private drawnRing = -1;
  private badgeText = '';
  private tagText = '';
  private destroyed = false;
  /** The last hit already considered for a flash. */
  private lastHitSeen: number | null = null;
  private flashStart = -1;
  private flashStrength = 0;

  constructor(
    readonly info: ArenaUnitInfo,
    readonly body: BodyVisual,
    colors: TeamColors,
    env: TokenEnv,
  ) {
    this.env = env;
    this.colors = colors;
    for (const part of [this.ring, this.wedge, this.plate, this.selection, this.flashDisc, this.downMark]) part.eventMode = 'none';
    this.root.eventMode = 'none';
    this.overlay.eventMode = 'none';
    this.root.addChild(body.view, this.flashDisc, this.ring, this.wedge, this.plate, this.glyphLayer, this.selection, this.downMark);

    this.badge = env.text.create('small');
    this.name = env.text.create('normal');
    this.tag = env.text.create('small');
    this.badge.setAnchor(0.5, 0.5);
    this.name.setAnchor(0.5, 1);
    this.tag.setAnchor(0.5, 1);
    for (let i = 0; i < MAX_PIPS; i++) {
      const pip = new Graphics();
      pip.visible = false;
      this.pipSlots.push(pip);
      this.pipKeys.push('');
    }
    this.overlay.addChild(
      this.track,
      this.hp,
      this.shield,
      this.focus,
      this.castTrack,
      this.cast,
      ...this.pipSlots,
      this.badgePlate,
      this.badge.view,
      this.crown,
      this.name.view,
      this.tag.view,
    );
    this.name.view.visible = false;
    this.tag.view.visible = false;
    this.badge.view.visible = false;
    this.badgePlate.visible = false;
    this.crown.visible = false;
    this.castTrack.visible = false;
    this.cast.visible = false;
    this.flashDisc.visible = false;
    this.downMark.visible = false;
    this.selection.visible = false;
    this.layout(env, colors);
  }

  /** The palette, zoom or colours changed: redraw the static geometry. */
  layout(env: TokenEnv, colors: TeamColors): void {
    this.env = env;
    this.colors = colors;
    const { palette, chrome } = env;
    const r = 0.5 * env.pxPerMetre;
    this.drawnRing = -1;

    // Hit flash: a bright disc over the body (alpha animated).
    this.flashDisc.clear().circle(0, 0, r).fill({ color: 0xffffff });
    // Facing wedge: a small triangle just outside the ring, pointing east, rotated by the viewer's own mark.
    const w = Math.max(6, r * 0.4);
    this.wedge.clear();
    this.wedge.poly([r + 3, 0, r - 1 - w * 0.2, -w * 0.62, r - 1 - w * 0.2, w * 0.62]).fill({ color: 0xffffff }).stroke({ width: 1.5, color: chrome.outline, join: 'round' });
    // Selection: a bright ring with a dark outline, clear of the side ring.
    const sel = r + 8;
    this.selection.clear().circle(0, 0, sel).stroke({ width: 5, color: chrome.outline, alpha: 0.9 }).circle(0, 0, sel).stroke({ width: 2.5, color: palette.text });
    // Down marker: a diamond in the side colour with a dark outline (as in the report).
    const d = r * 0.5;
    this.downMark.clear().poly([0, -d, d, 0, 0, d, -d, 0]).fill({ color: 0xffffff }).stroke({ width: 2, color: chrome.outline, join: 'round' });

    // Overlay chrome in 1080p px.
    this.track.clear().rect(-BAR_W / 2 - 1, HP_TOP - 1, BAR_W + 2, HP_H + 2).fill({ color: chrome.outline, alpha: 0.85 }).rect(-BAR_W / 2 - 1, FOCUS_TOP - 0.5, BAR_W + 2, FOCUS_H + 1).fill({ color: chrome.outline, alpha: 0.7 });
    this.hp.clear().rect(0, 0, 1, HP_H).fill({ color: 0xffffff });
    this.hp.tint = palette.text;
    this.shield.clear().rect(0, 0, 1, HP_H).fill({ color: 0xffffff, alpha: 0.45 }).rect(0, 0, 1, HP_H).stroke({ width: 1, color: 0xffffff, alignment: 1 });
    this.shield.tint = palette.text;
    this.focus.clear().rect(0, 0, 1, FOCUS_H).fill({ color: 0xffffff });
    this.focus.tint = palette.textMuted;
    this.castTrack.clear().rect(-BAR_W / 2 - 1, CAST_TOP - 1, BAR_W + 2, CAST_H + 2).fill({ color: chrome.outline, alpha: 0.85 });
    this.cast.clear().rect(0, 0, 1, CAST_H).fill({ color: 0xffffff });
    this.cast.tint = palette.warn;
    this.badgePlate.clear().roundRect(-BADGE_W / 2, -BADGE_H / 2, BADGE_W, BADGE_H, 4).fill({ color: chrome.textPlate, alpha: 0.92 }).stroke({ width: 1, color: chrome.lift(palette.text), alpha: 0.8 });
    this.badgePlate.position.set(-(BAR_W / 2 + 4 + BADGE_W / 2), ROW_CY);
    this.badge.view.position.copyFrom(this.badgePlate.position);
    this.badge.setTint(chrome.lift(palette.text));
    this.crown.clear().poly([-6, 4, -7, -5, -3, -1, 0, -7, 3, -1, 7, -5, 6, 4]).fill({ color: 0xffffff }).stroke({ width: 1.5, color: chrome.outline, join: 'round' });
    this.crown.tint = palette.text;
    this.crown.position.set(BAR_W / 2 + 4 + 7, ROW_CY);
    this.name.view.position.set(0, NAME_BOTTOM);
    this.name.setTint(chrome.lift(palette.text));
    this.tag.view.position.set(0, TAG_BOTTOM);
    this.tag.setTint(chrome.lift(palette.warn));
    for (const pip of this.pipSlots) pip.position.y = PIPS_CY;
    for (let i = 0; i < this.pipKeys.length; i++) this.pipKeys[i] = '';

    this.drawRoleGlyphs(r);
    this.overlay.scale.set(env.overlayScale);
  }

  private drawRoleGlyphs(r: number): void {
    const { palette, chrome } = this.env;
    for (const g of this.glyphs) {
      g.destroy();
    }
    this.glyphs = [];
    const roles = this.info.roles.slice(0, 2);
    // The plate stays well inside the disc so the side's body colour still shows around it.
    const size = roles.length > 1 ? r * 0.5 : r * 0.72;
    const gap = size * 0.12;
    const total = roles.length * size + (roles.length - 1) * gap;
    const plateW = total + size * 0.34;
    const plateH = size + size * 0.34;
    this.plate.clear();
    if (roles.length > 0) {
      this.plate.roundRect(-plateW / 2, -plateH / 2, plateW, plateH, Math.min(plateH / 2, size * 0.34)).fill({ color: chrome.plate, alpha: 0.88 });
    }
    roles.forEach((role, i) => {
      const g = buildRoleGlyph(role, palette.roleGlyphSvg[role] ?? '', size);
      g.tint = palette.roles[role];
      g.position.x += -total / 2 + i * (size + gap) + size / 2;
      this.glyphLayer.addChild(g);
      this.glyphs.push(g);
    });
  }

  /** Apply one frame. Allocation-free. */
  update(u: UnitRenderState, f: TokenFrame): void {
    if (this.destroyed) return;
    const { palette, chrome } = this.env;
    const dead = !u.standing;

    this.root.position.set(f.x, f.y);
    this.root.zIndex = f.y;
    this.overlay.position.set(f.x, f.y);
    this.body.update(u, f.body);

    // Side ring: the authoritative side cue; solid for the player's side, double for the other (colour-free cue).
    const ringColor = f.hardControl ? chrome.grey : f.ring;
    const ringKey = ringColor * 4 + (this.colors.ringStyle === 'double' ? 1 : 0);
    if (ringKey !== this.drawnRing) {
      this.drawnRing = ringKey;
      this.drawRing(ringColor);
    }
    this.ring.alpha = dead ? 0.35 : 1;

    this.wedge.visible = !dead;
    this.wedge.rotation = f.facing;
    this.wedge.tint = ringColor;
    this.plate.alpha = dead ? 0.4 : 1;
    this.glyphLayer.alpha = dead ? 0.4 : 1;
    this.selection.visible = f.selected;
    this.downMark.visible = dead;
    if (dead) this.downMark.tint = f.ring;

    // Hit flash (limited by the caller; none under reduced motion).
    if (f.flash > 0.001 && !dead) {
      this.flashDisc.visible = true;
      this.flashDisc.alpha = f.flash * 0.55;
    } else {
      this.flashDisc.visible = false;
    }

    // Bars.
    const showBars = !dead;
    this.track.visible = showBars;
    this.hp.visible = showBars;
    this.focus.visible = showBars && u.focus !== null;
    if (showBars) {
      const shield = u.shield !== null && u.shield > 0 ? u.shield : 0;
      const denom = Math.max(1, u.maxHp, u.hp + shield);
      const hpW = Math.max(0, Math.min(1, u.hp / denom)) * BAR_W;
      this.hp.scale.x = Math.max(hpW, u.hp > 0 ? 1 : 0);
      this.hp.position.set(-BAR_W / 2, HP_TOP);
      this.shield.visible = shield > 0;
      if (shield > 0) {
        this.shield.scale.x = Math.max(1, (shield / denom) * BAR_W);
        this.shield.position.set(-BAR_W / 2 + hpW, HP_TOP);
      }
      if (u.focus !== null) {
        this.focus.scale.x = Math.max(0, Math.min(1, u.focus / Math.max(1, f.focusMax))) * BAR_W;
        this.focus.position.set(-BAR_W / 2, FOCUS_TOP);
      }
    } else {
      this.shield.visible = false;
    }

    // Cast bar (casts and channels of 0.3 s or more; the caller passes -1 otherwise).
    const casting = showBars && f.cast >= 0;
    this.castTrack.visible = casting;
    this.cast.visible = casting;
    if (casting) {
      this.cast.scale.x = Math.max(0, Math.min(1, f.cast)) * BAR_W;
      this.cast.position.set(-BAR_W / 2, CAST_TOP);
    }

    // Status pips: up to four above the bars, by priority (hard control first).
    for (let i = 0; i < MAX_PIPS; i++) {
      const pip = this.pipSlots[i]!;
      if (!showBars || i >= f.pipCount) {
        pip.visible = false;
        continue;
      }
      const cue = f.pips[i]!;
      const key = `${cue.category}|${cue.icon}`;
      if (this.pipKeys[i] !== key) {
        this.pipKeys[i] = key;
        drawPip(pip, cue, palette, chrome);
      }
      pip.visible = true;
      pip.position.x = (i - (f.pipCount - 1) / 2) * (PIP + 2);
    }

    // Rule badge (P-22): "R3", "S" or "T"; pulses on a new decision (u.rule.pulse is 0 under reduced motion).
    const rule = showBars ? u.rule : null;
    this.badgePlate.visible = rule !== null;
    this.badge.view.visible = rule !== null;
    if (rule) {
      if (this.badgeText !== rule.label) {
        this.badgeText = rule.label;
        this.badge.setText(rule.label);
      }
      const s = f.reducedMotion ? 1 : 1 + 0.35 * rule.pulse;
      this.badgePlate.scale.set(s);
      this.badge.view.scale.set(s);
    }

    this.crown.visible = showBars && u.isCaptain;

    // Labels.
    const showName = f.labels === 'all' || (f.labels === 'selected' && f.selected);
    this.name.view.visible = showName;
    if (showName) this.name.setText(this.info.name);
    const tag = f.tick < TAG_TICKS && this.info.fatigueTag !== null && this.info.freshness !== null ? `${this.info.fatigueTag === 'spent' ? 'Spent' : 'Tired'} (${Math.round(this.info.freshness)})` : '';
    this.tag.view.visible = tag !== '' && !dead;
    if (tag !== this.tagText) {
      this.tagText = tag;
      this.tag.setText(tag);
    }
  }

  /** Hit flash level for this frame; remembers what it has seen so a seek never flashes. */
  flashLevel(u: UnitRenderState, tick: number, playing: boolean, reducedMotion: boolean, limiter: FlashLimiter, nowMs: number): number {
    const hit = u.lastHitTick;
    if (hit !== this.lastHitSeen) {
      const fresh = hit !== null && playing && !reducedMotion && tick >= hit && tick - hit <= FLASH_TICKS;
      this.lastHitSeen = hit;
      if (fresh) {
        this.flashStart = hit;
        this.flashStrength = limiter.admit(u.unit, nowMs) ? 1 : REFUSED_FLASH;
      } else {
        this.flashStart = -1;
      }
    }
    if (this.flashStart < 0 || reducedMotion || !playing) return 0;
    const age = tick - this.flashStart;
    if (age < 0 || age > FLASH_TICKS) return 0;
    return this.flashStrength * (1 - age / FLASH_TICKS);
  }

  private drawRing(color: number): void {
    const r = 0.5 * this.env.pxPerMetre;
    const { chrome } = this.env;
    const g = this.ring;
    g.clear();
    // Dark outline first so the ring keeps 3:1 against any floor, then the ring itself.
    if (this.colors.ringStyle === 'double') {
      g.circle(0, 0, r + 1.5).stroke({ width: 7, color: chrome.outline, alpha: 0.7 });
      g.circle(0, 0, r + 0.5).stroke({ width: 2, color });
      g.circle(0, 0, r + 4.5).stroke({ width: 2, color });
    } else {
      g.circle(0, 0, r + 1.5).stroke({ width: 6, color: chrome.outline, alpha: 0.7 });
      g.circle(0, 0, r + 1.5).stroke({ width: 3.5, color });
    }
  }

  /** What the token is showing right now (tests and the dev harness). */
  shown(): { bars: boolean; hpScaleX: number; shield: boolean; focus: boolean; cast: boolean; pips: number; badge: string | null; crown: boolean; downMark: boolean; selected: boolean; ringAlpha: number; wedge: number; flash: number; tag: string; name: boolean } {
    return {
      bars: this.hp.visible,
      hpScaleX: this.hp.scale.x,
      shield: this.shield.visible,
      focus: this.focus.visible,
      cast: this.cast.visible,
      pips: this.pipSlots.filter((p) => p.visible).length,
      badge: this.badge.view.visible ? this.badgeText : null,
      crown: this.crown.visible,
      downMark: this.downMark.visible,
      selected: this.selection.visible,
      ringAlpha: this.ring.alpha,
      wedge: this.wedge.rotation,
      flash: this.flashDisc.visible ? this.flashDisc.alpha : 0,
      tag: this.tag.view.visible ? this.tagText : '',
      name: this.name.view.visible,
    };
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
    this.body.destroy();
    this.root.destroy(DESTROY_ALL);
    this.overlay.destroy(DESTROY_ALL);
  }
}

// ---- shapes ------------------------------------------------------------------------------------------------------

/** Fallback outlines (24-unit box) of the D-J shapes, used only when the palette carries no usable SVG. */
const FALLBACK_POLY: Record<RoleId, number[]> = {
  tank: [12, 1.5, 21, 5, 21, 11.2, 19, 16, 12, 22.5, 5, 16, 3, 11.2, 3, 5],
  melee: [12, 1, 22.5, 12, 12, 23, 1.5, 12],
  ranged: [12, 2, 23, 21.5, 1, 21.5],
  controller: [3, 2, 21, 2, 14, 12, 21, 22, 3, 22, 10, 12],
  healer: [],
};

/** A white glyph of `size` px centred on (0, 0), to be tinted with the role hue. Prefers the palette's SVG (one source with the UI). */
export function buildRoleGlyph(role: RoleId, svg: string, size: number): Graphics {
  const g = new Graphics();
  g.eventMode = 'none';
  const scale = size / 24;
  let drawn = false;
  if (svg) {
    try {
      // Force a white fill so tint decides the colour; every other attribute (fill-rule) stays.
      const white = svg.replace(/\sfill=("[^"]*"|'[^']*')/g, '').replace(/<path\s/g, "<path fill='white' ");
      g.svg(white);
      drawn = g.context.instructions.length > 0;
    } catch {
      drawn = false;
    }
  }
  if (!drawn) {
    g.clear();
    if (role === 'healer') {
      g.circle(12, 12, 10.5).fill({ color: 0xffffff });
      g.rect(10.3, 6.3, 3.4, 11.4).cut();
      g.rect(6.3, 10.3, 11.4, 3.4).cut();
    } else {
      g.poly(FALLBACK_POLY[role]).fill({ color: 0xffffff });
    }
  }
  g.scale.set(scale);
  g.position.set(-12 * scale, -12 * scale);
  return g;
}

/** A status pip: a shape per category on a dark chip; the hue comes from the palette (shape carries the meaning too). */
export function drawPip(g: Graphics, cue: StatusCue, palette: ArenaPalette, chrome: Chrome): void {
  const h = PIP / 2;
  g.clear();
  g.roundRect(-h, -h, PIP, PIP, 3).fill({ color: chrome.plate, alpha: 0.92 });
  let color = palette.text;
  switch (cue.category) {
    case 'cc_hard':
      color = palette.warn;
      g.rect(-3.2, -3.2, 6.4, 6.4).fill({ color });
      break;
    case 'cc_soft':
      color = palette.warn;
      g.circle(0, 0, 3.4).stroke({ width: 1.6, color });
      break;
    case 'buff':
      color = palette.good;
      g.poly([0, -3.6, 3.8, 3, -3.8, 3]).fill({ color });
      break;
    case 'debuff':
      color = palette.bad;
      g.poly([0, 3.6, 3.8, -3, -3.8, -3]).fill({ color });
      break;
    case 'dot':
      color = palette.bad;
      g.moveTo(-3, -3).lineTo(3, 3).moveTo(3, -3).lineTo(-3, 3).stroke({ width: 1.8, color });
      break;
    case 'hot':
      color = palette.good;
      g.moveTo(-3.4, 0).lineTo(3.4, 0).moveTo(0, -3.4).lineTo(0, 3.4).stroke({ width: 1.8, color });
      break;
    case 'shield':
      g.circle(0, 0, 3.4).stroke({ width: 1.6, color }).circle(0, 0, 1.1).fill({ color });
      break;
    case 'special':
      g.poly([0, -4, 3.6, 0, 0, 4, -3.6, 0]).fill({ color });
      break;
    default:
      g.circle(0, 0, 2.6).fill({ color: mixColor(color, chrome.plate, 0.2) });
  }
}
