# MySQL connection list design QA

- Source visual truth path: task-attached Browser Comment screenshots 1–6 (1682 × 960 px).
- Implementation screenshot path: Codex in-app Browser inline capture from `http://127.0.0.1:3001/` in this task.
- Viewport: 1682 × 960 CSS px, device scale factor 1.
- Source pixels: 1682 × 960. Implementation pixels: 1682 × 960. No density normalization required.
- State: MySQL connection list with five mock connections and default filters.

## Full-view comparison evidence

The six annotated source screenshots and revised browser capture were compared at the same viewport. The revision preserves the existing Fouc shell and compact connection-list structure while tightening the exact annotated controls and adding requested table information.

## Focused region comparison evidence

- Header actions: create and more controls are now 28px circles; create is an outlined accent control.
- Breadcrumb: back-control-to-breadcrumb gap is 4px and breadcrumb segment gap is 2px.
- Toolbar: status precedes a fixed 280px search field; project, environment, and sort are 118/96/100px.
- Table: added `项目` and `用户` columns without increasing the 60px row height or restoring side borders.

## Required fidelity surfaces

- Fonts and typography: existing Fouc type scale and optical weights remain unchanged; compact controls keep 10px labels fully visible.
- Spacing and layout rhythm: reduced control widths and breadcrumb gaps remove the loose horizontal rhythm called out in annotations.
- Colors and visual tokens: outlined create action uses existing accent, panel, line, ink, muted, and semantic status tokens.
- Image quality and asset fidelity: official MySQL logo asset remains unchanged and correctly scaled.
- Copy and content: the connection table now exposes project ownership and database username with realistic mock values.

## Comparison history

### Pass 1 — blocked

- P2: header action buttons were oversized and the create action was filled.
- P2: breadcrumb slash spacing was too loose.
- P2: filter and search widths were too large; status was positioned after search.
- P2: the table omitted useful project and credential-identity context.

Fixes made: reduced both header controls to 28px, changed create to outlined styling, tightened breadcrumb gaps, moved status before search, reduced all toolbar widths, and added project/user data columns.

### Pass 2 — blocked

- P2: the compact status and sort controls truncated their default labels because the sort icon consumed horizontal space.

Fixes made: removed the redundant toolbar sort icon and rebalanced the status/sort controls to 100px each.

### Pass 3 — passed

The final 1682 × 960 browser capture shows complete filter labels, compact outlined actions, tighter breadcrumbs, and all ten table columns without clipping. Interaction checks confirmed username search (5 → 1), healthy-status filtering (5 → 3), new-connection dialog opening, and filter reset. Browser console warnings/errors: none.

## Findings

No actionable P0, P1, or P2 differences remain against the six requested annotations.

## Remaining risk

- Project and username values remain mock data until backend persistence is connected.
- The dense table intentionally uses horizontal scrolling below its 1160px minimum width.

final result: passed
