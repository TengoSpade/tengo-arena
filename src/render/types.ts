/**
 * src/render contract types (docs/design/_drafts/05-technical-m2.md §A5). Architect-owned: add freely, change or
 * remove only through the architect. PURE: no PixiJS, no DOM (tests/architecture rule render-pure), so the
 * render-state model runs and is tested in Node without a GPU.
 *
 * Units: positions in centimetres (as in the fight log), time in ticks (50 ms; a tick may be fractional while
 * playing), angles in radians (0 = east, +y = south, as the arena's axes), colours as 0xRRGGBB numbers.
 */
import type { Effect } from '../core/content';
import type { AbilityId, ClassId, ClubId, FighterId, RuleTraceEntry, Side, UnitIndex } from '../core/model';

/** The closed effect vocabulary of abilities.json (17 types); cue derivation switches over it exhaustively. */
export type AbilityEffectType = Effect['type'];

/** Playback speeds (T1). */
export type Speed = 1 | 2 | 4;

/** The five role ids of D-J (combat.json archetype ids, `data-role` in the UI). */
export type RoleId = 'tank' | 'melee' | 'ranged' | 'controller' | 'healer';

/** Side colours of one side for this match (asset-006; research §6), from colorsForMatch. */
export interface TeamColors {
  /** Body fill / sprite primary mask tint. */
  primary: number;
  /** Trim / sprite secondary mask tint. */
  secondary: number;
  /** The side ring: the authoritative side cue (brass for the player's side, steel blue for the opponent). */
  ring: number;
  /** Redundant, colour-free side cue (04 §9): the player's side solid, the other double. */
  ringStyle: 'solid' | 'double';
}

export interface ArenaSideInfo {
  clubId: ClubId;
  name: string;
  /** 2-3 letters (crest code). */
  shortName: string;
  colors: TeamColors;
}

/** Who a unit index is (from the log header plus state and content; built by the UI). */
export interface ArenaUnitInfo {
  unit: UnitIndex;
  side: Side;
  fighterId: FighterId;
  name: string;
  classId: ClassId;
  className: string;
  /** One role, or two for a hybrid (D-J: both glyphs). */
  roles: readonly RoleId[];
  raceId: string;
  isHiredBlade: boolean;
  /** Entered from the reserves for this round (M1.1). */
  entered: boolean;
  /** Freshness 0-100 at the round start and its tag (report tags "Tired (52)"). */
  freshness: number | null;
  fatigueTag: 'tired' | 'spent' | null;
  /** Rules in his list (the stance badge is "S"). */
  ruleCount: number;
}

/** Everything the viewer shows besides the log itself (built by the UI from core/game playback views). */
export interface ArenaRoundContext {
  fixtureId: string;
  round: number;
  bestOf: number;
  /** Rounds won before this round. */
  scoreBefore: { home: number; away: number };
  /** The player's side, or null for a match between other clubs. */
  playerSide: Side | null;
  sides: readonly [ArenaSideInfo, ArenaSideInfo];
  /** One entry per unit index 0-9. */
  units: readonly ArenaUnitInfo[];
  /** 'live': seeking stops at the live head (calls, later, only there). 'replay': free seeking. */
  kind: 'live' | 'replay';
  /** Live: resume here, paused. Replay: where playback starts (0, or a key moment). */
  startTick: number;
}

// ---- Render state (the output of sampleAt; the input of the PixiJS scene and the DOM HUD) -------------

export type UnitAction = 'idle' | 'move' | 'windup' | 'cast' | 'channel' | 'displaced' | 'stunned' | 'asleep' | 'downed';

export interface StatusRenderState {
  status: string;
  /** content status category (cc_hard, cc_soft, buff, debuff, dot, hot, special, shield). */
  category: string;
  stacks: number;
  appliedTick: number;
  /** Tick the status ends (from its duration), or null when unknown. */
  endsTick: number | null;
}

