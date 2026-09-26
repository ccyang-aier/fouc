# Suggested edits

`suggestText` and `suggestReplacement` create a ProseMirror transaction before the editor or Agent applies an edit. Inserted text receives `suggestion_insert`; original text remains present with `suggestion_delete`. A replacement shares one `{ suggestionId, author, createdAt }` across both alternatives. Editing one's own pending insertion removes that text instead of creating a redundant deletion suggestion.

Use `collectSuggestions` for headless review and `reviewSuggestions` for one or all IDs. A decision removes proposal annotations or removes the corresponding content in one transaction. Other formatting and comment marks remain. Newly inserted blocks receive new IDs; a required empty paragraph is repaired when the last block is removed.

## Non-text nodes and Yjs

The installed `y-prosemirror@1.3.7` serializes text marks through `marksToAttributes`, but `createTypeFromElementNode` serializes only attrs and children. ProseMirror node marks on images, inline math and container blocks would disappear on the first CRDT round trip.

The current schema therefore has one explicit rule: text uses the two proposal marks; non-text nodes store the same annotation shape in `attrs.annotations`. This is not a historical adapter or duplicated state: an operation uses exactly one storage form per node. The registry owns the nullable array attribute; a block package cannot override its validation. Full blocks and text within them can share a proposal ID, allowing one atomic review of a newly inserted structure. Ordinary formatting on non-text atoms is not claimed to survive the binding.

`suggestions.test.ts` verifies real binary Yjs transfer of proposed text, images and inline math, plus a multi-proposal review as one Yjs transaction and one selective local undo operation. Markdown codecs preserve the shared annotation attribute.

## Editor integration boundary

Call the command before broadcasting an edit, not from an append transaction after destructive changes have already synchronized. Text input, paste and Agent edits supply a range and Slice. A structural command (for example joining paragraphs, changing a list shape, or moving blocks) must supply complete affected blocks as the replacement so both structures remain reviewable; a bare removed boundary is explicitly rejected. Keyboard/IME interception and review controls belong to E03/S02/E06 and require browser acceptance.

Authorship metadata must come from the authenticated interaction context. The shared command does not authorize a caller or replace server ACL checks. Review of a complete block deliberately acts on that whole block; the UI must expose its scope clearly.
