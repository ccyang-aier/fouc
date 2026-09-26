# Knowledge Markdown

```ts
import { createMarkdownPipeline } from '@fouc/shared/knowledge/markdown';

const markdown = createMarkdownPipeline();
const document = markdown.parse(source);
const sourceAgain = markdown.serialize(document);
```

`parse` / `serialize` and `fromMdast` / `toMdast` share one remark pipeline: CommonMark + GFM + directives + math + a wiki-link tokenizer. The pipeline is synchronous and framework-free. It validates documents against the shared ProseMirror schema. It does not assign or repair block IDs: import/restore callers use the separate block-ID repair API, not clipboard semantics.

## One source of block semantics

`BlockRegistry` owns every block/mark mapping. Grammar codecs are keyed by mdast type, with registry variants distinguishing ordered/unordered/task lists and header/body cells. Registering a container, leaf, or mark directive automatically enables import/export; there is no second list of domain blocks. A new native grammar can supply `MarkdownPipelineOptions.codecs` together with its registry mapping. Duplicate mappings and reserved `fouc-*` directives fail explicitly.

## Readability and fidelity

Naturally representable content is normal GFM. Examples include headings, nested/numbered task lists, aligned tables, fenced code, `[[页面#^块|名称]]`, `$x^2$`, and `$$` display math. Rich blocks use registered directives, such as `:::callout{emoji='⚠️'}` and `::embed{url='https://example.com'}`. Nested container delimiters grow as required by remark-directive.

Attributes without native Markdown syntax use a compact directive immediately before the corresponding block:

```md
::fouc-meta{data='[{"path":[],"type":"paragraph","attrs":{"blockId":"p1"}}]'}

Readable **body** text.
```

Metadata contains only attribute/mark differences, not document content. Paths are child indexes within the following block, so list/table structural IDs, source IDs, resolved wiki IDs, and node-level suggestion annotations survive. Invalid paths/types, duplicate entries, unknown attributes, and dangling metadata are rejected. When editing structure manually, move/update its associated metadata as well; ordinary text edits retain the annotated block identity.

GFM cannot express every valid editor document (for example multi-paragraph/spanning table cells, empty paragraphs, exact boundary whitespace, and annotated code runs). Those cases use `fouc-block`, `fouc-inline`, `fouc-mark`, and `fouc-text` directives. Children remain independently editable Markdown; the document is never embedded as a JSON blob. Attribute values that need explicit typing use `fouc-attrs` JSON. A `fouc-text` value is a JSON string so control characters are not normalized by CommonMark.

The exporter reparses its preferred output using the real parser, supplements attributes/marks only when text and structure agree, and otherwise uses structural directives. It verifies the final document before returning. Failure raises `lossy_serialization`; it never returns a knowingly lossy export. Standard mode never generates AI `{#b:…}` anchors or media-derived text. The AI dialect is an optional decoration of this same pipeline.

## AI read projections

```ts
// authoritativeDocument must already have valid, unique block IDs.
// derivedByAsset is a ReadonlyMap<SHA256, AssetDerived> from the asset store.
const context = markdown.createAiContext(authoritativeDocument, { derivedByAsset });
const selected = context.read(['intro', 'image_1']); // C01 read_page.range: IDs, not offsets
const aiText = context.markdown;

// The same switch is available at the string and mdast boundaries.
const sameText = markdown.serialize(authoritativeDocument, { dialect: 'ai', derivedByAsset });
const restored = markdown.parse(aiText, { dialect: 'ai', context });
```

Every registered block has one `{#b:id}` token, including list/table containers, their items/rows/cells, and nested paragraphs. Text blocks carry trailing inline tokens; list/quote/directive containers carry closing tokens in their last paragraph (or an anchor-only paragraph). Fences and leaf directives use a following anchor-only paragraph. GFM rows/tables place their closing tokens in the final cell. A cell can therefore contain distinct paragraph, cell, row, and table tokens. This preserves normal GFM without treating a structural row as an unrelated paragraph. GFM table padding is disabled only in AI mode so changing one cell does not add alignment whitespace to other cells.

Normal `context.encodeBlock` calls bind the encoded block automatically. A custom native codec that manually flattens several PM structural nodes into one Markdown carrier must call `context.bindBlock` for each of those nodes, as the GFM table codec does. Missing child bindings fail export instead of returning an incomplete anchor index. These helper bindings are internal mdast data and do not affect standard output.

