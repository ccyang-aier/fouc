# DTS 问题单侧栏设计 QA

- Source visual truth: Conversation attachments from Browser Comments, including the latest focused metadata and full relationship-view annotations (no local filesystem path)
- Implementation screenshots: `C:\Users\y00013075\.codex\visualizations\2026\09\20\01a0be0c-2e93-7543-93a2-4898baa1df50\dts-native-graph-final.png` and `C:\Users\y00013075\.codex\visualizations\2026\09\20\01a0be0c-2e93-7543-93a2-4898baa1df50\dts-native-graph-expanded.png`
- Viewport: 1682 × 960 CSS px
- Source pixels: 472 × 606 px for the focused card-list reference; the annotated full-page references are 1682 × 960 px
- Implementation pixels: 1682 × 960 px
- Device pixel ratio: 1
- Density normalization: Full-page comparison used equal 1682 × 960 dimensions; the 472 × 606 card reference was evaluated as a focused component reference rather than scaled as a full-page layout
- State: DTS detail open, issue sidebar expanded, first issue selected, relationship graph visible

## Full-view comparison evidence

The updated implementation preserves the original Fouc desktop information architecture while introducing the requested breadcrumb and card-based issue list. The list remains a secondary column, the selected ticket retains a clear active state, and the main work area remains usable at the supplied 1682 × 960 viewport. The relationship view now has a clear center-out hierarchy, larger readable nodes, tighter spatial grouping, and a restrained floating graph legend. Collapsing either sidebar expands the work area without clipping persistent controls.

## Focused region comparison evidence

The focused issue-list region matches the reference's hierarchy: severity marker and ticket ID at the top, a prominent multi-line title, a secondary summary, a dashed metadata divider, and two deliberately separated metadata rows. Owner, time, and comments occupy the first row; status and related issues occupy the second, avoiding clipped labels. Rounded bordered cards, restrained elevation, semantic severity colors, and matching hover/selected outlines reproduce the reference intent using the existing Fouc design tokens and Phosphor icon family. Relation and comment counts are carried through the DTS summary contract rather than hard-coded in the component.

## Required fidelity surfaces

- Fonts and typography: Existing Fouc sans stack retained; ticket titles use a stronger optical weight and two-line truncation, with smaller supporting text and tabular times. No cramped or broken wrapping was observed.
- Spacing and layout rhythm: 8 px list gaps, 10 px card radii, compact card padding, and a 316 px desktop list width provide clear separation. Card metadata is split into two stable rows so no status or relation label competes with identity and comment data.
- Colors and visual tokens: Existing panel, line, accent, warning, error, and muted tokens are used. The issue sidebar resolves to `rgb(255, 255, 255)` in the light theme. Hover and selected cards share the accent border treatment. The supported severity enum is exactly `致命 / 严重 / 一般 / 提示`, with distinct semantic badge and dot treatments.
- Image quality and asset fidelity: The target contains no raster imagery. All visible UI icons use the existing Phosphor icon library; no CSS drawings, inline SVG substitutes, or placeholders were introduced.
- Copy and content: All card content comes from existing DTS ticket data. The breadcrumb copy is exactly `连接器 / DTS`.
- Responsiveness: The list narrows to 284 px below 1180 px and is fully removed from layout when collapsed. No residual rail, overlap, or clipping was observed at the tested desktop viewport.
- Accessibility and interactions: Collapse/expand controls expose labels and expanded state, keyboard focus rings are present, selected tickets retain pressed state, and the independent back button plus breadcrumb return action are keyboard-accessible. The native relationship canvas exposes named zoom, fit-view, and drag-mode controls. The context inspector has explicit close and reopen controls.

## Interaction verification

1. Opened DTS detail at `http://localhost:3000/` and confirmed meaningful ticket content rendered.
2. Activated `收起工单侧栏`; the list and its border disappeared completely and the main ticket workspace expanded to occupy the released width.
3. Confirmed `展开工单侧栏` appeared in the issue header, activated it, and verified all tickets and the current selection returned.
4. Confirmed a separate `返回连接器列表` button is visible and the `当前位置` navigation reads `连接器 / DTS`.
5. Checked browser console warnings and errors: none.
6. Checked for a Next.js/framework error overlay: none.
7. Confirmed the rendered DTS view contains `致命`, relation metadata, and comment metadata, and contains no legacy `高` severity label.
8. Confirmed the native canvas renders 7 nodes and 6 SVG relationships; activating `放大` changed 78% to 86%, and `适应` restored the fitted graph.
9. Activated `关闭工单上下文`, confirmed the inspector was removed, then activated `打开工单上下文` and confirmed it returned.
10. Opened a clean in-app browser tab, navigated `连接器 → DTS`, confirmed 7 nodes and 6 edges rendered, and found no console warnings or errors.

## Comparison history

### Pass 1

