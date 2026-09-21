# MySQL 连接列表页 Design QA

- Source visual truth: `C:\Users\y00013075\.codex\generated_images\01a0be23-9fae-7eb1-a835-706cd61a971f\exec-ae835694-eaee-4ffa-a945-40b27d408021.png`
- Implementation screenshot: `D:\AWorks\code\fouc\design-qa-mysql-implementation.png`
- Browser: Codex in-app browser, `http://127.0.0.1:3001/`
- CSS viewport: 1488 × 1058 px
- Source pixels: 1487 × 1058 px
- Implementation pixels: 1487 × 968 px
- Device pixel ratio: 1
- Density normalization: both images were inspected at 1×. The implementation evidence uses the top 1487 × 968 px content crop because the remaining 90 px in the source is empty canvas and contains no UI.
- State: light theme, main navigation expanded, Connectors selected, MySQL provider open, all filters at their default values.

## Full-view comparison evidence

The source and implementation were placed together in one browser comparison surface before review. The implementation preserves the source composition: existing Fouc rail and navigation, breadcrumb, single MySQL provider header, one primary create action, one horizontal filter row, one continuous five-row table, and the connection count below it. It does not introduce a connection detail pane, SQL editor, schema tree, workbench preview, AI panel, dashboard cards, or unrelated capability advertising.

The existing Fouc navigation shell is intentionally retained at its production width instead of copying the slightly wider shell synthesized by ImageGen. The main-page proportions, content padding, title hierarchy, toolbar distribution, table width, and whitespace match the selected direction without modifying global navigation behavior.

## Focused region comparison evidence

A second side-by-side comparison showed the source and implementation at 1× with the upper content region cropped to the breadcrumb, provider heading, filters, and table. The connection-name, environment, address, and database baselines align consistently. Header height and five row heights reproduce the source density. The first implementation pass placed the toolbar and table about 20 px too low; the provider header and vertical gaps were reduced, then recaptured. The final screenshot shows the corrected placement.

## Required fidelity surfaces

- Fonts and typography: Uses the existing Fouc UI font stack. The 30 px semibold provider title, 13 px connection names, compact secondary tags, 11–12 px table copy, and tabular address/time values reproduce the target hierarchy without wrapping or truncation at the reference width.
- Spacing and layout rhythm: The page uses 28 px horizontal padding, a 70 px provider mark, 40 px filter controls, a 48 px table header, 78 px rows, 12 px column gaps, and lightweight separators. No nested cards or per-row card shadows are present.
- Colors and visual tokens: Existing panel, surface, line, ink, accent, focus, success, warning, and error tokens are used. Environment dots and state pills are limited to semantic color. Light-theme foreground and border contrast remain consistent with Fouc.
- Image and icon fidelity: The page reuses the repository's real MySQL SVG and Phosphor icon family. No inline SVG, CSS drawing, emoji, placeholder, generated raster icon, or approximate brand asset is used.
- Copy and content: Breadcrumb, title, helper copy, filters, headers, five connection records, statuses, timestamps, actions, and footer count match the selected mock's content.
- Responsiveness: At narrower desktop widths the table remains usable through horizontal overflow rather than collapsing columns or merging list and detail content. The selected 1488 px viewport shows every source column and row action.
- Accessibility: Search and filters are labeled; the table exposes a named list; rows are keyboard-openable; favorites expose pressed state; status is not color-only; dropdown and modal controls retain visible focus rings.

## Interaction verification

1. Navigated through `连接器 → MySQL` and confirmed the standalone list page rendered in the existing Fouc shell.
2. Entered `订单` in search and confirmed the list and footer count reduced from five connections to one, then cleared the query and confirmed all five returned.
3. Opened `新建连接` and confirmed the modal exposes connection name, host, port, database, environment, cancel, close, and create controls.
4. Activated the first row's `测试` action and confirmed its disabled `测试中` state, followed by successful completion.
5. Confirmed environment, status, and sort controls expose dropdown semantics; favorite, overflow, and full-row entry affordances are independently accessible.
6. Checked browser console warnings and errors after navigation and interactions: none.
7. Ran TypeScript type checking and ESLint with zero errors and zero warnings.

## Comparison history

### Pass 1

- Finding [P2]: Connection rows included a repeated MySQL logo that was not present in the selected source and compressed the name column.
- Fix: Removed the row-level brand mark, leaving the provider-level MySQL asset in the header and restoring the source's star-plus-name hierarchy.
- Evidence: The final focused comparison shows name and tag beginning directly after the favorite column, matching the source.

### Pass 2

- Finding [P2]: The enlarged provider header pushed the filter row and table about 20 px below the source positions.
- Fix: Restored the original 20 px top and section gaps with a 76 px header footprint while retaining the clearer 70 px provider mark and 30 px title.
- Evidence: The final screenshot aligns the toolbar and table with the selected mock and preserves all five visible rows.

## Findings

No actionable P0, P1, or P2 visual differences remain. The only intentional difference is the unchanged production Fouc navigation width and the repository's official MySQL brand color, both of which are product-system constraints rather than page-level drift.

## Follow-up polish

No required visual follow-up. Backend persistence and the separate connection workbench are outside this list-page implementation scope.

final result: passed