`context.blocks` is an immutable, document-ordered binding manifest with block type, parent ID, exact PM child path and node range, exact anchor-token range, Markdown carrier range, and derived ranges. Offsets are half-open UTF-16 coordinates in that snapshot. Native list/table carrier ranges may overlap; `anchorRange`, `path`, and `pmRange` distinguish the blocks precisely. `read` returns selected IDs in document order with their contextual excerpts and bindings. It rejects empty, duplicate, unknown, malformed, or more than 100 explicitly selected IDs. Excerpts are read-only context, **not independently parseable replacements**. They may omit preceding standard metadata; hashing source semantics must include authoritative node attributes, not only an excerpt's text.

Derivations are selected by canonical `asset:<SHA256>` source and the registry's `index.mode: 'media'`, never by model-provided block IDs. Values are validated against C01 `assetDerivedSchema`. Status, description, OCR, extracted document text, errors, and transcript segments with exact second timestamps are placed in a `fouc-derived` container bound to the source block. All derived fields, including the field named `markdown`, are encoded as escaped literal text inside a quote. They never create source blocks or addressable anchors. Missing derivations and external URLs do not cause network fetches or fabricated content.

This low-level projection does not silently truncate the derived asset or impose a model token budget. Escaping does **not** make arbitrary extracted content concise or searchable: W04/H01/G01 must resolve or strip embedded resources (especially `data:…;base64` images), select readable text/transcript segments, and enforce a hard context budget before sending output to a model. Their truncation/selection must remain explicit and preserve source IDs and timestamps. Do not feed an unbounded full projection directly to the model or mistake it for a ready-to-use retrieval chunk.

AI import is deliberately a **verified read-projection round trip**, not a write-proposal parser. It requires the exact opaque context issued by this pipeline instance from the authoritative PM document; a model-supplied JSON manifest is not trusted. It validates the complete anchor set, each token's original AST placement and block-end boundary, and each derivation container's binding and position. It then discards every derivation subtree and checks that the remaining source has exactly the original PM semantics. Derived bodies may change and are ignored; source edits, moved/forged/missing/duplicate anchors, or rebound/removed derivation containers fail. `context.read()` always reads the original issued snapshot, never a returned string. Standard import rejects the reserved AI-only derivation directive.

This is a parsing and addressing boundary, not an ACL, freshness, prompt-injection, or write-authorization boundary. Snapshots do not prove a page is still current or accessible, and asset text remains untrusted context for the model. Subsequent tool handlers must authorize page/asset access, check current revision and authoritative block IDs, and route writes through the suggestion/transaction layer. They must not use model-supplied anchors or these read-only Markdown offsets as edit targets. Write proposals use standard Markdown plus separately validated target IDs; this module performs no writes.

## Import boundaries and normalization

This API imports a **page body**, not a vault/archive. File traversal, page/frontmatter properties, attachment resolution, and Notion/Obsidian packaging belong to the import layer. Wiki embeds (`![[…]]`) require that layer to resolve page/assets first and are rejected here. Ordinary wiki links do not require a resolver; optional resolved IDs are retained as metadata.

Markdown syntax style is normalized, not byte-preserved. Reference definitions resolve into link/image attributes; unused definitions are non-rendered syntax. Inline images become ordered block siblings with surrounding text preserved. Mixed checkbox/plain lists become adjacent homogeneous lists, retaining task state and ordered numbering. A list item lacking its schema-required first paragraph receives an empty paragraph. An empty body becomes one empty paragraph.

Raw HTML, footnotes, unknown directives, unmodeled code/math fence metadata, unknown attributes, and invalid content fail with `KnowledgeMarkdownError` (`code`, plus source `line`/`column` when available). There is no silent unsupported-node drop, HTML execution, network access, or frontend rendering in this module. URL strings remain document data; renderers must use the shared safe-URL policy.

In GFM tables, wiki pipes have an additional table escaping layer: `[[Page\|Label]]` is an aliased link, while three backslashes before a pipe preserve a literal pipe inside a wiki field. The tokenizer respects escaped literal brackets and does not recognize links inside code.