/** The live rule badge ("R3", P-22): the committed rule. */
export interface RuleBadgeState {
  /** "R1".."R8", "S" for the stance, "T" for a forced (taunted) decision. */
  label: string;
  /** Rule index (ruleCount = stance, -1 = forced). */
  rule: number;
  /** Commit tick of this decision. */
  sinceTick: number;
  /** 1 at the commit, falling to 0 over the badge pulse (220 ms, 04 §7); always 0 under reduced motion. */
  pulse: number;
}

export interface CastRenderState {
  ability: AbilityId;
  kind: 'windup' | 'cast' | 'channel';
  startTick: number;
  endTick: number;
  /** 0..1. */
  progress: number;
  target: UnitIndex | null;
}

export interface UnitRenderState {
  unit: UnitIndex;
  side: Side;
  /** Interpolated position, cm. */
  x: number;
  y: number;
  facing: number;
  hp: number;
  maxHp: number;
  /** Null when the log has no frame data for it (log format 1): the bar segment is hidden, never guessed. */
  shield: number | null;
  focus: number | null;
  standing: boolean;
  downedTick: number | null;
  action: UnitAction;
  cast: CastRenderState | null;
  statuses: readonly StatusRenderState[];
  rule: RuleBadgeState | null;
  isCaptain: boolean;
  targetUnit: UnitIndex | null;
  /** Tick of the last hit taken (hit flash, capped by the flash limit). */
  lastHitTick: number | null;
}

export interface ProjectileRenderState {
  id: number;
  ability: AbilityId;
  source: UnitIndex;
  target: UnitIndex | null;
  x: number;
  y: number;
  /** 0..1 of the flight. */
  progress: number;
}

export interface ZoneRenderState {
  id: number;
  ability: AbilityId;
  owner: UnitIndex;
  side: Side;
  x: number;
  y: number;
  radius: number;
  spawnTick: number;
  endsTick: number | null;
}

/** A cast telegraph (04 §7: casts and channels of 0.3 s or longer show an arc and a cast bar). */
export interface TelegraphRenderState {
  caster: UnitIndex;
  ability: AbilityId;
  shape: 'circle' | 'cone' | 'line' | 'single';
  /** Area centre or the line/cone origin, cm. */
  x: number;
  y: number;
  /** Radius or length, cm. */
  size: number;
  /** Cone angle in radians, or line width in cm. */
  spread: number;
  direction: number;
  progress: number;
}

/** A short-lived cue active at the sampled tick (hit spark, heal pulse, number, down marker...). */
export interface EffectRenderState {
  /** Stable per event (its seq), so a scene can keep one visual per effect across frames. */
  id: number;
  kind: EffectKind;
  unit: UnitIndex | null;
  target: UnitIndex | null;
  ability: AbilityId | null;
  x: number;
  y: number;
  /** Points for numbers; null otherwise. */
  amount: number | null;
  crit: boolean;
  tone: 'physical' | 'arcane' | 'true' | 'heal' | 'shield' | 'neutral';
  /**
   * 0..1 of the effect's lifetime. Under reduced motion (sampleAt's reducedMotion), age 1 means "drawn static at its
   * end state", not "faded out": a viewer must not fade non-number effects by 1 − age in that mode (numbers fade in
   * place, 04 §9; §A19).
   */
  age: number;
}

export type EffectKind =
  | 'swing'
  | 'beam'
  | 'impact'
  | 'number'
  | 'evade'
  | 'heal-pulse'
  | 'shield-gain'
  | 'shield-break'
  | 'status-apply'
  | 'status-resist'
  | 'interrupt'
  | 'dash-trail'
  | 'displace'
  | 'cleanse'
  | 'dispel'
  | 'guard-link'
  | 'chain-arc'
  | 'splash'
  | 'cooldown-reset'
  | 'focus-gain'
  | 'zone-trigger'
  | 'down'
  | 'deathward'
  | 'rally'
  | 'captain-down'
  | 'call';

