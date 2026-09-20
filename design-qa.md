# DTS 问题单侧栏设计 QA

- Source visual truth: Conversation attachments from Browser Comments 1–4, including the focused metadata-chip reference (no local filesystem path)
- Implementation screenshot: `C:\Users\y00013075\.codex\visualizations\2026\09\20\01a0be0c-2e93-7543-93a2-4898baa1df50\dts-card-metadata-final.png`
- Viewport: 1682 × 960 CSS px
- Source pixels: 472 × 606 px for the focused card-list reference; the annotated full-page references are 1682 × 960 px
- Implementation pixels: 1682 × 960 px
- Device pixel ratio: 1
- Density normalization: Full-page comparison used equal 1682 × 960 dimensions; the 472 × 606 card reference was evaluated as a focused component reference rather than scaled as a full-page layout
- State: DTS detail open, issue sidebar expanded, first issue selected, relationship graph visible

## Full-view comparison evidence

The updated implementation preserves the original Fouc desktop information architecture while introducing the requested breadcrumb and card-based issue list. The list remains a secondary column, the selected ticket retains a clear active state, and the main work area remains usable at the supplied 1682 × 960 viewport. Collapsing the issue sidebar expands the work area without clipping persistent controls.

## Focused region comparison evidence

The focused issue-list region matches the reference's hierarchy: severity marker and ticket ID at the top, a prominent multi-line title, a secondary summary, a dashed metadata divider, and compact rows for owner, time, status, related issues, and comments. Rounded bordered cards, restrained elevation, semantic severity colors, and a visible selected outline reproduce the reference intent using the existing Fouc design tokens and Phosphor icon family. Relation and comment counts are carried through the DTS summary contract rather than hard-coded in the component.

## Required fidelity surfaces

- Fonts and typography: Existing Fouc sans stack retained; ticket titles use a stronger optical weight and two-line truncation, with smaller supporting text and tabular times. No cramped or broken wrapping was observed.
- Spacing and layout rhythm: 8 px list gaps, 10 px card radii, compact card padding, and a 316 px desktop list width provide clear separation while keeping all four tickets visible in the first viewport.
- Colors and visual tokens: Existing panel, line, accent, warning, error, and muted tokens are used. The supported severity enum is exactly `致命 / 严重 / 一般 / 提示`, with distinct semantic badge and dot treatments.
- Image quality and asset fidelity: The target contains no raster imagery. All visible UI icons use the existing Phosphor icon library; no CSS drawings, inline SVG substitutes, or placeholders were introduced.
- Copy and content: All card content comes from existing DTS ticket data. The breadcrumb copy is exactly `连接器 / DTS`.
- Responsiveness: The list narrows to 284 px below 1180 px and can collapse to a 44 px rail. No overlap or clipping was observed at the tested desktop viewport.
- Accessibility and interactions: Collapse/expand controls expose labels and expanded state, keyboard focus rings are present, selected tickets retain pressed state, and the breadcrumb return action is keyboard-accessible.

## Interaction verification

1. Opened DTS detail at `http://localhost:3000/` and confirmed meaningful ticket content rendered.
2. Activated `收起工单侧栏`; the list became a 44 px rail and the main ticket workspace expanded.
3. Activated `展开工单侧栏`; all tickets and the current selection returned.
4. Activated the `连接器` breadcrumb; the connector catalog rendered, then DTS was reopened successfully.
5. Checked browser console warnings and errors: none.
6. Checked for a Next.js/framework error overlay: none.
7. Confirmed the rendered DTS view contains `致命`, relation metadata, and comment metadata, and contains no legacy `高` severity label.

## Comparison history

### Pass 1

- Earlier finding: The initial card implementation referenced undefined `--err-soft` and `--ok-soft` background tokens, which could make semantic chips lose their intended surface color.
- Fix made: Replaced those surfaces with theme-aware `color-mix()` expressions based on the existing semantic ink and panel tokens.
- Post-fix visual evidence: The implementation screenshot shows the severity badges and status chips with visible, balanced semantic fills; no actionable P0/P1/P2 mismatch remains.

### Pass 2

- Earlier findings: Severity accepted unsupported labels such as `高`; card metadata used a solid divider and circular user icon; cards did not expose relation or comment counts from the supplied reference.
- Fixes made: Added a strict four-value shared severity type and backend normalization, introduced nullable relation/comment summary counts, changed the divider to dashed, replaced the user icon, and added compact relation/comment metadata.
- Post-fix visual evidence: The final screenshot shows `致命 / 严重 / 一般` across the visible cards, dashed metadata dividers, simple user icons, blue relation chips, and right-aligned comment counts. All four cards remain visible without overlap at 1682 × 960.

## Findings

No actionable P0, P1, or P2 findings remain. The implementation intentionally adapts the standalone card reference to Fouc's denser desktop workbench scale instead of copying its mobile-width proportions.

## Follow-up polish

No required follow-up. Real DTS list responses that omit relation or comment counts degrade cleanly by hiding only the unavailable chip.

final result: passed
