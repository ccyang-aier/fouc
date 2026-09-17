# Home assistant integration QA

- Source visual truth: `C:\Users\Y00013~1\AppData\Local\Temp\codex-clipboard-f6a115f0-3329-4091-abfe-f1fcb3718b28.png` and `C:\Users\Y00013~1\AppData\Local\Temp\codex-clipboard-6ca5c830-f886-4c8f-82e1-5520eabe01e6.png`
- Implementation: `http://localhost:3000/` (Codex in-app browser, tab 3)
- Source pixels: 651 × 327 and 642 × 468
- Implementation capture: desktop app viewport at device scale factor 1
- Responsive check: 680 × 860 CSS pixels at device scale factor 1
- State: idle composer plus pointer-only left tracking state
- Normalization: the source is an annotated issue crop rather than a target mock. Comparison focused on the marked robot/composer junction; browser chrome and the red annotation were excluded from fidelity judgment.

## Full-view comparison evidence

The page composition, typography, palette, input dimensions, controls, and copy remain unchanged. The implementation intentionally changes only depth ordering and narrow-screen spacing: the composer is the foreground surface and the robot sits behind it.

## Focused region comparison evidence

- Before: the robot sat above an interrupted card edge, making its torso and hands appear detached from the input surface.
- After: the card keeps one continuous top edge and foreground surface. The robot is lowered by 6 px, so the card masks the bottom 14 pixels of its 142 px desktop frame and gives it a more grounded resting position.
- Narrow viewport: an additional 20 px header-to-composer gap prevents the robot from colliding with the subtitle.
- Interaction: CDP `Input.dispatchMouseEvent` with `type: mouseMoved`, `buttons: 0` changed the robot direction without pointer down or click.

## Required fidelity surfaces

- Fonts and typography: unchanged; no wrapping or hierarchy regression was introduced.
- Spacing and layout rhythm: desktop composition is unchanged; the narrow breakpoint receives 20 px more vertical clearance.
- Colors and visual tokens: unchanged; no masking color, gradient, or artificial bridge remains.
- Image quality and asset fidelity: the existing transparent ImageGen frame is rendered once at its native aspect ratio, behind the composer, without clipping duplication or stretching.
- Copy and content: unchanged.

## Findings

No actionable P0, P1, or P2 differences remain for the requested junction. The robot reads as emerging from behind the composer, and the card edge remains structurally continuous.

## Comparison history

- P1 previous iteration: a panel-colored break removed the border beneath the robot but made the two elements feel detached. Fixed by deleting the bridge and putting the complete composer above the robot in the stacking order.
- P2 first layering pass: the foreground hid all of the robot's hands. Fixed by lifting the robot while retaining foreground overlap.
- P2 follow-up: the robot still appeared slightly suspended above the card. Fixed by lowering it 6 px on desktop and narrow breakpoints; post-fix evidence at 1064 × 665 shows a firmer visual seat without losing the hands.
- P2 narrow-screen pass: the robot intersected the subtitle at 680 px. Fixed by increasing the narrow header-to-composer gap from 80 px to 100 px.
- Existing pointer tracking remains verified with `buttons: 0`.

## Implementation checklist

- [x] Restore an uninterrupted composer edge.
- [x] Put the robot behind the full composer surface.
- [x] Tune occlusion so the hands remain visible on desktop.
- [x] Preserve no-click pointer tracking.
- [x] Verify desktop and 680 px layouts.
- [x] Verify page identity, meaningful content, framework overlay absence, and console health.

final result: passed
