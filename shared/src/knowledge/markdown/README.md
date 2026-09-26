# Standard knowledge Markdown

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

The exporter reparses its preferred output using the real parser, supplements attributes/marks only when text and structure agree, and otherwise uses structural directives. It verifies the final document before returning. Failure raises `lossy_serialization`; it never returns a knowingly lossy export. Standard mode never generates AI `{#b:…}` anchors or media-derived text. Those belong to the separate AI dialect.

## Import boundaries and normalization

This API imports a **page body**, not a vault/archive. File traversal, page/frontmatter properties, attachment resolution, and Notion/Obsidian packaging belong to the import layer. Wiki embeds (`![[…]]`) require that layer to resolve page/assets first and are rejected here. Ordinary wiki links do not require a resolver; optional resolved IDs are retained as metadata.

Markdown syntax style is normalized, not byte-preserved. Reference definitions resolve into link/image attributes; unused definitions are non-rendered syntax. Inline images become ordered block siblings with surrounding text preserved. Mixed checkbox/plain lists become adjacent homogeneous lists, retaining task state and ordered numbering. A list item lacking its schema-required first paragraph receives an empty paragraph. An empty body becomes one empty paragraph.

Raw HTML, footnotes, unknown directives, unmodeled code/math fence metadata, unknown attributes, and invalid content fail with `KnowledgeMarkdownError` (`code`, plus source `line`/`column` when available). There is no silent unsupported-node drop, HTML execution, network access, or frontend rendering in this module. URL strings remain document data; renderers must use the shared safe-URL policy.

In GFM tables, wiki pipes have an additional table escaping layer: `[[Page\|Label]]` is an aliased link, while three backslashes before a pipe preserve a literal pipe inside a wiki field. The tokenizer respects escaped literal brackets and does not recognize links inside code.
