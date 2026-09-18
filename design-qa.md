# DTS connector detail — design QA

- Source visual truth: `C:/Users/Y00013~1/AppData/Local/Temp/codex-clipboard-e242fb46-1d7f-4403-8d63-1180e002d404.png`
- Implementation: `http://localhost:3000/`, DTS connector detail (browser-rendered Codex in-app Browser capture; inline comparison evidence retained in the task)
- Primary viewport: 1584 × 992 CSS px
- Source pixels: 1584 × 992
- Implementation pixels: 1584 × 992
- Density normalization: the browser capture was inspected at a 1584 × 992 CSS viewport to match the source dimensions
- State: connected DTS instance, first pending ticket selected, light theme

## Full-view comparison evidence

The implementation preserves the source hierarchy: compact connector header, ticket navigation on the left, an explorable relationship graph in the center, and detail/assistant context on the right. The relationship graph restores the reference's central-ticket composition, six surrounding information nodes, curved connectors, and canvas controls. Positions express stable UI categories rather than DTS-provided coordinates.

## Focused region evidence

- Left navigation: active filter, search, selected row, severity, owner, state, and time were checked at both viewports.
- Center relationship graph: the central ticket, impact, flow blockers, key evidence, owners and time, related issues, next actions, curved connectors, zoom, fit, and pan controls were checked for clipping and overlap.
- Right context: detail and AI tabs, Fouc analysis, relation counts, connector health, and prompt composer were checked. The AI tab transition was exercised.
- Canvas behavior: the graph automatically fits the available center pane and can be zoomed, reset, or panned without changing the surrounding workbench layout.

## Required fidelity surfaces

- Fonts and typography: uses the existing Fouc UI font stack and optical hierarchy; headings, metadata, truncation, and line-height remain readable at the app's compact density.
- Spacing and layout rhythm: three-column proportions mirror the source, with the selected ticket acting as the graph focal point, balanced surrounding nodes, compact rows, and restrained shadows.
- Colors and visual tokens: all surfaces use existing Fouc theme tokens; semantic red, orange, green, blue, violet, and mint accents match the source's information coding and remain dark-theme compatible.
- Image quality and asset fidelity: the repository's real DTS vector logo and Phosphor icon set are used; no placeholder or hand-drawn image assets were introduced.
- Copy and content: UI labels match the DTS domain and all ticket-specific content is driven by the existing connector contracts.

## Findings

- No actionable P0/P1/P2 visual issues remain.
- No actionable P3 visual issues remain in the relationship graph at the primary viewport.

## Comparison history

1. Initial 1584 × 992 pass found one P2 content-format issue: list timestamps displayed the first year fragment (`26-09`) instead of the ticket time.
2. Fixed `shortDate` to parse the full `YYYY-MM-DD HH:mm` shape and display `HH:mm`.
3. The first redesign incorrectly replaced the relationship graph with a card grid; this failed the source's primary interaction and visual hierarchy.
4. Restored the relationship graph with a central ticket, six connected nodes, curved edges, and zoom/fit/pan controls.
5. Post-fix 1584 × 992 inspection shows all six nodes and controls inside the center pane without clipping or overlap.

## Primary interactions tested

- Open DTS detail from the connector catalog.
- Automatic first-ticket selection and detail loading.
- Switch between “问题详情” and “AI 助手”.
- Zoom in, zoom out, fit-to-canvas, and pan-mode toggle.
- Browser console checked: no errors or warnings.

## Implementation checklist

- [x] Three-column DTS workbench
- [x] Responsive ticket navigation
- [x] Real-data relationship graph with curved connectors
- [x] Zoom, fit, and drag-canvas controls
- [x] Context and AI assistant tabs
- [x] Connected/disconnected states
- [x] Keyboard-visible focus styles and semantic labels
- [x] Desktop and narrow-view visual verification

final result: passed

---

# Home assistant whole-character motion atlas — design QA

- Source visual truth: the existing Fouc robot identity plus the user's latest feedback that split head/body motion caused scale pumping, neck separation, and visible discontinuity.
- Image generation mode: built-in ImageGen, stylized-product-asset workflow.
- Final asset: `public/brand/assistant/assistant-motion-atlas.webp`.
- Atlas specification: 24 yaw positions × 5 pitch bands, 120 complete-character frames, 192 × 192 px per cell, 4608 × 960 px total.
- Runtime display size: 142 × 142 CSS px on desktop and 112 × 112 CSS px at the compact breakpoint.

## Generation direction

Each pitch band was generated as a temporally ordered 6 × 4 contact sheet using the clean neutral robot as the identity anchor. The prompt fixed the camera, character proportions, lighting, baseline, framing, and scale while allowing only small yaw changes from left to right. Separate bands cover approximately 12° up, 6° up, level, 6° down, and 12° down.

## Asset normalization

- Every cell contains the complete robot; the head and body are never composited independently at runtime.
- Foreground extraction uses one consistent alpha-processing pipeline.
- Each frame is normalized to the same 174 px visible height and 188 px baseline inside its 192 px cell.
- Dynamic face-centered cropping prevents the generated contact-sheet drift from clipping hands, body, or head.
- Frames touching a crop boundary are rejected during atlas assembly.

## Runtime behavior verified

- Pointer movement is observed globally; no click is required.
- Horizontal motion traverses the 24-column sequence, while vertical motion selects all five pitch rows.
- Pose selection advances by adjacent cells on animation frames with spring smoothing and hysteresis.
- The rendered sprite has `transform: none`; there is no runtime scale, head rotation, cross-fade, or dual-image blending that could recreate pumping or ghosting.
- The robot remains a single 142 px layer and retains the existing overlap with the higher-level composer surface.
- Reduced-motion preference resolves immediately to the target pose.

## Browser evidence

- The production atlas loaded successfully from `/brand/assistant/assistant-motion-atlas.webp`.
- Computed desktop robot bounds were 142 × 142 CSS px.
- Horizontal endpoint tests reached atlas positions 0% and 100%; vertical endpoint tests reached 0%, 50%, and 100% rows.
- Browser console contained no errors from the assistant component during pointer sweeps.

## Superseded assets

The split `assistant-body.webp` and `head-atlas.webp` assets, plus the differently proportioned legacy blink/success overlays, were removed. Future expressions should be authored as additional whole-character frames so the fixed silhouette and baseline contract remains intact.

final result: passed
