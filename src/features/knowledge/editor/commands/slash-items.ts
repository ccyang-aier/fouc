/**
 * The slash menu item model (E06): the pure layer between the shared E01
 * block registry and the '/' floating menu. The list is generated from every
 * registry definition that publishes `slash` metadata — the menu never
 * hardcodes its items — and each entry is paired with an insert command from
 * the extensible INSERT_COMMANDS record (future entries such as a J05 /ai
 * register through `registerSlashInsert`).
 *
 * Insert commands reuse the E04 `setBlockFormat` / `insertMathBlock`
 * vocabulary where it fits; structural blocks (callout, table, columns, atoms)
 * are created from the live schema and land through the same
 * empty-paragraph-replace flow as `insertMathBlock`, so the E02 plugin mints
 * their blockIds.
 */

import type { ComponentType } from 'react';
import {
  Article,
  CheckSquare,
  Code,
  Columns,
  Database,
  Function as FunctionIcon,
  Globe,
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  List,
  ListNumbers,
  Minus,
  Quotes,
  Sparkle,
  SpeakerHigh,
  Table as TableIcon,
  TextHOne,
  TextT,
  Video as VideoIcon,
} from '@phosphor-icons/react';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { NodeType, Node as ProseMirrorNode } from '@tiptap/pm/model';
import { createKnowledgeRegistry } from '@fouc/shared/knowledge/schema';
import type { BlockRegistry } from '@fouc/shared/knowledge/schema';
import { insertMathBlock, setBlockFormat } from '../extensions/format/block-format';

export type SlashGroup = 'text' | 'layout' | 'media' | 'knowledge' | 'ai';

/** Render-only surface an item's icon needs (Phosphor components satisfy it). */
export type SlashItemIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

export interface SlashMenuItem {
  /** The registry block name (or a registered custom entry name). */
  readonly name: string;
  readonly title: string;
  readonly keywords: readonly string[];
  readonly group: SlashGroup;
  readonly icon?: SlashItemIcon;
  /** Runs the insertion; returns whether the editor accepted it. */
  run(editor: Editor): boolean;
}

/** The insert side of one menu entry; extensions and tests register custom ones. */
export type SlashInsertCommand = (editor: Editor) => boolean;

/* ------------------------------------------------------------- insertions */

const sizeOf = (nodes: readonly ProseMirrorNode[]): number => nodes.reduce((total, node) => total + node.nodeSize, 0);

/**
 * Insert block nodes with `insertMathBlock` semantics: an empty top-level
 * paragraph is replaced by the nodes plus a fresh caret paragraph; otherwise
 * they land after the caret's top-level block.
 */
function insertBlockNodes(nodes: readonly ProseMirrorNode[]): SlashInsertCommand {
  return (editor) => {
    const paragraph = editor.schema.nodes.paragraph;
    if (!paragraph || !nodes.length) return false;
    const { $anchor } = editor.state.selection;
    const trail = paragraph.create();
    const tr = editor.state.tr;
    if ($anchor.parent.type === paragraph && $anchor.parent.content.size === 0 && $anchor.depth === 1) {
      const before = $anchor.before();
      tr.replaceWith(before, $anchor.after(), [...nodes, trail]);
      tr.setSelection(TextSelection.near(tr.doc.resolve(before + sizeOf(nodes) + 1), 1));
    } else {
      const after = $anchor.before(1) + $anchor.node(1).nodeSize;
      tr.insert(after, [...nodes, trail]);
      tr.setSelection(TextSelection.near(tr.doc.resolve(after + sizeOf(nodes) + 1), 1));
    }
    editor.view.dispatch(tr.scrollIntoView());
    return true;
  };
}

/** Build an insert command from a node factory; unknown schema types fail honestly. */
function insertBuiltNodes(build: (nodes: Record<string, NodeType>) => readonly ProseMirrorNode[]): SlashInsertCommand {
  return (editor) => {
    try {
      return insertBlockNodes(build(editor.schema.nodes))(editor);
    } catch {
      return false;
    }
  };
}

const cell = (type: NodeType | undefined, nodes: Record<string, NodeType>): ProseMirrorNode | null =>
  type && nodes.paragraph ? type.create(null, [nodes.paragraph.create()]) : null;

/**
 * The built-in insert commands, keyed by registry block name. Converters reuse
 * the E04 toggle vocabulary (they run on the empty trigger paragraph, so a
 * toggle at rest is a plain conversion).
 */
