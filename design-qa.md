# Home assistant integration QA

- Source visual truth: `C:\Users\Y00013~1\AppData\Local\Temp\codex-clipboard-f6a115f0-3329-4091-abfe-f1fcb3718b28.png` and `C:\Users\Y00013~1\AppData\Local\Temp\codex-clipboard-6ca5c830-f886-4c8f-82e1-5520eabe01e6.png`
- Implementation: `http://localhost:3000/` (Codex in-app browser, tab 4)
- Source pixels: 651 × 327 and 642 × 468
- Implementation capture: desktop app viewport at device scale factor 1
- Responsive check: 680 × 860 CSS pixels at device scale factor 1
- State: idle composer plus continuous pointer-only cardinal, diagonal, intermediate, and settle-to-neutral tracking states
- Normalization: the source is an annotated issue crop rather than a target mock. Comparison focused on the marked robot/composer junction; browser chrome and the red annotation were excluded from fidelity judgment.

## Full-view comparison evidence

The page composition, typography, palette, input dimensions, controls, and copy remain unchanged. The implementation intentionally changes only depth ordering and narrow-screen spacing: the composer is the foreground surface and the robot sits behind it.

## Focused region comparison evidence

- Before: the robot sat above an interrupted card edge, making its torso and hands appear detached from the input surface.
- After: the card keeps one continuous top edge and foreground surface. The robot is lowered by a further 2 px (8 px total from the initial layered version), so the card masks the bottom 16 pixels of its 142 px desktop frame and gives it a more grounded resting position.
- Narrow viewport: an additional 20 px header-to-composer gap prevents the robot from colliding with the subtitle.
- Interaction: CDP `Input.dispatchMouseEvent` with `type: mouseMoved`, `buttons: 0` changed the robot direction without pointer down or click. A 60 Hz left-to-right sweep drove continuous spring translation and rotation while one atlas pose remained fully opaque; leaving the viewport returned to neutral without a visual jump.

## Required fidelity surfaces

- Fonts and typography: unchanged; no wrapping or hierarchy regression was introduced.
- Spacing and layout rhythm: desktop composition is unchanged; the narrow breakpoint receives 20 px more vertical clearance.
- Colors and visual tokens: unchanged; no masking color, gradient, or artificial bridge remains.
- Image quality and asset fidelity: one ImageGen call produced a 5 x 5 atlas with 25 directional poses. The rejected first pass had transparent-edge debris; the accepted pass was cleaned, body-centered, baseline-aligned, and encoded as one lossless WebP. Exactly one atlas cell is rendered at full opacity at a time, eliminating double silhouettes. Twelve superseded directional PNGs were removed, reducing packaged assistant assets by roughly 3.3 MB net after adding the atlas.
- Copy and content: unchanged.

## Findings

No actionable P0, P1, or P2 differences remain for the requested junction. The robot reads as emerging from behind the composer, and the card edge remains structurally continuous.

## Comparison history

- P1 previous iteration: a panel-colored break removed the border beneath the robot but made the two elements feel detached. Fixed by deleting the bridge and putting the complete composer above the robot in the stacking order.
- P2 first layering pass: the foreground hid all of the robot's hands. Fixed by lifting the robot while retaining foreground overlap.
- P2 follow-up: the robot still appeared slightly suspended above the card. Fixed by lowering it 8 px total on desktop and narrow breakpoints; post-fix evidence shows a firmer visual seat without losing the hands.
- P2 narrow-screen pass: the robot intersected the subtitle at 680 px. Fixed by increasing the narrow header-to-composer gap from 80 px to 100 px.
- P1 animation pass: five directional states caused visible snapping on long pointer moves. Fixed by expanding the directional set to 13 states, sequencing adjacent poses every 55 ms, and crossfading each frame over 100 ms.
- P1 smoothness follow-up: the 13-state timer still exposed discrete steps and kept 15 full-size image layers mounted. Fixed by replacing the directional files with a 25-pose atlas and requestAnimationFrame spring interpolation.
- P1 ghosting regression: four-layer bilinear blending made adjacent full-body silhouettes overlap during head turns. Fixed by rendering a single atlas pose at full opacity and adding pose hysteresis; the 60 Hz spring transform now supplies continuity without transparent frame overlap. Post-fix browser evidence shows one atlas layer, opacity `1`, and no double head or eyes during a rapid full-width sweep.
- P2 expression interruption: the neutral blink image could interrupt an active directional pose and read as a dropped frame. Fixed by allowing idle blinks only while the smoothed direction is near neutral.
- P2 reachability pass: a fixed distance threshold made the extreme right pose unreachable because the robot sits near the viewport edge. Fixed by normalizing distance against the available pointer ray to the viewport boundary.
- Pointer tracking remains verified with `buttons: 0`; diagonal and full-extreme poses are reachable.

## Implementation checklist

- [x] Restore an uninterrupted composer edge.
- [x] Put the robot behind the full composer surface.
- [x] Tune occlusion so the hands remain visible on desktop.
- [x] Preserve no-click pointer tracking.
- [x] Add soft-cardinal and diagonal ImageGen frames.
- [x] Sequence through adjacent poses instead of jumping across the grid.
- [x] Replace discrete directional files with a single 25-pose atlas.
- [x] Render one pose at a time with hysteresis so full-body silhouettes never overlap.
- [x] Preserve 60 Hz spring translation and rotation between pose changes.
- [x] Keep animation values in refs to avoid React re-renders during pointer movement.
- [x] Prevent idle expression frames from interrupting active tracking.
- [x] Remove superseded directional files from the shipped public bundle.
- [x] Verify left-to-right progression and both diagonal quadrants.
- [x] Verify desktop and 680 px layouts.
- [x] Verify page identity, meaningful content, framework overlay absence, and console health.

final result: passed
