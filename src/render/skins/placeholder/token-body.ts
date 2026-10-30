/**
 * The fighter token's body (owner's design, 2026-10-30; docs/art/reference/fighter-token-mock.png): a disc filled with
 * the fighter's role colour (a hybrid is split diagonally between its two roles), "OVR" and the overall rating inside,
 * a ring around the disc that shows Freshness (arc length = Freshness 0-100, colour = its tier), and the class name
 * printed under the token. The viewer still draws the team side ring, HP / shield / focus bars, pips, name chip, crown
 * and cues above this (tech-020).
 *
 * Everything static is drawn when the body is built or the size or palette changes. Freshness is fixed for a whole
 * round, so the ring never redraws during play; the text is created once and set once. `update` only flattens a downed
 * body and fades it (asset-006), like the old disc.
 *
 * Tier colours and thresholds: the tier is looked up in content (levels.json freshness.labels: id, label, min) so a
 * change of thresholds or label names needs no code. Only the id -> colour mapping is here (ids are a closed list,
 * core/content validate FRESHNESS_LABELS): fresh = status good, ready = warn, tired = halfway warn to bad, spent = bad,
 * all from the palette (so the colour-vision "blue / orange" option carries over).
 */
import { Container, Graphics } from 'pixi.js';
import type { ContentDB } from '../../../core/content';
import type { ArenaMetrics, ArenaPalette, ArenaUnitInfo, RoleId, TeamColors, UnitRenderState } from '../../types';
import { DESTROY_ALL } from '../../viewer/destroy';
import { buildGlyph } from '../../viewer/scene/glyphs';
import type { BodyFrame, BodyVisual } from '../../viewer/skin';
import type { TokenText, TokenTextFactory } from './token-text';

/**
 * Token size (owner, 2026-10-30): about 60 px across at the normal 1920 x 1080 view (46 px per metre with the dock open),
 * so OVR and the short role label always read. The token is TOKEN_DIAMETER_M metres of arena, never under
 * MIN_TOKEN_DIAMETER_PX: 60 px at 1920, 48 px at 1440 and 1280 (35 and 27 px per metre). Bunched fighters overlap
 * (accepted); the selected or hovered token is raised by the viewer.
 */
export const TOKEN_DIAMETER_M = 1.3;
export const MIN_TOKEN_DIAMETER_PX = 48;
/** The "OVR" caption above the number shows from this diameter up (it is the first thing to go when space is short). */
export const OVR_CAPTION_MIN_DIAMETER_PX = 56;
/** The short role label is never printed smaller than this (px); below it, or when it does not fit, the glyphs show. */
export const ROLE_LABEL_MIN_PX = 6.5;

/** The token's diameter in CSS px at a zoom. */
export function tokenDiameterPx(pxPerMetre: number): number {
  return Math.max(MIN_TOKEN_DIAMETER_PX, Math.round(pxPerMetre * TOKEN_DIAMETER_M));
}

/**
 * The short role label of a token ("MEL", "MEL/HEA"): each role's `shortName` from combat.json archetypes (one place,
 * data, translatable with the content); the role id upper-cased only when content has none. Full names stay in the
 * fighter strip's tooltips and the inspector.
 */
export function shortRoleLabel(roles: readonly RoleId[], content: ContentDB | null): string {
  const list = (content as { combat?: { archetypes?: readonly { id: string; shortName?: string }[] } } | null)?.combat?.archetypes ?? [];
  return roles.map((r) => list.find((a) => a.id === r)?.shortName ?? r.slice(0, 3).toUpperCase()).join('/');
}
/** A downed body is flattened to this fraction of its height (arena-notes §1: 60%). */
const DOWNED_FLATTEN = 0.6;
const FALLBACK_DOWN_OPACITY = 0.4;
/** Freshness ring width as a fraction of the diameter (floor in px). */
const RING_OF_DIAMETER = 0.09;

export type FreshnessTierId = 'fresh' | 'ready' | 'tired' | 'spent';

export interface FreshnessTier {
  id: string;
  /** The label from content (shipped: "Fresh", "Winded", "Tired", "Spent"; O36). */
  label: string;
}

