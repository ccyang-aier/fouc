import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

/** Makes the task marker itself clickable while keeping the shared schema's plain li DOM. */
export const TaskItemToggle = Extension.create({
  name: 'foucTaskItemToggle',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [new Plugin({
      props: {
        handleClickOn(view, _pos, node, nodePos, event) {
          if (!editor.isEditable || node.type.name !== 'taskItem') return false;
          const target = event.target;
          const item = target instanceof Element ? target.closest('li[data-task-item]') : null;
          if (!item) return false;
          const bounds = item.getBoundingClientRect();
          // The visual checkbox sits just left of the list item's text box.
          if (event.clientX < bounds.left - 28 || event.clientX > bounds.left + 6 || event.clientY > bounds.top + 32) return false;
          view.dispatch(view.state.tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, checked: !node.attrs.checked }));
          event.preventDefault();
          return true;
        },
      },
    })];
  },
});