/**
 * One sampled moment of the arena (sampleAt). For a LIVE round the caller must pass sampleAt's `knownUntilTick` =
 * the live head: without it, interpolated positions, effect anchors and projectile starts may look one frame past the
 * head, and the no-look-ahead guarantee is gone (§A19). A replay passes none.
 */
export interface ArenaFrameState {
  /** The sampled tick (fractional while playing). */
  tick: number;
  /** Fight time in seconds (tick × 0.05). */
  fightSeconds: number;
  overtime: boolean;
  /** The round has ended at or before this tick. */
  ended: boolean;
  /** The round's last tick once `ended` (null before: a live sample never tells when the round will end). */
  endTick: number | null;
  units: readonly UnitRenderState[];
  projectiles: readonly ProjectileRenderState[];
  zones: readonly ZoneRenderState[];
  telegraphs: readonly TelegraphRenderState[];
  effects: readonly EffectRenderState[];
  standing: { home: number; away: number };
  captains: { home: UnitIndex | null; away: UnitIndex | null };
}

// ---- Playback control -------------------------------------------------------------------------------

/** Auto-pause triggers (P-01 "auto-pause on configurable events"; defaults approved by the owner, Q58, 2026-10-27). */
export interface AutoPauseRules {
  ownDowned: boolean;
  enemyDowned: boolean;
  ownCaptainDown: boolean;
  overtime: boolean;
  /** Pause when one of ours first drops below this HP percent in the round; null = off. */
  ownHpBelowPct: number | null;
}

export type AutoPauseReason = keyof AutoPauseRules;

/** A tick where playback must stop (the viewer stops after drawing that tick). Never handed to the UI before it is reached. */
export interface AutoPauseStop {
  tick: number;
  reason: AutoPauseReason;
  unit: UnitIndex | null;
  /** seq of the triggering event. */
  seq: number;
}

/** Why playback stopped (viewer onStop). */
export type PlaybackStop =
  | { kind: 'auto'; stop: AutoPauseStop }
  | { kind: 'end'; tick: number }
  /** Live only: the playback reached the live head after a rewind. */
  | { kind: 'head'; tick: number };

/**
 * A key moment of the round (live feed, scrubber marks; same selection rules as the report timeline, 04 ui-report).
 *
 * Unit convention (as the report's key events, core/game, and WP-M2C's keyMoments; §A19): `unit` is the ACTING
 * fighter and `target` the fighter it happened to.
 * - down: `unit` = the credited fighter who downed him (null for damage over time without a source), `target` =
 *   the fallen. A down "belongs" to the fallen's side (target), as the auto-pause reason ownDowned does.
 * - interrupt: `unit` = the interrupter, `target` = the one interrupted. deathward: `unit` = the warder,
 *   `target` = the one saved.
 * - rally, captain-down, handover: `unit` = the captain concerned (handover: the new acting captain), `target` null.
 * - overtime, end: both null. call: `unit` = the relaying captain.
 * This differs on purpose from EffectRenderState markers (down, deathward, rally, captain-down), where `unit` is the
 * unit the marker is drawn on.
 */
export interface KeyMoment {
  tick: number;
  seq: number;
  kind: 'down' | 'interrupt' | 'deathward' | 'rally' | 'captain-down' | 'handover' | 'overtime' | 'call' | 'end';
  unit: UnitIndex | null;
  target: UnitIndex | null;
  ability: AbilityId | null;
}

/** The committed decision of a unit at a tick, from the recorded `unit.decide` trace (inspector "why this"). */
export interface DecisionSnapshot {
  unit: UnitIndex;
  /** Rule index; ruleCount = stance; -1 = forced (taunt). */
  rule: number;
  action: string;
  targetUnit: UnitIndex | null;
  /** Tick the decision committed (the trace was evaluated reactTicks earlier). */
  commitTick: number;
  reactTicks: number;
  reactCauses: readonly string[];
  /** The rule trace as recorded (skip reasons, observed values, ready-in ticks). */
  trace: readonly RuleTraceEntry[];
}