- Earlier finding: The initial card implementation referenced undefined `--err-soft` and `--ok-soft` background tokens, which could make semantic chips lose their intended surface color.
- Fix made: Replaced those surfaces with theme-aware `color-mix()` expressions based on the existing semantic ink and panel tokens.
- Post-fix visual evidence: The implementation screenshot shows the severity badges and status chips with visible, balanced semantic fills; no actionable P0/P1/P2 mismatch remains.

### Pass 2

- Earlier findings: Severity accepted unsupported labels such as `高`; card metadata used a solid divider and circular user icon; cards did not expose relation or comment counts from the supplied reference.
- Fixes made: Added a strict four-value shared severity type and backend normalization, introduced nullable relation/comment summary counts, changed the divider to dashed, replaced the user icon, and added compact relation/comment metadata.
- Post-fix visual evidence: The final screenshot shows `致命 / 严重 / 一般` across the visible cards, dashed metadata dividers, simple user icons, blue relation chips, and right-aligned comment counts. All four cards remain visible without overlap at 1682 × 960.

### Pass 3

- Earlier findings: Card footer details were split across two dense rows; the collapsed list left a 44 px vertical rail; the page path lacked a distinct back control and used a chevron rather than the requested slash breadcrumb.
- Fixes made: Consolidated owner, time, status, relation, and comment details into one metadata rail; lifted list visibility to the workspace so collapse unmounts the sidebar entirely; moved the expand control into the issue header; added an independent back button and rendered `连接器 / DTS`.
- Post-fix visual evidence: The expanded screenshot shows all footer metadata aligned on one baseline and the requested back-plus-breadcrumb pattern. The collapsed screenshot shows the relationship canvas beginning immediately after the app navigation with no residual issue-list strip or border. No actionable P0/P1/P2 mismatch remains.

### Pass 4

- Earlier findings: The light-theme issue column used a tinted surface, footer metadata was overpacked into one line, hover lacked the selected card's highlighted border, the relationship diagram was a static hand-built canvas, and the right context inspector could not be dismissed.
- Fixes made: Switched the list surface to the panel token, split metadata into identity and workflow rows, aligned hover/selected border treatment, replaced the diagram with the MIT-licensed React Flow core, and added close/reopen state for the context inspector. The graph inherits draggable nodes, pan/zoom, fit view, interaction locking, a pannable/zoomable minimap, and accessible controls.
- Post-fix visual evidence: The final screenshot shows a white list column, unclipped two-row metadata, visible relationship edges, branded custom nodes, view controls, and minimap. The closed-inspector screenshot confirms the canvas reflows across the released width and a persistent reopen control remains available. No actionable P0/P1/P2 mismatch remains.

### Pass 5

- Earlier findings: Status and related-issue chips still competed with the identity row below the divider, while the relationship view felt underscaled and visually flat due to loose geometry, tiny handles, uniform card surfaces, weak hierarchy, and sparse use of the canvas.
- Fixes made: Moved workflow chips above the dashed divider, reserved the lower row for owner/time/comments, tightened graph coordinates, increased fit-view scale, hid visual connection handles, strengthened the central ticket node, added semantic icon surfaces and metadata badges, refined shadows/radii/controls/minimap, and added a compact relationship-network legend.
- Post-fix visual evidence: The revised screenshot shows stable three-part card composition and a denser center-out network. The central ticket is the visual anchor, surrounding cards have differentiated headers and stronger readable hierarchy, edges terminate cleanly without handle dots, and the graph occupies the useful canvas area without overlap. No actionable P0/P1/P2 mismatch remains.

### Pass 6

- Earlier findings: The React Flow treatment still felt foreign to Fouc and added library-specific chrome without improving the core hierarchy. Ticket statuses were not visually distinct enough, the relation chip was too wide and too close to the status treatment, and breadcrumb segments differed in size and color.
- Fixes made: Removed `@xyflow/react`, its stylesheet, minimap, attribution, and runtime components; rebuilt the graph with project-owned React state, semantic cards, and SVG relationships. Added distinct status palettes for processing, verification, pending, completed, and failed states; changed the related-issue chip to a narrower violet treatment; normalized both breadcrumb labels to 10 px regular muted text.
- Post-fix visual evidence: The native graph screenshot shows the same seven-node relationship hierarchy without third-party chrome, with clearer Fouc-aligned controls and a stronger center ticket. Computed styles confirm both breadcrumb labels are 10 px and `rgb(150, 153, 161)`; processing, verification, and pending tickets use different computed foreground/background pairs. DOM inspection reports zero React Flow elements and the clean browser console reports no warnings or errors.

## Findings

No actionable P0, P1, or P2 findings remain. The implementation intentionally adapts the standalone card reference to Fouc's denser desktop workbench scale instead of copying its mobile-width proportions.

## Follow-up polish

No required follow-up. Real DTS list responses that omit relation or comment counts degrade cleanly by hiding only the unavailable chip.

final result: passed
