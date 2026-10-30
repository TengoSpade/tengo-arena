/** One content problem, precise enough for a designer to fix without reading code. */
export interface ContentIssue {
  /** File name with extension, e.g. "classes.json". */
  file: string;
  /** JSON path inside the file, e.g. "classes[12].abilities.a1". Empty for whole-file problems. */
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

/** "classes.json › classes[12].abilities.a1: unknown ability "x"" — one line per issue, errors first. */
export function formatContentIssues(issues: readonly ContentIssue[]): string {
  const sorted = [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  return sorted
    .map((i) => `${i.severity === 'error' ? 'ERROR' : 'warn '} ${i.file}${i.path ? ` › ${i.path}` : ''}: ${i.message}`)
    .join('\n');
}

/** Convert a zod issue path to the "a[1].b" form used in ContentIssue.path. */
export function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else out += out ? `.${String(part)}` : String(part);
  }
  return out;
}