/** The tier of a Freshness value, from levels.json freshness.labels (descending `min`); null when unknown. */
export function freshnessTier(freshness: number | null, content: ContentDB): FreshnessTier | null {
  if (freshness === null) return null;
  const labels = (content as { levels?: { freshness?: { labels?: readonly { id: string; label: string; min: number }[] } } }).levels?.freshness?.labels ?? [];
  if (labels.length === 0) return null;
  for (const l of labels) if (freshness >= l.min) return { id: l.id, label: l.label };
  const last = labels[labels.length - 1]!;
  return { id: last.id, label: last.label };
}

function mix(a: number, b: number, t: number): number {
  const ch = (shift: number): number => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** The ring colour of a tier id, from the palette. */
export function tierColor(id: string | null, p: ArenaPalette): number {
  switch (id) {
    case 'fresh':
      return p.good;
    case 'ready':
      return p.warn;
    case 'tired':
      return mix(p.warn, p.bad, 0.5);
    case 'spent':
      return p.bad;
    default:
      return p.textMuted;
  }
}

export interface TokenBodyEnv {
  palette: () => ArenaPalette | null;
  content: () => ContentDB | null;
  text: () => TokenTextFactory | null;
}

/** What the token body shows now (tests and the dev harness). */
export interface TokenBodyShown {
  overall: string;
  roles: readonly RoleId[];
  /** Colours of the disc halves: one entry for a single role, two (upper-left first) for a hybrid. */
  fills: readonly number[];
  split: boolean;
  freshness: number | null;
  tier: string | null;
  tierLabel: string | null;
  /** Arc fill 0..1 and its colour. */
  arc: number;
  arcColor: number;
  /** The short role label when it fits inside the disc, else the glyphs. */
  roleMark: 'glyphs' | 'label';
  roleLabel: string;
  className: string;
  diameter: number;
}

export class TokenBody implements BodyVisual {
  readonly view = new Container();
  readonly drawsRole = true;
  /** Flattened and faded when downed. */
  private readonly token = new Container();
  private readonly band = new Graphics();
  private readonly fillG = new Graphics();
  private readonly arc = new Graphics();
  private readonly marks = new Container();
  private readonly classHolder = new Container();
  private readonly club = new Graphics();
  private glyphs: Graphics[] = [];
  private readonly texts: TokenText[] = [];
  private ovr: TokenText | null = null;
  private caption: TokenText | null = null;
  private roleText: TokenText | null = null;
  private classText: TokenText | null = null;
  private drawnD = -1;
  /** Width of the class name and its club bar, measured when drawn (the viewer asks every frame: no text measuring there). */
  private labelW = 0;
  private drawnPalette: ArenaPalette | null = null;
  private diameter = 0;
  private fills: number[] = [];
  private arcFrac = 0;
  private arcColor = 0;
  private roleMark: 'glyphs' | 'label' = 'glyphs';
  private destroyed = false;
  private labelBelowAllowed = true;
  private standingNow = true;
  private readonly roles: readonly RoleId[];
  private roleLabel = '';
  private readonly ovrText: string;
  private tier: FreshnessTier | null = null;

  constructor(
    private readonly info: ArenaUnitInfo,
    private readonly colors: TeamColors,
    private readonly env: TokenBodyEnv,
  ) {
    this.roles = info.roles.slice(0, 2);
    this.ovrText = info.overall === null || info.overall === undefined ? '–' : String(Math.round(info.overall));
    this.view.eventMode = 'none';
    this.token.addChild(this.band, this.fillG, this.arc, this.marks);
    this.view.addChild(this.token, this.classHolder);
    const factory = env.text();
    if (factory) {
      const make = (kind: 'ovr' | 'small' | 'class', text: string): TokenText => {
        const t = factory.create(kind);
        t.setAnchor(0.5, 0.5);
        t.setText(text);
        this.texts.push(t);
        return t;
      };
      this.ovr = make('ovr', this.ovrText);
      this.caption = make('small', 'OVR');
      this.roleText = make('small', '');
      this.classText = make('class', info.className);
      this.marks.addChild(this.ovr.view, this.caption.view, this.roleText.view);
      this.classHolder.addChild(this.club, this.classText.view);
    }
    this.classHolder.visible = false;
  }

  /** The disc's diameter at a zoom (skin.ts BodyVisual.diameterPx). */
  diameterPx(pxPerMetre: number): number {
    return tokenDiameterPx(pxPerMetre);
  }

  /** Width of the class name and its club bar (px). */
  labelBelowWidthPx(): number {
    return this.labelW;
  }

  /** The viewer hides the class name where another token's stack would overlap it. */
  setLabelBelowVisible(on: boolean): void {
    this.labelBelowAllowed = on;
    this.classHolder.visible = on && this.standingNow && this.classText !== null;
  }

  /** CSS px the class name takes below the viewer's ring. */
  extentBelowPx(_pxPerMetre: number): number {
    const m = this.env.palette()?.metrics;
    return this.ringReach(m) + this.classSize(m) * 1.25 + 5;
  }

  /** The class name is a step smaller than the viewer's labels (it is secondary, and it is what crowds a column). */
  private classSize(m: ArenaMetrics | undefined): number {
    return Math.max(10, (m?.labelSizePx ?? 12) * 0.9);
  }

  /** How far the viewer's side ring reaches past the disc edge (px). */
  private ringReach(m: ArenaMetrics | undefined): number {
    if (!m) return 8;
    return (this.colors.ringStyle === 'double' ? m.ringGapPx * 2 + m.ringLinePx * 2 : m.ringGapPx + m.ringWidthPx) + 2;
  }

  update(state: UnitRenderState, frame: BodyFrame): void {
    if (this.destroyed) return;
    const p = this.env.palette();
    if (p) this.ensureDrawn(tokenDiameterPx(frame.pxPerMetre), p);
    const flat = state.standing ? 0 : 1;
    const downOpacity = p?.metrics.downOpacity ?? FALLBACK_DOWN_OPACITY;
    this.token.scale.y = 1 - (1 - DOWNED_FLATTEN) * flat;
    this.view.alpha = 1 - (1 - downOpacity) * flat;
    // The class name belongs to a standing fighter (the viewer hides its own labels for a downed one as well).
    this.standingNow = state.standing;
    this.classHolder.visible = state.standing && this.labelBelowAllowed && this.classText !== null;
  }

  /** The palette changed (theme): force a redraw at the next frame. */
  restyle(): void {
    this.drawnPalette = null;
  }

  private ensureDrawn(d: number, p: ArenaPalette): void {
    // Allocation-free: a new palette object (theme, scale) or a new size redraws, nothing else.
    if (d === this.drawnD && p === this.drawnPalette) return;
    this.drawnD = d;
    this.drawnPalette = p;
    this.draw(d, p);
  }

  private draw(d: number, p: ArenaPalette): void {
    this.diameter = d;
    const r = d / 2;
    const ringW = Math.max(3, d * RING_OF_DIAMETER);
    const discR = r - ringW;

    // The ring band: a plate-coloured track under the arc, so the arc's colour always meets 3:1 on it.
    this.band.clear().circle(0, 0, r).fill({ color: p.plate });

    // The disc: the role colour, or two halves split on the diagonal (first role upper-left), then the club rim.
    this.fills = this.roles.length === 0 ? [p.wall] : this.roles.map((role) => p.roles[role]);
    const g = this.fillG;
    g.clear();
    if (this.fills.length >= 2) {
      g.moveTo(0, 0).arc(0, 0, discR, -Math.PI / 4, (-5 * Math.PI) / 4, true).closePath().fill({ color: this.fills[0]! });
      g.moveTo(0, 0).arc(0, 0, discR, -Math.PI / 4, (3 * Math.PI) / 4, false).closePath().fill({ color: this.fills[1]! });
    } else {
      g.circle(0, 0, discR).fill({ color: this.fills[0]! });
    }
    g.circle(0, 0, discR - 0.5).stroke({ width: 1, color: p.plate });

    // The Freshness arc: from twelve o'clock, clockwise. Unknown Freshness draws the track only.
    this.tier = freshnessTier(this.info.freshness, this.env.content() ?? ({} as ContentDB));
    const frac = this.info.freshness === null ? 0 : Math.max(0, Math.min(1, this.info.freshness / 100));
    this.arcFrac = frac;
    this.arcColor = tierColor(this.tier?.id ?? null, p);
    const arcW = Math.max(2, ringW - 1.5);
    const arcR = r - ringW / 2;
    this.arc.clear();
    if (frac >= 0.999) this.arc.circle(0, 0, arcR).stroke({ width: arcW, color: this.arcColor });
    else if (frac > 0) this.arc.moveTo(0, -arcR).arc(0, 0, arcR, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2).stroke({ width: arcW, color: this.arcColor, cap: 'butt' });

    // Inside the disc: OVR big, the "OVR" caption from 56 px, and the short role label when it fits the chord at its
    // height (else the role glyphs on a small plate: the colour-free role cue is never lost).
    for (const gl of this.glyphs) gl.destroy(DESTROY_ALL);
    this.glyphs = [];
    this.marks.children.filter((c) => c instanceof Graphics).forEach((c) => c.destroy(DESTROY_ALL));
    let label = false;
    if (this.ovr && this.caption && this.roleText) {
      if (this.roleLabel === '' && this.roles.length > 0) {
        this.roleLabel = shortRoleLabel(this.roles, this.env.content());
        this.roleText.setText(this.roleLabel);
      }
      const caption = d >= OVR_CAPTION_MIN_DIAMETER_PX;
      const roleY = d * (caption ? 0.23 : 0.21);
      // The width the disc has at the label's centre line (its corners may touch the plate band: the text is stroked).
      const chord = 2 * Math.sqrt(Math.max(0, discR * discR - roleY * roleY)) - 2;
      if (this.roleLabel !== '') {
        for (const k of [0.16, 0.135, 0.12, 0.105]) {
          const size = Math.max(ROLE_LABEL_MIN_PX, d * k);
          this.roleText.setSize(size);
          if (this.roleText.width <= chord) {
            label = true;
            break;
          }
        }
      }
      this.caption.view.visible = caption;
      this.caption.setSize(Math.max(6, d * 0.11));
      this.caption.view.position.set(0, -d * 0.26);
      this.ovr.setSize(d * (caption ? 0.34 : 0.38));
      this.ovr.view.position.set(0, caption ? -d * 0.04 : -d * 0.08);
      this.roleText.view.visible = label;
      this.roleText.view.position.set(0, roleY);
    }
    this.roleMark = label ? 'label' : 'glyphs';
    if (!label && this.roles.length > 0) this.drawGlyphRow(d, p);

    // Class name under the token, past the viewer's ring.
    if (this.classText) {
      this.classText.setSize(this.classSize(p.metrics));
      this.classText.setAnchor(0.5, 0);
      this.classText.view.position.set(0, r + this.ringReach(p.metrics));
      // The light team cue (with the viewer's side ring): the club's primary colour as a keylined bar under the class name.
      const w = Math.max(this.classText.view.width, d * 0.5);
      this.labelW = w + 2;
      const lh = this.classSize(p.metrics) * 1.25;
      this.club
        .clear()
        .roundRect(-w / 2 - 1, r + this.ringReach(p.metrics) + lh - 1, w + 2, 5, 2)
        .fill({ color: p.plate })
        .roundRect(-w / 2, r + this.ringReach(p.metrics) + lh, w, 3, 1)
        .fill({ color: this.colors.primary });
    }
  }

  /** Role glyph(s) on a small plate in the lower half of the disc (the colour-free role cue at small sizes). */
  private drawGlyphRow(d: number, p: ArenaPalette): void {
    const size = d * 0.19;
    const gap = d * 0.03;
    const total = this.roles.length * size + (this.roles.length - 1) * gap;
    const y = d * 0.25;
    const plate = new Graphics();
    plate.eventMode = 'none';
    const padX = size * 0.28;
    plate.roundRect(-total / 2 - padX, y - size / 2 - size * 0.18, total + padX * 2, size * 1.36, size * 0.5).fill({ color: p.plate });
    this.marks.addChild(plate);
    this.roles.forEach((role, i) => {
      const glyph = buildGlyph(p.roleGlyphSvg[role] ?? '', size, role);
      glyph.tint = p.roles[role];
      glyph.position.x += -total / 2 + i * (size + gap) + size / 2;
      glyph.position.y += y;
      this.marks.addChild(glyph);
      this.glyphs.push(glyph);
    });
  }

  shown(): TokenBodyShown {
    return {
      overall: this.ovrText,
      roles: this.roles,
      fills: this.fills,
      split: this.fills.length >= 2,
      freshness: this.info.freshness,
      tier: this.tier?.id ?? null,
      tierLabel: this.tier?.label ?? null,
      arc: this.arcFrac,
      arcColor: this.arcColor,
      roleMark: this.roleMark,
      roleLabel: this.roleLabel,
      className: this.info.className,
      diameter: this.diameter,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const t of this.texts) t.destroy();
    this.texts.length = 0;
    this.view.destroy(DESTROY_ALL);
  }
}
