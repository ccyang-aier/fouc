# Home assistant integration QA

- Source visual truth: `C:\Users\Y00013~1\AppData\Local\Temp\codex-clipboard-a1dd2902-91bf-4ea9-8de4-dfce635593df.png`
- Implementation: `http://localhost:3000/` (Codex in-app browser, tab 4)
- Source pixels: 430 × 367
- Implementation capture: desktop app viewport at device scale factor 1
- Responsive check: 680 × 860 CSS pixels at device scale factor 1
- State: idle composer plus continuous pointer-only left, right, up, down, intermediate, and settle-to-neutral tracking states using a fixed body and an independently animated head
- Normalization: the source is an issue crop rather than a target mock. Comparison focused on head/body identity, apparent head scale, the neck joint, and animation continuity.

## Full-view comparison evidence

The page composition, typography, palette, input dimensions, controls, and copy remain unchanged. The implementation changes only the robot's head asset, head motion, and internal head/body stacking. The composer remains the foreground surface and the robot remains behind it.

## Focused region comparison evidence

- Before: the 17 x 3 replacement atlas changed the character's head proportions, introduced apparent scale pumping between frames, and required a separate joint image that read as a detached neck block.
- After: the coherent 9 x 5 head atlas is restored. The body is composited in front of the lower head edge, so its existing collar naturally closes the seam without an additional artificial joint layer.
- Apparent scale: no scale or translation is applied to the head. Continuous motion uses only a bounded residual yaw/pitch rotation around a fixed 70% neck pivot; the neutral, full-left, full-right, full-up, and full-down captures keep a stable head envelope.
- Interaction: CDP `Input.dispatchMouseEvent` with `type: mouseMoved`, `buttons: 0` changed the robot direction without pointer down or click. A full-width sweep advanced only through neighboring authored cells while the residual transform updated every animation frame. Returning the pointer to the robot center settled the head at `50% 50%` without a visual jump.
- Narrow viewport: the 680 x 860 check retained the intended robot/composer overlap without clipping the title or controls.

## Required fidelity surfaces

- Fonts and typography: unchanged; no wrapping or hierarchy regression was introduced.
- Spacing and layout rhythm: desktop composition is unchanged; the narrow breakpoint receives 20 px more vertical clearance.
- Colors and visual tokens: unchanged; no masking color, gradient, or artificial bridge remains.
- Image quality and asset fidelity: the accepted implementation returns to the coherent high-resolution 9 x 5 atlas whose face shell, crown, neck, and proportions match the fixed body. Exactly one head cell is rendered at full opacity; no crossfade or duplicated silhouette can create ghosting. The rejected 17 x 3 atlas and its mismatched joint asset were removed from the shipped bundle.
- Copy and content: unchanged.

## Findings

No actionable P0, P1, or P2 differences remain for the reported regression. The robot reads as one character, the head envelope remains stable during direction changes, and the collar/body foreground cleanly contains the neck seam.

## Comparison history

- P1 previous iteration: a panel-colored break removed the border beneath the robot but made the two elements feel detached. Fixed by deleting the bridge and putting the complete composer above the robot in the stacking order.
- P2 first layering pass: the foreground hid all of the robot's hands. Fixed by lifting the robot while retaining foreground overlap.
- P2 follow-up: the robot still appeared slightly suspended above the card. Fixed by lowering it 8 px total on desktop and narrow breakpoints; post-fix evidence shows a firmer visual seat without losing the hands.
- P2 narrow-screen pass: the robot intersected the subtitle at 680 px. Fixed by increasing the narrow header-to-composer gap from 80 px to 100 px.
- P1 animation pass: five directional states caused visible snapping on long pointer moves. Fixed by expanding the directional set to 13 states, sequencing adjacent poses every 55 ms, and crossfading each frame over 100 ms.
- P1 smoothness follow-up: the 13-state timer still exposed discrete steps and kept 15 full-size image layers mounted. Fixed by replacing the directional files with a 25-pose atlas and requestAnimationFrame spring interpolation.
- P1 ghosting regression: four-layer bilinear blending made adjacent full-body silhouettes overlap during head turns. Fixed by rendering a single atlas pose at full opacity and adding pose hysteresis; the 60 Hz spring transform now supplies continuity without transparent frame overlap. Post-fix browser evidence shows one atlas layer, opacity `1`, and no double head or eyes during a rapid full-width sweep.
- P1 residual smoothness: the 5 x 5 full-body atlas technically contained 25 poses, but a horizontal mouse sweep could only expose five effective yaw steps and each step also moved the body. Fixed by separating the character into a static body and a 9 x 5 head atlas. Horizontal tracking now has nine authored yaw poses, vertical tracking has five pitch poses, and the head receives continuous requestAnimationFrame transforms between pose changes while the body never transforms.
- P1 rejected dense-atlas pass: the 17 x 3 replacement increased the nominal frame count but changed the head identity and produced frame-to-frame scale pumping. Fixed by restoring the coherent 9 x 5 atlas and deleting the mismatched joint layer; nominal frame count is no longer allowed to override temporal and identity consistency.
- P1 keyframe transition continuity: switching textures alone exposed a small step. Fixed by calculating the fractional angle remaining between the current pointer pose and the selected keyframe, then applying only that residual yaw/pitch as a GPU transform around the fixed neck pivot. Key poses advance by at most one authored cell per animation frame.
- P1 neck seam: a separate joint asset read as a detached block between the moving head and static torso. Fixed by rendering the fixed body after the head so the body's own collar covers the lower head edge and forms one coherent assembly.
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
- [x] Replace the full-body atlas with a 45-pose head atlas and a fixed body layer.
- [x] Reject and remove the inconsistent 51-pose replacement atlas.
- [x] Restore the coherent 45-pose head atlas and preserve 60 Hz spring motion.
- [x] Add bounded residual-angle rotation between neighboring authored poses without scale or translation.
- [x] Composite the body collar over the moving head's lower edge instead of adding a separate neck-joint asset.
- [x] Keep animation values in refs to avoid React re-renders during pointer movement.
- [x] Prevent idle expression frames from interrupting active tracking.
- [x] Remove superseded directional files from the shipped public bundle.
- [x] Verify all horizontal/vertical extremes, diagonal quadrants, and settle-to-neutral behavior.
- [x] Verify the body remains fixed during a no-click full-width pointer sweep.
- [x] Verify the fixed body/collar remains stable through left, right, up, and down extremes.
- [x] Verify desktop and 680 px layouts.
- [x] Verify page identity, meaningful content, framework overlay absence, and console health.

final result: passed