const INSERT_COMMANDS: Record<string, SlashInsertCommand> = {
  paragraph: (editor) => editor.chain().command(setBlockFormat({ kind: 'paragraph' })).run(),
  heading: (editor) => editor.chain().command(setBlockFormat({ kind: 'heading', level: 2 })).run(),
  bulletList: (editor) => editor.chain().command(setBlockFormat({ kind: 'bulletList' })).run(),
  orderedList: (editor) => editor.chain().command(setBlockFormat({ kind: 'orderedList' })).run(),
  taskList: (editor) => editor.chain().command(setBlockFormat({ kind: 'taskList' })).run(),
  blockquote: (editor) => editor.chain().command(setBlockFormat({ kind: 'blockquote' })).run(),
  codeBlock: (editor) => editor.chain().command(setBlockFormat({ kind: 'codeBlock' })).run(),
  math: (editor) => editor.chain().command(insertMathBlock).run(),
  horizontalRule: insertBuiltNodes((nodes) => [nodes.horizontalRule.create()]),
  callout: insertBuiltNodes((nodes) => [nodes.callout.create(null, [nodes.paragraph.create()])]),
  table: insertBuiltNodes((nodes) => {
    const header = cell(nodes.tableHeader, nodes);
    const body = cell(nodes.tableCell, nodes);
    if (!header || !body) throw new TypeError('table cell types missing');
    return [nodes.table.create(null, [
      nodes.tableRow.create(null, [header]),
      nodes.tableRow.create(null, [body]),
    ])];
  }),
  columns: insertBuiltNodes((nodes) => [nodes.columns.create(null, [
    nodes.column.create(null, [nodes.paragraph.create()]),
    nodes.column.create(null, [nodes.paragraph.create()]),
  ])]),
  image: insertBuiltNodes((nodes) => [nodes.image.create()]),
  video: insertBuiltNodes((nodes) => [nodes.video.create()]),
  audio: insertBuiltNodes((nodes) => [nodes.audio.create()]),
  file: insertBuiltNodes((nodes) => [nodes.file.create()]),
  embed: insertBuiltNodes((nodes) => [nodes.embed.create()]),
  blockReference: insertBuiltNodes((nodes) => [nodes.blockReference.create()]),
  pageLink: insertBuiltNodes((nodes) => [nodes.pageLink.create()]),
  databaseView: insertBuiltNodes((nodes) => [nodes.databaseView.create()]),
  aiBlock: insertBuiltNodes((nodes) => [nodes.aiBlock.create(null, [nodes.paragraph.create()])]),
};

/** Register (or override) the insert command of one menu entry name. */
export function registerSlashInsert(name: string, run: SlashInsertCommand): void {
  INSERT_COMMANDS[name] = run;
}

/* ------------------------------------------------------------------ icons */

const FALLBACK_ICON: SlashItemIcon = Article;

/** One icon per registry block; unknown blocks fall back to a document glyph. */
const SLASH_ICONS: Record<string, SlashItemIcon> = {
  paragraph: TextT,
  heading: TextHOne,
  bulletList: List,
  orderedList: ListNumbers,
  taskList: CheckSquare,
  blockquote: Quotes,
  callout: Info,
  codeBlock: Code,
  math: FunctionIcon,
  horizontalRule: Minus,
  table: TableIcon,
  columns: Columns,
  image: ImageIcon,
  video: VideoIcon,
  audio: SpeakerHigh,
  file: Article,
  embed: Globe,
  blockReference: LinkIcon,
  pageLink: Article,
  databaseView: Database,
  aiBlock: Sparkle,
};

/* ------------------------------------------------------------------ model */

/**
 * The menu items of a registry: every definition with `slash` metadata, in
 * registry order, paired with its insert command. Entries without a
 * registered command render but insert nothing (they fail honestly).
 */
export function buildSlashItems(registry: BlockRegistry = createKnowledgeRegistry()): SlashMenuItem[] {
  return registry.getDefinitions()
    .filter((definition) => definition.slash)
    .map((definition) => {
      const { title, keywords, group } = definition.slash!;
      return {
        name: definition.name,
        title,
        keywords,
        group: group ?? 'text',
        icon: SLASH_ICONS[definition.name] ?? FALLBACK_ICON,
        run: INSERT_COMMANDS[definition.name] ?? (() => false),
      };
    });
}

/**
 * Case-insensitive query filter: a title prefix outranks a title substring,
 * which outranks a keyword hit; equal ranks keep registry order. An empty
 * query returns every item unchanged.
 */
export function filterSlashItems(items: readonly SlashMenuItem[], query: string): SlashMenuItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  const ranked: { item: SlashMenuItem; rank: number }[] = [];
  for (const item of items) {
    const title = item.title.toLowerCase();
    let rank: number;
    if (title.startsWith(needle)) rank = 0;
    else if (title.includes(needle)) rank = 1;
    else if (item.keywords.some((keyword) => keyword.toLowerCase().includes(needle))) rank = 2;
    else continue;
    ranked.push({ item, rank });
  }
  return ranked.sort((a, b) => a.rank - b.rank).map((entry) => entry.item);
}
