# MySQL connection list design QA

- Source visual truth path: task-attached Browser Comment screenshots 1–2 (1682 × 960 px).
- Implementation screenshot path: Codex in-app Browser inline capture from `http://127.0.0.1:3001/` in this task.
- Viewport: 1682 × 960 CSS px, device scale factor 1.
- Source pixels: 1682 × 960. Implementation pixels: 1682 × 960. No density normalization required.
- State: MySQL connection list with five mock connections and default filters.

## Full-view comparison evidence

The two annotated regions and final browser capture were compared at the same viewport. Existing layout, table density, filters, content, and interactions remain unchanged outside the requested action controls.

## Focused region comparison evidence

- Header create control: 28px circle now uses only neutral line, panel, and ink tokens; no accent color remains.
- Row operation cell: exposes `打开`, `测试`, and the existing overflow menu with adequate spacing and no clipping.

## Required fidelity surfaces

- Fonts and typography: existing compact 10–10.5px action labels remain aligned and readable.
- Spacing and layout rhythm: operation track expanded to 168px while retaining 60px row height.
- Colors and visual tokens: create action is fully grayscale in default, hover, and focus states.
- Image quality and asset fidelity: no image assets changed.
- Copy and content: `打开` is now an explicit quick action for every connection.

## Comparison history

### Pass 1 — blocked

- P2: create control still used the accent color.
- P2: only connection testing was exposed as a labeled row action.

Fixes made: converted create to neutral grayscale styling and added a labeled `打开` action before `测试` for each row.

### Pass 2 — passed

The final 1682 × 960 capture shows the neutral create control and five rows with complete `打开 / 测试 / 更多` actions. Interaction checks confirmed all five open buttons are exposed, opening the first connection produces feedback, the create dialog still opens, and the browser console has no warnings or errors.

## Findings

No actionable P0, P1, or P2 differences remain against the two requested annotations.

## Remaining risk

- `打开` currently invokes the existing workbench-entry placeholder feedback until the MySQL workbench page is implemented.

final result: passed
