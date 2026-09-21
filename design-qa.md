# MySQL connection list design QA

- Source visual truth path: task-attached Browser Comment screenshots 1–4 (1682 × 960 px).
- Implementation screenshot path: Codex in-app Browser inline captures from `http://127.0.0.1:3001/` in this task.
- Viewport: 1682 × 960 CSS px, device scale factor 1.
- Source pixels: 1682 × 960. Implementation pixels: 1682 × 960. No density normalization required.
- State: MySQL connector connection list, five mock connections, default filters; an additional focused-search capture verifies focus treatment.

## Full-view comparison evidence

The annotated source screenshots and the revised browser capture were reviewed together at the same viewport. The revised implementation now has the requested persistent connector-detail header, compact provider summary, split filter toolbar, borderless-side table, and compact rows. The global Fouc shell is unchanged.

## Focused region comparison evidence

- Top navigation: 42px connector-detail header with a visible back icon and `连接器 / MySQL` breadcrumb.
- Provider summary: 58px content header, 48px logo tile, 22px title, circular create and more controls.
- Filter toolbar: search and status on the left; project, environment, and sort on the right.
- Focus state: search focus uses only an accent border; the browser capture shows no focus shadow.
- Table: 38px header, 60px rows, horizontal rules only, no left or right outer border.

## Required fidelity surfaces

- Fonts and typography: preserved the Fouc application font stack and reduced title/table sizing to match the denser connector-detail hierarchy.
- Spacing and layout rhythm: header, provider summary, toolbar, and table now use a compact 42/58/32/38/60px rhythm.
- Colors and visual tokens: all surfaces use existing Fouc panel, line, accent, ink, muted, and semantic status tokens.
- Image quality and asset fidelity: retained the existing official MySQL logo asset at its native aspect ratio; no generated or CSS-drawn replacement.
- Copy and content: retained the five connection records and added the requested `全部项目` filter with product-consistent project names.

## Comparison history

### Pass 1 — blocked

- P1: breadcrumb was embedded in page content and had no explicit back icon.
- P2: toolbar was a single undifferentiated row and lacked project filtering.
- P2: search focus used a ring shadow.
- P2: table rows and outer container were too tall/heavy and had side borders.
- P2: provider summary and rectangular create button were oversized.

Fixes made: extracted a shared connector detail header; added project metadata/filtering; split toolbar alignment; removed input focus shadows; reduced table/header/row density; removed table side borders; replaced the CTA with circular create/more actions.

### Pass 2 — passed

Post-fix evidence at 1682 × 960 shows all four annotated regions corrected. Browser interaction checks confirmed search filtering (5 → 1), project filtering (5 → 2), back navigation, new-connection dialog, and the more-actions menu. Browser console warnings/errors: none.

## Findings

No actionable P0, P1, or P2 differences remain against the four requested annotations.

## Remaining risk

- The table intentionally retains horizontal scrolling below its 850px minimum width; mobile layout was not part of the desktop-app reference.
- Project ownership is mock data until connection persistence is connected to the backend.

final result: passed
