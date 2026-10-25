# core/content

**Owner:** content agent (M1 wave 1). **Status:** placeholder types only; implementation starts in phase B when the designers' schemas land.

## Responsibility
- zod schemas for every file in `content/<theme>/` (`CONTENT_FILE_NAMES`), with content types inferred from them.
- Cross-file reference validation (every `abilityId` in classes.json exists in abilities.json, every preset references known vocabulary, ...).
- `ContentDB`: frozen, indexed registries (`byId` maps plus ordered lists) used by every other module.
- `hashContent(raw)` = `hashString(stableStringify(raw))`, stored in `GameState.content.hash`, saves and fight headers.
- Clear errors: `ContentIssue { file, path, message }` collected (not first-error-only) and formatted for the UI error screen and the CLI.

## Public API (planned)
```ts
loadContent(themeId: string, raw: RawContentFiles): Result<ContentDB, ContentIssue[]>
hashContent(raw: RawContentFiles): string
formatContentIssues(issues: readonly ContentIssue[]): string
```

## Rules
- Pure: no file or network IO. Loaders live outside core (`src/platform/content-loader.ts` for the browser, `scripts/lib/node-content.ts` for Node) and pass raw JSON in.
- No defaults that hide authoring mistakes: missing required fields are errors. Optional fields get documented defaults in the schema.
- No theme strings in code; all names come from the JSON.

Depends on: `util`, `model` (and npm `zod`). Tests: valid minimal fixture theme, one failing fixture per error class, the shipped `content/default` passes.
