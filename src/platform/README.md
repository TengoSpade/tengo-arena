# src/platform — environment adapters

**Owner:** save/platform agent (M1), packaging agent (M7). **Status:** content loader only (phase A).

Everything that touches the outside world and is NOT game logic:

| File (planned) | Purpose |
| --- | --- |
| `content-loader.ts` | Bundle `content/<theme>/*.json` via `import.meta.glob` (done). |
| `save-store.ts` | `SaveStore` interface: `list()`, `read(slotId)`, `write(slotId, json)`, `remove(slotId)`. |
| `save-store.idb.ts` | IndexedDB implementation (browser); one transaction per write; rotating autosaves. |
| `save-file.ts` | Export a save to a `.json` file download; import from a file picker. |
| `clock.ts` | Wall-clock time for `SaveMeta.savedAt` and playtime (core has no clock). |
| `entropy.ts` | New-game seeds from `crypto.getRandomValues` -> `seedFromEntropy()`. |
| `desktop/` (M7) | Electron preload bridge: file-system saves, Steamworks. |

Rules: may import core module indexes (`core/save`, `core/model`, ...), never `src/ui` or `src/render`. Platform code holds no game state.
