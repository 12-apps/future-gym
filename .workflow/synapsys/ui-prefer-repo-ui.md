---
name: ui-prefer-repo-ui
description: "@12-apps/ui already ships VirtualList, CommandPalette, CodeEditor, DataGrid, Toast and Sidebar — don't add a library or hand-roll one"
events: PreToolUse
trigger_pretool: Edit:"file_path":"[^"]*\.tsx,Write:"file_path":"[^"]*\.tsx,Edit:"file_path":"[^"]*package\.json,Write:"file_path":"[^"]*package\.json
trigger_pretool_content: react-window,react-virtualized,@tanstack/react-virtual,\bcmdk\b,\bkbar\b,monaco,codemirror,@mui/x-data-grid,ag-grid,react-table,react-toastify,notistack,import\s+\{[^}]*\b(Drawer|Snackbar)\b,component="select",<select[\s>],role="(listbox|menu|menuitem|combobox|dialog|tab)"
trigger_pretool_content_not: from\s+['"]@12-apps/ui['"]
trigger_session: false
inject: full
---

### `@12-apps/ui` already has this — check before adding a dependency

You are reaching for a library (or an MUI primitive) that duplicates a
component the design system already ships. Import from `@12-apps/ui` instead:

| you reached for | use instead | lives at |
|---|---|---|
| `react-window`, `react-virtualized`, `@tanstack/react-virtual` | **VirtualList** | `src/components/data-display/VirtualList` |
| `cmdk`, `kbar` | **CommandPalette** | `src/components/navigation/CommandPalette` |
| `monaco`, `codemirror` | **CodeEditor** | `src/components/form/CodeEditor` |
| `@mui/x-data-grid`, `ag-grid`, `react-table` | **DataGrid** | `src/components/data-display/DataGrid` |
| `react-toastify`, `notistack`, MUI `Snackbar` | **Toast** | `src/components/feedback/Toast` |
| MUI `Drawer` | **Sidebar** | `src/components/navigation/Sidebar` |

### Where the catalog actually is

**There is no `packages/ui` in this repo.** The library is the published
`@12-apps/ui`, pinned in `pnpm-workspace.yaml`'s `catalog:`, and its docs ship
inside the package — so they are under `node_modules` and present after any
install:

- Full inventory: `node_modules/@12-apps/ui/components-catalog.md`
- Writing/consuming rules: `node_modules/@12-apps/ui/components-guidelines.md`
- Per-component API: `node_modules/@12-apps/ui/src/components/<category>/<Component>/<Component>.md`

If the existing component genuinely can't do what you need, extend it in
`12-apps/shared-packages` and bump the catalog pin — a second library for the
same job is how the catalog stops being the source of truth. Editing it "here"
is not an option; this repo only consumes it.

### Hand-rolling counts, not just adding a dependency

This memory used to watch only for a COMPETING LIBRARY — `react-window`,
`cmdk`, `monaco`, `ag-grid`. That misses the way it actually goes wrong, which
is rebuilding a component out of `Box` + `sx` and never importing anything a
trigger could see.

FUT-786 did exactly that to the storefront's filter rail: a `Box` styled into a
pill with a transparent native `<select>` laid over it, its own geometry
function, its own focus ring. `MultiSelectDropdown` (`layout="pill"`) already
existed and is what the admin's Produtos list filters with. Five more went the
same way — `Card`, `StatCard`, `Avatar`, `Badge`, `Separator` — and every
hand-typed pixel size turned out to be a stop on the design system's own scale
(24, 40, 48 are `xs`, `md`, `lg`). Nothing fired, because nothing was added.

So the trigger now also watches for the tells of a hand-built control: a native
`<select>` in a `.tsx`, and `role="listbox|menu|menuitem|combobox|dialog|tab"`.
If you are writing one of those, **read the catalog first** — a design-system
component almost certainly does it, themed, accessible, and moving when the
system moves.

The other half of that failure was that the three paths above pointed at a
directory that no longer exists (FUT-1113), so the catalog could not be read
even by someone who went looking.