// ---- Camera (04 §4 working assumption; configurable because the owner has not chosen the angle) ----------

export type Projection = { kind: 'top-down' } | { kind: 'oblique'; tiltDeg: number };

export interface CameraConfig {
  /** M2: top-down orthographic (04 §4, P-03; owner answer to Q55). Oblique = a 3/4 view (art §12 Q4), y squashed by cos(tilt). */
  projection: Projection;
  /** 1 = the whole arena fits (04 §4: never scrolls at default zoom). M2 ships 1 (owner answer to Q55); 1.5 and 2 come with the sprite decision. */
  zoom: 1 | 1.5 | 2;
  /** Follow a unit when zoomed (with the sprite decision, Q55); null = centred, the M2 setting. */
  follow: UnitIndex | null;
  /** Margin around the arena, CSS px (the HUD strips are DOM over the canvas, 04 §4: 56 px top, 72 px bottom). */
  padding: { top: number; right: number; bottom: number; left: number };
  /** Zoom ease (04 §4: 220 ms; 0 under reduced motion). Speed changes never move the camera. */
  easeMs: number;
}

/** The signature of src/render/camera viewTransform (injectable into the viewer, §A19). */
export type ViewTransformFn = (
  camera: CameraConfig,
  viewport: { width: number; height: number },
  arenaCm: { width: number; height: number },
  focusCm?: { x: number; y: number } | null,
) => ViewTransform;

/** World (cm) to screen (CSS px) for one viewport: pure, so hit-testing and tests share it with the scene. */
export interface ViewTransform {
  /** CSS px per metre at the current zoom (about 52 at 1920 × 1080, 04 §4). */
  pxPerMetre: number;
  toScreen(xCm: number, yCm: number, heightCm?: number): { x: number; y: number };
  toWorld(xPx: number, yPx: number): { x: number; y: number };
}

// ---- Palette (resolved from tokens.css by the viewer host, so colours have one source) ----------------

/** Colours the arena needs, read from tokens.css custom properties for the current theme (04 §3). */
export interface ArenaPalette {
  theme: 'dark' | 'light';
  /** --c-side-us, --c-side-them (asset-006). */
  sideUs: number;
  sideThem: number;
  /** --c-role-* (D-J): used only for role glyphs, never for other meanings. */
  roles: Readonly<Record<RoleId, number>>;
  /** The --glyph-* tokens decoded to SVG markup (D-J shapes: shield, diamond, triangle, hourglass, circle with a cross): one source for UI and arena. */
  roleGlyphSvg: Readonly<Record<RoleId, string>>;
  text: number;
  textMuted: number;
  /** Arena floor (04 §5 "a flat sand-and-stone floor at a mid value"; designer token request, §A9). */
  floor: number;
  wall: number;
  good: number;
  bad: number;
  warn: number;
  /** Hit tones (designer token request: physical, arcane). */
  fxPhysical: number;
  fxArcane: number;
  // ---- Added by the M2 design review (05-technical-m2 §A18; tokens.css arena group, mockups/arena-notes.md §2, §3).
  // The UI host reads them from computed style once per theme, motion or interface-scale change. ----
  /** --c-arena-plate: the role-glyph plate, bar tracks, pip chips, label chips and keylines (every overlay sits on it). */
  plate: number;
  /** --c-arena-ink: text on the plate (labels, numbers' fill on the plate stroke). */
  ink: number;
  /** --c-arena-edge: hairline around bar tracks (the track alone is under 3:1 on the floor). */
  edge: number;
  /** --c-arena-line: centre line and row markers (faint on purpose). */
  line: number;
  /** --c-arena-hp: the HP fill, neutral (no red or green meaning). */
  hp: number;
  /** --c-arena-track: the bar track. */
  track: number;
  /** --c-arena-shield: the shield segment (drawn hatched, after the HP fill). */
  shield: number;
  /** --c-arena-focus: the thin focus bar. */
  focus: number;
  /** --c-arena-select: the selection corner brackets (= --c-focus). */
  select: number;
  /** --c-arena-telegraph: telegraph progress fill and the cast bar (the area itself takes the caster's ring colour). */
  telegraph: number;
  /** --c-arena-hit-flash: the hit wash on a body. */
  hitFlash: number;
  /** --c-fx-true, --c-fx-heal (follows the status-palette option), --c-fx-shield: the other hit and gain tones. */
  fxTrue: number;
  fxHeal: number;
  fxShield: number;
  /** --c-pip-* per pip kind (special = --c-arena-ink): the pip glyph and its chip outline. */
  pipColor: Readonly<Record<PipKind, number>>;
  /** The --glyph-pip-* tokens decoded to SVG markup, like roleGlyphSvg. */
  pipGlyphSvg: Readonly<Record<PipKind, string>>;
  /** The numeric --arena-* tokens. */
  metrics: ArenaMetrics;
}

