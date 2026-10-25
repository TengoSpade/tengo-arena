# src/platform — environment adapters

**Owner:** WP6 (UI foundation); packaging (M7) later. **Status:** browser implementations done.

| File | Purpose |
| --- | --- |
| `content-loader.ts` | Bundle `content/<theme>/*.json` via `import.meta.glob`. |
| `save-store.ts` | Contracts: `SaveStore`, `Clock`, `FileIO`, `AUTOSAVE_SLOTS`, `MANUAL_SLOT_COUNT` (fixed). |
| `save-store.idb.ts` | `createIdbSaveStore()`: one record per slot `{ slotId, meta, json }`, one readwrite transaction per write (a failed write never replaces the previous record); the list reads metas only, so unreadable saves stay listed. |
| `save-store.memory.ts` | `createMemorySaveStore()`: tests and the fallback without IndexedDB; `failNextWrite()` simulates an interrupted write. |
| `browser.ts` | `browserFileIO` (download / read a Blob), `browserClock`, `browserEntropy()` (crypto.getRandomValues, 4 words). |
| `settings-storage.ts` | The player settings record in localStorage (outside saves, 05 §5). |

Rules: may import core module indexes, never `src/ui` or `src/render`. Platform code holds no game state. Known gap: the IndexedDB store has no automated test (happy-dom has no IndexedDB and no new dev dependency was added); it was exercised in the browser (autosave rotation, quick save).
