# ui/components

**Owner:** UI foundation agent (M1 wave 1). **Status:** not started.

Reusable Preact components that render the UI designer's classes (`src/ui/styles/components.css`). Priority for M1: `DataTable` (sortable, sticky header, keyboard row navigation, column config, empty state; virtualize only above ~300 rows), `Panel`, `PageHeader`, `StatBar`, `Tag`, `Money`, `FighterName`, `ClassTag`, `Modal`, `Toast`, `Tabs`, `ConfirmButton`.

Each component: typed props, no game logic, a `*.test.tsx`, and an entry in a dev-only gallery screen (`#/dev/components`) so the UI designer can review them.
