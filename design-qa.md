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
