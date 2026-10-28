/** The vis-003 kit's shared shapes (01 §6 vis-003: observers watch 5 fights at 1x and name both sides' tank and healer and the cause of each down). */

export type SideNo = 0 | 1;

export interface KeyUnit {
  unit: number;
  side: SideNo;
  fighterId: string;
  /** What the strip shows for the fighter (full name when known, else the class name). */
  name: string;
  /** The class's display name, e.g. "Knight". */
  className: string;
  /** Archetypes of the class (D-J roles); two for a hybrid. */
  roles: string[];
}

export interface KeyDown {
  /** 1-based, in order of occurrence. */
  index: number;
  tick: number;
  seconds: number;
  victim: number;
  /** The unit that struck the last blow, or null (status, zone or other damage with no unit). */
  killer: number | null;
  ability: string | null;
  abilityName: string | null;
  assists: number[];
}

/** The answer key of one fight, from its fight log. Never shown to observers. */
export interface FightKey {
  /** 1-based number within the run. */
  fight: number;
  fixtureId: string | null;
  round: number;
  /** The player's side (solid brass rings), or null when unknown. */
  ourSide: SideNo | null;
  clubNames: [string, string];
  units: KeyUnit[];
  /** Units holding the role, per side: [side 0, side 1]. Empty = the side has none. */
  tanks: [number[], number[]];
  healers: [number[], number[]];
  downs: KeyDown[];
  winnerSide: SideNo | null;
  durationTicks: number;
  logHash: string;
}

export type PromptKind = 'tank' | 'healer' | 'down';

export interface Prompt {
  /** tank.us, tank.them, healer.us, healer.them, down.<n>. */
  id: string;
  kind: PromptKind;
  /** The side asked about (tank, healer) or the victim's side (down). */
  side: SideNo;
  /** down only: the victim, to find the moment. */
  victim?: number;
  text: string;
}

/** One observer's answers: fight number to prompt id to free text. */
export interface ObserverAnswers {
  observer: string;
  fights: Record<string, Record<string, string>>;
  notes?: string;
}

export interface PromptResult {
  fight: number;
  prompt: string;
  kind: PromptKind;
  answer: string;
  correct: boolean;
  /** Why, in a few words (for the score report). */
  why: string;
  /** down prompts: whether the ability was named too (reported, counted only when strict). */
  abilityNamed?: boolean;
}

export interface ScoreSummary {
  observer: string;
  correct: number;
  total: number;
  rate: number;
  byKind: Record<PromptKind, { correct: number; total: number }>;
  byFight: { fight: number; correct: number; total: number }[];
  /** vis-003's bar: at least 90% of prompts. */
  pass: boolean;
  unanswered: number;
}

/** The visible DOM at a capture: text, live regions, and role glyph carriers with the text of their row. */
export interface ScreenEvidence {
  text: string;
  live: string[];
  roles: { role: string | null; aria: string | null; row: string }[];
  canvasLabel: string | null;
}

/** A frame captured while a fight played at 1x. */
export interface Capture {
  index: number;
  tick: number;
  /** Why this frame: spawn, periodic, before-down, down, after-down, end. */
  reason: string;
  /** Path relative to the packet folder. */
  file: string;
  /** What was on screen as text and structure at the same moment (the DOM evidence of the pre-check). */
  evidence: ScreenEvidence | null;
}
