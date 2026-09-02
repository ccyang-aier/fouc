# Project Header and Favorites — Visual QA

## Result

`passed`

No actionable P0, P1, or P2 visual or interaction findings remain.

## Visual truth and capture contract

- Source header: `qa/project-header/source-header.png` — `532 × 94`
- Source tabs: `qa/project-header/source-tabs.png` — `427 × 61`
- Source actions: `qa/project-header/source-actions.png` — `170 × 67`
- Browser-rendered implementation: `qa/project-header/implementation-final.png` — `1280 × 1044`
- Focused header comparison: `qa/project-header/comparison-header.png`
- Focused tabs comparison: `qa/project-header/comparison-tabs.png`
- Focused actions comparison: `qa/project-header/comparison-actions.png`
- CSS viewport: `1280 × 1044`
- Device pixel ratio: `1`
- State: light theme, project overview active, project-context sidebar open at full project height, project favorited, main sidebar expanded
- Normalization: reference snippets remain at native pixels; matching implementation component regions were cropped at 1:1 density and isolated from adjacent UI before side-by-side comparison.

Each comparison places the supplied reference on the left and the rendered implementation on the right.

## Findings and comparison history

### Iteration 1 — blocked

- **P1 — inconsistent project structure:** The old overview used a large title block while Work used a separate compact header, so project sections did not share one visual system.
- **P1 — oversized project menu:** The existing icon-and-pill navigation was materially larger than the supplied text-and-underline reference.
- **P2 — incomplete favorite affordance:** The project star had no selected state and did not create the requested sidebar Favorites area.
- **P2 — sidebar utility icon drift:** Collapse and search no longer used the prior product-specific glyphs.

Fixes: introduced a shared `ProjectHeader`, recreated the title/metadata/Agent composition, added compact underline tabs, added a persisted favorite store and sidebar Favorites region, and restored the prior sidebar collapse/search glyphs.

### Iteration 2 — blocked

- **P1 — project-context sidebar height regression:** The first shared-header structure placed the project context below the header instead of preserving its original full project-space height.
- **P2 — header action hover mismatch:** Collapse and More used different hit-area sizes, corner radii, and hover surface colors.

Fixes: restored the overview/output/resource/timeline layout to an outer two-column grid so the context sidebar again spans the full project-space height. The two header actions now share a `48 × 48` hit area, `10 px` radius, and `#f4f4f5` hover surface; only the collapse action keeps a visible open-state surface.

### Iteration 3 — passed

- Full-height context sidebar verified in the final overview capture.
- Header, text navigation, and action controls were recaptured and compared side by side at 1:1 density.
- No P0/P1/P2 mismatch remains.

## Required fidelity surfaces

| Surface | Status | Evidence |
| --- | --- | --- |
| Typography | Passed | Project title, metadata, owner treatment, Agent chip, and 13 px navigation hierarchy match the supplied snippets closely. |
| Spacing and layout | Passed | Header rhythm, compact tab width, active underline, action sizing, and full-height right sidebar are aligned. |
| Colors and tokens | Passed | Neutral text, mineral accent underline, muted metadata, violet Agent badge, and hover surfaces retain product tokens and source intent. |
| Images and icons | Passed | Existing member avatars and Phosphor project icons are used; the sidebar utilities were restored from the product's prior implementation as requested. |
| Copy and content | Passed | “当前运行中任务 3” replaces the old health copy; owner and Agent copy match the target structure. |

## Interaction verification

- Project star toggles selected/unselected state.
- Selecting the star immediately adds “收藏 / Fouc 桌面端 V1” above Spaces in the main sidebar; unselecting removes it.
- Favorite state is backed by local storage for normal page reloads.
- All five project tabs switch through the shared header and retain the same dimensions.
- Header collapse toggles the project context on overview-like sections and the work detail panel on Work.
- Header More menu opens and closes correctly.
- Main sidebar collapse/expand and search toggle work with the restored icons.
- Work toolbar labels remain single-line at the verification viewport.
- No uncaught error overlay or failed interaction surfaced during browser verification.
- `pnpm typecheck` and `pnpm lint` pass.

## Final result

final result: passed
