# Fouc Workbench — Design QA

## Visual target and evidence

- Accepted interface reference: `C:\AIWorks\26Coding\fouc\design\fouc-workbench-reference.png`
- User-provided logo source: `C:\Users\17335\AppData\Local\Temp\codex-clipboard-1643e041-3a68-46a0-a700-1ba9d7da4c9c.png`
- User-provided sidebar-header reference: `C:\Users\17335\AppData\Local\Temp\codex-clipboard-d451480d-be93-4e9e-ae91-4d98242df784.png`
- Final 1920×1080 implementation: `C:\AIWorks\26Coding\fouc\qa\implementation-icon-header-1920x1080.png`
- Final 1366×768 implementation: `C:\AIWorks\26Coding\fouc\qa\implementation-icon-header-1366x768.png`
- Same-input logo/header comparison: `C:\AIWorks\26Coding\fouc\qa\comparison-logo-header-final.png`

The final pass was evaluated at 1920×1080 and 1366×768 CSS pixels in the Codex in-app browser. The small black `N` badge visible over the lower-left avatar in development-browser captures is the Next.js development overlay and is not rendered in the production build.

## Final comparison points

1. **Logo fidelity:** the interface uses a 1312×1199 transparent PNG generated from the accepted logo reference with ImageGen. It preserves the reference's softly dimensional black foreground frame and light-gray rear frame while supplying enough source resolution for high-DPI UI rendering.
2. **Sidebar header:** a compact 50 px header now contains the Fouc mark, product name, “智能工作台” subtitle, and a working collapse/expand control.
3. **Density:** the native-style title bar is 38 px, the desktop sidebar is 240 px, primary navigation rows are 34 px, the main heading is 25 px, and secondary UI typography is 9–12 px.
4. **Icon language:** navigation, workspace, mode, and starter icons use unboxed Phosphor filled glyphs with restrained pastel colors. Only real action hit targets, such as attach and send, retain a background surface.
5. **Shell geometry:** the main white surface retains its 16 px top-left radius with no divider under the title bar.
6. **Interaction:** sidebar collapse/expand, modes, prompt starters, composer controls, menus, tooltips, and new-task focus behavior remain functional.

### Collapsed-header correction

- Reference: `C:\Users\17335\AppData\Local\Temp\codex-clipboard-a8d3c80a-65b8-449c-8cdb-853e875b0b91.png`
- Rendered evidence: `C:\Users\17335\AppData\Local\Temp\fouc-collapse-after.png`
- Same-input comparison: `C:\Users\17335\AppData\Local\Temp\fouc-collapse-comparison.png`
- The separate expand chevron is no longer rendered in the collapsed state. The centered Fouc logo is now the only header control and expands the sidebar when clicked; the expanded state retains its dedicated collapse button.

### Collapsed-rail alignment and logo clarity correction

- The title bar and sidebar share the same high-resolution ImageGen raster asset with genuine alpha transparency instead of the former 52×53 screenshot extraction or a flat SVG approximation.
- Every visible collapsed-rail icon is centered on the 30 px axis of the 60 px sidebar, including the primary new-task control, workspace add control, workspace rows, recent row, and profile control.

## Verification

- `pnpm typecheck`: passed
- `pnpm lint`: passed with zero warnings
- `pnpm build`: passed
- `pnpm tauri build`: passed; release executable, MSI, and NSIS installer generated
- Browser console on a fresh page: zero warnings and errors
- Sidebar width: 240 px expanded / 60 px collapsed
- Main top-left radius: 16 px in expanded and collapsed states
- Responsive desktop checks: 1920×1080 and 1366×768 passed without document overflow
- Collapsed header: 60 px wide, logo-only, click-to-expand verified

No material P0, P1, or P2 visual mismatch remains for this revision.

final result: passed
