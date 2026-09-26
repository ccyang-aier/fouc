# CRDT origins and selective undo

This shared layer has no React, provider, network or storage dependency. Use `humanOrigin()` once per editor session; different windows must not share a human history. Pass that origin to local Yjs writes and pass the editor binding object (such as `ySyncPluginKey`) to `createLocalUndoManager`. The manager can be supplied to `yUndoPlugin({ undoManager })`; do not also install ProseMirror history.

Create `createTaskUndoManager(fragment, agentOrigin(taskId))` before streaming writes. It captures all local pieces of that task as one undo item regardless of pauses. MCP origins also contain an encoded client name and task ID, so simultaneous calls from one client stay isolated. `parseKnowledgeOrigin` supplies the display source. Restore and unlabelled transactions do not enter local human undo.

Transaction origins are process-local metadata. Yjs binary updates do not carry trusted author identity: network providers supply their own origin, and `transaction.local` rejects remote changes even if an origin label matches. Persist authorship in authenticated domain records and suggestion marks, never infer access rights from these strings. See [Yjs update origins](https://docs.yjs.dev/api/document-updates).

The [Yjs UndoManager](https://docs.yjs.dev/api/undo-manager) performs selective inverse operations. Our XML deletion guard additionally retains a parent block when other edits remain inside it, along with its required identity attributes. This includes nested containers and human attribute-only edits to media. An untouched inserted block is removed normally. The guard uses the pinned Yjs struct pointers and is covered by real Yjs/ProseMirror replica tests.

Undo managers are live-document resources: destroy them when their owning editor/task is disposed. This module does not claim persistent undo across process restarts; task orchestration and checkpoint restoration are later integration concerns.
