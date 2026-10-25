/**
 * A rule as a sentence with small-caps keywords (04 §1 signature motif:
 * `IF … THEN … ON …`, components.css `.rule`). Takes display parts built
 * by src/ui/format/rules.ts from the content vocabulary.
 */
import { Fragment } from 'preact';

export interface RuleLineParts {
  id: string;
  conditions: readonly string[];
  action: string;
  target: string;
  only?: string | null;
  prefer?: string | null;
}

export function RuleLine({ parts, preset = true }: { parts: RuleLineParts; preset?: boolean }) {
  return (
    <span class="rule">
      <span class={`rule__id${preset ? ' rule__id--preset' : ''}`}>{parts.id}</span> <span class="rule__kw">If</span>{' '}
      {parts.conditions.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && <span class="rule__kw"> and </span>}
          <span class="rule__v">{c}</span>
        </Fragment>
      ))}{' '}
      <span class="rule__kw">then</span> <span class="rule__v">{parts.action}</span> <span class="rule__kw">on</span> <span class="rule__v">{parts.target}</span>
      {parts.only && (
        <>
          {' '}
          <span class="rule__kw">only</span> <span class="rule__v">{parts.only}</span>
        </>
      )}
      {parts.prefer && (
        <>
          {' '}
          <span class="rule__kw">prefer</span> <span class="rule__v">{parts.prefer}</span>
        </>
      )}
    </span>
  );
}
