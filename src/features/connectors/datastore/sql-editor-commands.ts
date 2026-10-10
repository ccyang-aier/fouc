import { ensureSyntaxTree } from '@codemirror/language'
import type { ChangeSpec, EditorState } from '@codemirror/state'

/** Change keyword tokens only; retain identifiers, values, comments and spacing. */
export function sqlKeywordCaseChanges(state: EditorState): ChangeSpec[] | null {
  const tree = ensureSyntaxTree(state, state.doc.length, 50)
  if (!tree) return null
  const range = state.selection.main
  const keywords: Array<{ from: number; to: number; text: string }> = []
  tree.iterate({ enter(node) {
    if (node.name === 'Keyword' && (range.empty || node.from >= range.from && node.to <= range.to)) keywords.push({ from: node.from, to: node.to, text: state.sliceDoc(node.from, node.to) })
  } })
  const lower = keywords[0]?.text === keywords[0]?.text.toUpperCase()
  return keywords.map(({ from, to, text }) => ({ from, to, insert: lower ? text.toLowerCase() : text.toUpperCase() }))
}
