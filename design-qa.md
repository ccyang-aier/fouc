# Project Navigation and Layout — Visual QA

## Result

`passed`

No actionable P0, P1, or P2 visual or interaction findings remain for this revision.

## Visual truth and capture contract

- Positive tab reference: `qa/project-header/source-tabs.png` — `427 × 61`
- Negative action-size reference supplied with this revision: `qa/project-header/source-actions-too-large.png` — `251 × 151`
- Browser-rendered overview: `qa/project-header/implementation-overview-final.png` — `1280 × 1044`
- Browser-rendered work view: `qa/project-header/implementation-work-final.png` — `1280 × 1044`
- Focused action comparison: `qa/project-header/comparison-actions-compact.png`
- Focused tab comparison: `qa/project-header/comparison-tabs-final.png`
- Cross-tab width comparison: `qa/project-header/comparison-content-widths.png`
- CSS viewport reported by the browser: `1281 × 1044`; capture output: `1280 × 1044`; reported device pixel ratio: `1.29`. The browser capture was normalized to the CSS viewport by the capture surface, so implementation comparisons use the saved output pixels directly.
- State: light theme, project favorited, main sidebar expanded, lower “产品研发” project selected, overview/work context panel open.

The focused comparisons place the supplied reference on the left and the current implementation on the right. The action reference is intentionally a negative reference: its oversized tiles are the behavior being corrected.

## Findings and comparison history

### Earlier pass — blocked

- **P1 — cross-tab content width drift:** Overview used a centered `max-width` shell and a `308 px` context rail while Work used the full content track and a `292 px` detail rail.
- **P1 — wrong sidebar active ownership:** Opening a lower project left the top-level “项目” item selected instead of the actual Space/Recent/Favorite row.
- **P2 — oversized header actions:** The collapse and More controls used `48 × 48 px` containers with an `8 px` gap, matching the supplied too-large state rather than the requested compact state.
- **P2 — tab-bar surface drift:** A full-width divider remained below the menu; the menu sat too close to the metadata row and its labels were too light.

Fixes: shared the Work content track with all project sections, standardized the right rail at `292 px`, introduced lower-project selection state with `aria-current="page"`, reduced the action controls to `36 × 36 px` with a `2 px` gap, removed the long divider, increased the tab-bar top offset, and raised labels to semibold.

### Final pass — passed

- The focused action comparison shows both controls using the same compact geometry and hover/open-state surface family.
- The focused tab comparison shows the divider removed, stronger typography, preserved compact spacing, and the same active underline treatment.
- The side-by-side overview/work capture shows both sections terminating at the same `292 px` right rail and sharing identical `20 px` content gutters.
- DOM inspection reports exactly one active project item: “产品研发”; the top-level “项目” item has no `aria-current` state.
- No browser error or warning entries were present; only Next.js Fast Refresh informational logs were recorded.

## Required fidelity surfaces

| Surface | Status | Evidence |
| --- | --- | --- |
| Typography | Passed | Project tab labels use the existing 13 px scale with semibold optical weight and consistent hierarchy. |
| Spacing and layout | Passed | Header actions are `36 × 36 px` with a `2 px` gap; tabs have the requested extra top breathing room; overview and work share the same content and rail widths. |
| Colors and tokens | Passed | Neutral header controls, active mineral underline, selected sidebar surface, and hover backgrounds remain mapped to existing product tokens. |
| Images and icons | Passed | Existing Phosphor icons and avatar assets are retained; no visible asset was approximated with CSS art or text glyphs. |
| Copy and content | Passed | Project title, running-task metadata, owner, Agent chip, and project navigation labels remain coherent and unchanged. |
| Interaction and accessibility | Passed | Project tabs, context toggle, More menu, sidebar project selection, favorite item, keyboard focus rings, and `aria-current` ownership are implemented. |

## Interaction verification

- Clicking Favorite, Space, or Recent project rows selects that exact lower item and clears the top-level nav highlight.
- Clicking a top-level nav item clears the lower project selection.
- All five project tabs switch inside the shared project header.
- Project context/detail rails remain full height and the same width across Overview and Work.
- Header collapse and More controls retain matched hover/focus geometry; the collapse control keeps its visible open-state surface.
- `pnpm typecheck` and `pnpm lint` both pass with no errors or warnings.

## Final result

final result: passed