/**
 * The UI designer's status pip kinds (tokens.css data-pip). A status shows the pip of its category: cc_hard
 * control-hard, cc_soft control-soft, buff, debuff, dot, hot, special; the shield category has none (the bar segment).
 */
export type PipKind = 'buff' | 'debuff' | 'control-hard' | 'control-soft' | 'dot' | 'hot' | 'special';

/**
 * The numeric --arena-* tokens, converted by the host: px and ms as numbers, unitless as numbers, rem sizes
 * measured once in CSS px (so --ui-scale reaches the canvas). Values under reduced motion are the reduced ones
 * (hitFlashMs, pulseMs, easeMs and numberRisePx are 0); fxFadeMs stays (numbers fade in place).
 */
export interface ArenaMetrics {
  /** --arena-ring-w: the player's solid side ring, CSS px at any zoom. */
  ringWidthPx: number;
  /** --arena-ring-line: each line of the opponent's double ring. */
  ringLinePx: number;
  /** --arena-ring-gap: the gap of the double ring and the plate keylines. */
  ringGapPx: number;
  /** --arena-down-opacity (asset-006: 0.4). */
  downOpacity: number;
  /** --arena-zone-alpha: zone floor disc in the owner's ring colour. */
  zoneAlpha: number;
  /** --arena-telegraph-fill, -edge, -progress. */
  telegraphFillAlpha: number;
  telegraphEdgeAlpha: number;
  telegraphProgressAlpha: number;
  /** --arena-hit-flash-alpha, --arena-hit-flash-ms. */
  hitFlashAlpha: number;
  hitFlashMs: number;
  /** --arena-flash-limit: flashes a second per fighter, at any speed (04 §9). */
  flashLimitPerSecond: number;
  /** --arena-fx-fade-ms: an effect is gone within this at 1x. */
  fxFadeMs: number;
  /** --arena-number-merge-ms: at most one floating number per fighter per window. */
  numberMergeMs: number;
  /** --arena-number-rise, measured. */
  numberRisePx: number;
  /** --arena-pulse-ms: the rule badge pulse. */
  pulseMs: number;
  /** --arena-ease-ms: the camera ease. */
  easeMs: number;
  /** --arena-label-size, --arena-pip-size, --arena-bar-h, measured. */
  labelSizePx: number;
  pipSizePx: number;
  barHeightPx: number;
}

/** A club's two colours from clubs.json (`colors.primary`, `colors.secondary`) as 0xRRGGBB. */
export interface ClubColors {
  primary: number;
  secondary: number;
}

// ---- Cues (data-driven from content; 05-technical-m2 §A5, tech-021) -------------------------------------

