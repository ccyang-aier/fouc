'use client';

/**
 * The columns NodeView (E05): a flex row over the shared schema's `columns`
 * node. ProseMirror renders each `column` child (div[data-column]) directly
 * inside NodeViewContent, so the children are styled as flex items through
 * wrapper selectors — equal widths with a natural wrap: once a column cannot
 * keep its 300px minimum the row wraps into a vertical stack. No JS sizing.
 *
 * The schema's per-column `width` attr is intentionally preserved untouched
 * (the Markdown round-trip keeps it), but v1 renders equal columns; honoring
 * weighted widths is a later visual refinement, not a schema change.
 *
 * NodeViewContent provides the contentDOM required for content binding.
 */

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';

export function ColumnsNodeView({ node, HTMLAttributes }: NodeViewProps) {
  return (
    // Semantic DOM markers re-emitted by the view (registry attrs are
    // serialized-only); the schema serializers stay the serialization source.
    <NodeViewWrapper
      as="div"
      {...HTMLAttributes}
      data-fouc-node="columns"
      data-columns=""
      data-block-id={node.attrs.blockId}
      className="my-3"
    >
      <NodeViewContent
        as="div"
        className="flex flex-wrap items-start gap-5 [&>*]:min-w-[300px] [&>*]:flex-1 [&>*]:basis-0"
      />
    </NodeViewWrapper>
  );
}
