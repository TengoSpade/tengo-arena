import { formatContentIssues, loadContent, type ContentDB } from '../../src/core/content';
import { loadRawContentFromDisk } from './node-content';

/** Load and validate a theme for a CLI; prints issues and exits with code 1 on errors. */
export function loadThemeOrExit(themeId: string): ContentDB {
  const disk = loadRawContentFromDisk(themeId);
  if (disk.errors.length) {
    console.error(`content/${themeId}: JSON errors\n  ${disk.errors.join('\n  ')}`);
    process.exit(1);
  }
  const result = loadContent(themeId, disk.raw);
  if (!result.ok) {
    console.error(`content/${themeId} is invalid:\n${formatContentIssues(result.error)}`);
    process.exit(1);
  }
  if (result.value.warnings.length) console.warn(formatContentIssues(result.value.warnings));
  return result.value;
}
