# Home assistant integration QA

- Source visual truth: `C:\Users\Y00013~1\AppData\Local\Temp\codex-clipboard-18f38013-de68-422b-949b-19c035edc723.png`
- Implementation: `http://localhost:3000/` (Codex in-app browser, tab 3)
- Source pixels: 1062 × 665
- Implementation capture: 1280 × 720 CSS pixels at device scale factor 1
- Responsive check: 680 × 860 CSS pixels at device scale factor 1
- State: idle composer plus pointer-only left and up tracking states
- Normalization: the source is a cropped annotated issue screenshot rather than a target mock, so comparison focused on the marked robot/composer junction at equivalent scale. Browser chrome and the red annotation were excluded from fidelity judgment.

## Full-view comparison evidence

The surrounding home composition, typography, palette, control density, and copy remain unchanged. The implementation intentionally differs only in the marked area: the permission selector moves left, the card border disappears beneath the robot, and the complete transparent robot frame overlaps the card instead of two hard-clipped layers meeting at the card edge.

## Focused region comparison evidence

- Before: the hands and torso meet a visible horizontal boundary, the permission control sits directly beneath the character, and the duplicated foreground crop creates a hard seam.
- After: one continuous raster frame renders above a small panel-colored border break; the hands and torso remain intact; the permission selector has reserved clearance.
- Interaction: CDP `Input.dispatchMouseEvent` with `type: mouseMoved`, `buttons: 0` changed the robot to left and up frames without pointer down or click.

## Required fidelity surfaces

- Fonts and typography: unchanged; heading and compact control hierarchy remain consistent.
- Spacing and layout rhythm: permission control clearance and the 150 px desktop / 116 px narrow border break remove the collision without changing composer dimensions.
- Colors and visual tokens: the integration surface uses the existing `bg-panel` token; no new color or gradient was introduced.
- Image quality and asset fidelity: existing transparent ImageGen frames are reused at native aspect ratio with no additional crop seam or stretching.
- Copy and content: unchanged.

## Findings

No actionable P0, P1, or P2 differences remain for the requested area. On very narrow layouts the permission label is intentionally hidden by the existing breakpoint while its shield control remains available.

## Comparison history

- P1 before fix: hard visual seam caused by duplicating and clipping the robot into background and foreground layers. Fixed by rendering one continuous frame above a panel-colored border break. Post-fix desktop and narrow captures show no torso/hand clipping.
- P1 before fix: tracking required pointer down. Fixed by listening to throttled global `pointermove`. Post-fix mouse-move events with `buttons: 0` visibly select directional frames.
- P2 before fix: permission selector competed with the robot for the same space. Fixed by reserving responsive right margin for the assistant.

## Implementation checklist

- [x] Remove clipped duplicate-frame composition.
- [x] Add seamless composer border break beneath the assistant.
- [x] Reserve space for the permission selector.
- [x] Track pointer movement without click or drag.
- [x] Verify desktop and narrow layouts.
- [x] Verify page identity, meaningful content, framework overlay absence, and console health.

final result: passed