/** How one ability reads in the arena, derived from its definition (delivery, area, effects, timing). */
export interface AbilityCue {
  ability: AbilityId;
  /** Shown during the windup/cast when it lasts ≥ 0.3 s (04 §7), or for every area ability. */
  telegraph: { shape: 'circle' | 'cone' | 'line' | 'single'; sizeCm: number; spread: number; minTicks: number } | null;
  /** What the release draws. Never 'none' for an active ability (84 in content/default, tested); 'none' only for passives. */
  release: 'swing' | 'beam' | 'projectile' | 'dash-trail' | 'area-flash' | 'self-pulse' | 'none';
  /**
   * One cue per effect of the ability, nested effects included (chain, splash, zone, onKill), from an exhaustive
   * switch over AbilityEffectType: a new effect type fails to compile until it has a cue.
   */
  effects: readonly { type: AbilityEffectType; cue: EffectKind }[];
  /** Projectile glyph (readable minimum size, research A4.2: no tiny projectiles). */
  projectile: { sizePx: number } | null;
  /** Dominant tone of its hits. */
  tone: 'physical' | 'arcane' | 'true' | 'heal' | 'shield' | 'neutral';
  /** It applies hard control (stun, sleep, taunt, silence, knockback, pull): a stronger cue. */
  control: boolean;
}

/** How one status reads (icon pip above the HP bar, ring state on the token). */
export interface StatusCue {
  status: string;
  category: string;
  /** Icon id in the arena icon set (placeholder: a glyph per category). */
  icon: string;
  /** Token ring treatment: grey for hard control (asset-006 "stunned (grey ring)"). */
  ring: 'grey' | 'pulse' | 'none';
  /** Higher shows first when space is short (at most 4 pips). */
  priority: number;
  /** Added by the M2 design review (§A18): the pip this status shows (its category's), or null for the shield category. */
  pip: PipKind | null;
}

export interface CueTable {
  ability(id: AbilityId): AbilityCue;
  status(id: string): StatusCue;
}

// ---- Viewer additions (contract amendment for integration, 05-technical-m2 §A19) ---------------------------------
// Implemented by WP-M2D. src/render/viewer's ArenaViewerOptions and ArenaViewer carry them (extending these at
// integration), so src/ui needs no cast.

/** Optional ArenaViewerOptions fields; every default is the real module. */
export interface ArenaViewerOptionExtras {
  /** The cue table (default: buildCueTable(content)); a caller may cache one per content hash and pass it. */
  cues?: CueTable;
  /** The world-to-screen transform (default: src/render/camera viewTransform); tests and the dev harness inject one. */
  viewTransform?: ViewTransformFn;
  /**
   * Make the canvas one tab stop (default true: tabindex 0, role img, a label rewritten at each pause). Keyboard
   * selection belongs to the fighter strip (§A18 decision 3), never to the canvas; pass false when the host element
   * is the tab stop instead.
   */
  tabStop?: boolean;
}

/** An optional ArenaViewer method; the UI uses it when present ("Rules fired so far" in the inspector). */
export interface ArenaViewerDecisionHistory {
  /**
   * The unit's committed decisions from round start, oldest first, up to and including `tick` (default: the current
   * tick), never past headTick: a live round reveals nothing beyond what has been shown. Each entry is the shape
   * decisionAt returns (the recorded `unit.decide`), so a count by `rule` gives the fires so far.
   */
  decisionsUpTo?(unit: UnitIndex, tick?: number): readonly DecisionSnapshot[];
}

// ---- Diagnostics -----------------------------------------------------------------------------------------

export interface ViewerStats {
  fps: number;
  /** CPU time of our per-frame work (sampling + scene update), ms. */
  frameMsP50: number;
  frameMsP95: number;
  drawCalls: number | null;
  renderer: 'webgl' | 'webgpu' | 'canvas' | 'none';
  resolution: number;
}
