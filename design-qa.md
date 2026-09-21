# DTS 问题单侧栏设计 QA

- Source visual truth: Conversation attachments from Browser Comments, including the latest focused metadata and full relationship-view annotations (no local filesystem path)
- Implementation screenshots: `C:\Users\y00013075\.codex\visualizations\2026\09\20\01a0be0c-2e93-7543-93a2-4898baa1df50\dts-native-graph-final.png`, `C:\Users\y00013075\.codex\visualizations\2026\09\20\01a0be0c-2e93-7543-93a2-4898baa1df50\dts-native-graph-expanded.png`, `C:\Users\y00013075\.codex\visualizations\2026\09\20\01a0be0c-2e93-7543-93a2-4898baa1df50\dts-mindmap-final.png`, and `C:\Users\y00013075\.codex\visualizations\2026\09\20\01a0be0c-2e93-7543-93a2-4898baa1df50\dts-interaction-polish-final.png`
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

### Pass 7

- Earlier finding: Although library chrome was removed, the graph remained a symmetric dashboard topology made from large uniform information cards. It did not match the supplied freeform mind-map reference and left too little visual breathing room.
- Fix made: Rebuilt the composition as an asymmetric note canvas with smaller lightweight nodes, dotted paper texture, dark dashed curved relationships, explicit plus/ellipsis junctions, a dashed selected ticket note, and a compact vertical control rail. Existing DTS content and native zoom, fit, and pan behavior were retained.
- Post-fix visual evidence: `dts-mindmap-final.png` shows seven dispersed notes with varied placement, clear negative space, high-contrast relationship paths, and controls aligned to the right edge. Browser verification confirmed zoom changed 95% to 103%, fit restored 95%, and pan mode toggled on and off without disturbing the selected ticket state.

### Pass 8

- Earlier finding: The freeform composition was visually convincing but functionally static. Nodes could not be repositioned, decorative junction pills looked actionable without responding, and both ends of each relationship used endpoint styling.
- Fix made: Made every graph node pointer-draggable with live edge recomputation, selection feedback, keyboard arrow-key movement, stage-bound clamping, and a reset-layout control. Removed all decorative junction controls. Relationship starts are now unmarked and only targets use hollow circular endpoints.
- Post-fix visual evidence: `dts-draggable-graph-final.png` shows the simplified connector treatment and explicit draggable-node accessibility labels. Browser interaction moved the impact node, confirmed its selected state and attached edge moved with it, then used `重置节点布局` to restore the initial composition. Browser console warnings and errors remained empty.

### Pass 9

- Earlier findings: The default freeform positions still clustered nodes unevenly, the selected node used an unnecessarily heavy shadow, node cards could only be moved rather than created or removed, header icons sat inside decorative containers, and the canvas tools remained a grouped vertical rail on the right edge.
- Fixes made: Rebalanced the seven default nodes around a centered ticket, reduced the active treatment to a quiet border and tinted surface with no shadow, added hover/focus create and delete actions with dynamic node and edge state, added collision-aware placement for newly created cards, removed header icon containers, and separated the canvas tools into individual bottom-right controls.
- Post-fix visual evidence: Browser verification at 1682 × 960 shows a balanced center-out composition with clear negative space and standalone bottom-right controls. Creating from `影响范围` produced an eighth connected card, the new card was dragged from `(719, 468)` to `(664, 411)`, and its delete control remained visible and enabled. Reloading restored the seven-node default layout. No framework error overlay appeared.

### Pass 10

- Earlier findings: The root ticket's selected state added a solid outline over its intentional dashed border, selected nodes used a neutral rather than theme-colored border, node movement stopped at the fixed 1020 × 680 logical stage despite visible canvas space, canvas panning could create a browser text selection, selected-node actions remained outlined, and the AI inspector opened by default from a control outside the ticket header.
- Fixes made: Preserved the root's dashed border while recoloring it with the theme accent, reduced all selected states to a single 1 px accent border with no shadow, removed fixed-stage clamping while allowing SVG relationships to render outside the original view box, disabled text selection and default pointer selection during pan, filled selected add/delete actions with accent/error colors, and moved the inspector launcher into the ticket header with the inspector closed by default.
- Post-fix visual evidence: `dts-interaction-polish-final.png` shows the default seven-node graph with a quiet dashed accent root, no inspector, and the new `AI` header button. Computed browser styles report `rgb(62, 99, 221)` for selected borders, `dashed` for the root and `solid` for ordinary nodes, with zero visible box shadow. The impact node moved from logical `y=64` to `y=588`, beyond the old `y=540` limit; panning changed the stage transform while `window.getSelection()` remained empty. Opening `AI` displayed both inspector tabs, and closing it restored the launcher. Console warnings and errors were empty.

### Pass 11

- Earlier findings: Ordinary nodes still used solid borders while the root used a dashed frame; CSS dashed borders became visually uneven at fractional canvas zoom; add/delete controls changed from outline to filled depending on hover versus selection; newly created nodes had fixed icon, title, and body copy.
- Fixes made: Replaced every node border with the same non-scaling 1 px dashed frame so dash width, spacing, and contrast remain stable while zooming; retained the theme accent only as the selected-frame color; made add and delete controls permanently filled whenever visible; added a custom-node editor with six built-in Phosphor icons, title editing, content editing, live preview, and a persistent edit action.
- Post-fix visual evidence: Live browser inspection at `http://localhost:3001/` found eight node frames with identical `4 4` dash arrays and `non-scaling-stroke`; seven unselected frames shared `rgba(32, 33, 38, 0.14)` and the selected custom frame used `rgb(62, 99, 221)`. Add/delete controls computed to accent/error filled backgrounds with white icons. A custom node was created, changed to the task icon, renamed to `数据库回滚方案`, given new body copy, closed, reopened, and retained all three edited values.

### Pass 12

- Earlier finding: Editing a custom node opened a large detached panel at the canvas top-right, obscuring nearby graph content and separating the form from the node being changed.
- Fix made: Removed the floating editor and moved icon selection, title input, content input, and completion control directly into the custom card. New cards now expand in place to `240 × 174` for editing and return to a compact `220 × 128` display card after saving; reopening edit expands the same node in place.
- Post-fix visual evidence: Browser verification created and edited `数据库回滚方案` directly on the connected card. DOM inspection found zero detached editor asides, confirmed the editor region is nested inside the selected graph node, and verified the card transitions from `240 × 174` editing state to `220 × 128` display state while retaining the selected task icon and edited copy. Console warnings and errors were empty.

## Findings

No actionable P0, P1, or P2 findings remain. The implementation intentionally adapts the supplied mind-map reference to Fouc's denser desktop workbench scale while keeping the graph editable and keyboard-accessible.

## Follow-up polish

No required follow-up. Real DTS list responses that omit relation or comment counts degrade cleanly by hiding only the unavailable chip.

final result: passed
