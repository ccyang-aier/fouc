# Read-only checkpoint comparison (V02)

`compareHistoryDocuments(before, after)` compares validated ProseMirror snapshots. Both must be decoded with the same shared schema instance; `null` means an absent version. An actual empty page is its real empty paragraph, not an invented block. Invalid or duplicated IDs are rejected, never repaired during comparison.

The result contains changed blocks only: current/added blocks in after-document order, followed by removed blocks in before-document order. Each entry includes both structural locations, stable block ID, explicit reasons, changed attribute names and optional inline ranges. It is JSON-serializable, has no HTML, and never modifies snapshots or executes an editor transaction. Renderers retain both source snapshots to obtain node content and attribute values.

- IDs, not matching text, identify blocks. Same-parent reorders use a deterministic longest increasing subsequence in O(n log n), so inserted/deleted siblings do not make every shifted block appear moved. Several equally minimal move explanations are possible; this API chooses one deterministically, not a claim about the user's original keystrokes.
- A parent's move does not duplicate moves for its unchanged descendants. A changed child does not falsely modify all container ancestors. Reparenting is an explicit move; text/property edits can coexist with that move.
- Inline comparison includes text, marks (including comments/suggestions), links, formulas, hard breaks and wiki atoms. Text uses grapheme clusters within mark runs, preserving emoji/combining sequences and exact whitespace without normalization. Mark boundaries remain real boundaries; atoms remain whole nodes.
- All ranges are half-open absolute PM positions; text offsets use UTF-16, matching PM. Empty ranges represent insert/delete sides. These ranges describe the two snapshots only; they are **not** authorizations or mappings onto an independently edited live document.
- Prefix/suffix matching precedes bounded LCS. The default 2,000,000 comparison-cell budget is shared across the entire document (maximum configurable 8,000,000); exhausted comparisons return exact coarse changed spans explicitly labelled `coarse`, not a fabricated minimal diff. Unchanged prefix/suffix content remains excluded. This avoids quadratic memory/work on large unrelated text.

V01 owns checkpoint persistence, V03 owns history UI and collaborative restore, and P03 owns authorization before either snapshot is read. This module never restores Y.Doc state or disables Yjs GC. It reuses the schema and Markdown attribute semantics; its tests include a real M01 roundtrip for all 27 block types and exact reconstruction from returned inline ranges. No React, backend, filesystem or platform dependency is introduced.

```powershell
bun test shared/src/knowledge/history
pnpm shared:typecheck
```
