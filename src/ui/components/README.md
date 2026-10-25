# ui/components

**Owner:** WP6 (UI foundation). **Status:** M1 set implemented, tested (`components.test.tsx`). **API stable:** additive changes only from the first commit; WP7 builds on these.

Reusable Preact components that render the UI designer's classes (`src/ui/styles/components.css`) unchanged. No game logic: callers pass content-derived values. Import from `../../components` (the index).

| Component | Purpose / key props |
| --- | --- |
| `DataTable<R>` | `.data-table` with `columns` (`id`, `header`, `cell`, `sortValue`, `align: 'num'`, `fill`, `class: 'col-wide' / 'col-mid'`, `cellAttrs`), `rows`, `rowKey`, `label`; sort by header (`aria-sort`, remembered with `sortKey`), ↑ ↓ / Home / End selection (`selectedKey`, `onSelect`), Enter / double-click `onOpen`, `onKey` for screen keys, `empty`, `variant: ['compact' / 'dense' / 'zebra']`, `rowClass`, `rowAttrs` (e.g. `data-zone`) |
| `Panel` | `.panel`: `title`, `icon`, `subtitle`, `actions`, `headerExtra`, `footer`, `hero`, `body: 'default' / 'tight' / 'flush' / 'none'`, `span` |
| `PageHeader` | eyebrow, display title, `meta[]` (joined with `.sep-dot`), `actions`, `before` (breadcrumbs) |
| `StatBar` | 1-20 attribute bar: `value`, `cap` (ceiling tick), `peak` (wear hatch), `max` (M4 range), `delta`, `tip` |
| `Tag` | `.tag` with `kind` good / bad / warn / info / accent / outline, `icon`, `tip` |
| `Money` | "11,840 ts" (D-K): `amount`, `signed`, `perWeek`, `unit`, `tone`, `tip` |
| `FighterName` | portrait + name link + C / VC + rookie tag: `name`, `href`, `role`, `race`, `injured`, `captain`, `sub` |
| `ClassTag` | role glyph(s) + class name; hybrids get both glyphs and a tooltip |
| `Modal` | native `<dialog>`: `open`, `onClose` (Esc, backdrop), `title`, `icon`, `size`, `footer`, `footerNote`, `onEnter` |
| `Toast` | `showToast({ title, sub, kind, undo, action })`, `ToastRegion`, `undoLast()` (Ctrl Z), max 3, 5 s / 8 s with Undo |
| `Tabs` / `TabPanel` | `role="tab"` with ← → / Home / End and roving tabindex; `idPrefix` links tab and panel |
| `ConfirmButton` | commit dialog for BINDING actions only (D-M): `title`, `consequences[]`, `warning`, `confirmLabel` ("Release for 10,620 ts"), `onConfirm`, `disabled` + `disabledReason` |
| Tooltips | `tipAttrs(tip)` on any element (`string` or `{ kicker, title, body, rows, flavor, meta }`); one `TooltipLayer` in the app frame: 280 ms hover, focus at once, Shift pins, Esc closes |
| `marks.tsx` | `Crest` (luminance rim rule), `Portrait`, `RoleGlyph`, `RoleBadge`, `Rating`, `Stars`, `TraitBadge`, `TraitDots`, `traitPolarity`, `CaptainMark`, `ViceCaptainTag`, `RowMark`, `CapMeter`, `Meter`, `Progress`, `FormStrip`, `Delta`, `Segmented`, `Chip`, `Kbd`, `Empty`, `Callout` |
| `Icon` | `.icon[data-icon]` from the designer's 65 icons |

Formatting (money, bands, stars, percentages, ticks) lives in `src/ui/format`. The dev gallery is at `#/dev/components` (dev builds).
