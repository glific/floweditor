# Copy-Paste Nodes Feature

Implementation documentation for the Copy-Paste Nodes feature in the Glific Flow Editor.

---

## Overview

Users building chatbot flows often create multiple nodes with similar configurations. This feature lets them copy any node and paste it — in the same flow or a different flow — instead of manually recreating it each time.

---

## User Experience

### Copying a Node

1. Hover over any node in the canvas.
2. A **copy icon** appears in the top-right corner of the node's title bar (action nodes: first action only; router nodes: the router header).
3. Clicking the icon triggers a **toast notification**:
   > "Node copied to clipboard. Ctrl+V to paste. Esc to cancel."
4. The toast auto-dismisses after 5 seconds.

### Pasting a Node

- Press **Ctrl+V** (Windows/Linux) or **Cmd+V** (Mac) anywhere on the canvas.
- The node pastes at the **current mouse cursor position**, snapped to grid.
- You can paste multiple times — the clipboard is not cleared on paste.

### Clearing the Clipboard

- Press **Esc** to clear the clipboard and dismiss the toast.
- Clipboard also clears automatically when the toast times out (via `onDismiss`).

### Cross-Flow Paste

- The clipboard **persists across flow navigation** using `localStorage`.
- If the pasted node references `@results.xyz` that does not exist in the destination flow, the node renders with a **red warning indicator** using the existing issues system.
- Error shown: `"Invalid result variable detected. Please check the result variable configuration."`

---

## Design Decisions

### 1. Where to Show the Copy Icon

**Decision:** Inside the TitleBar of the first action header (action nodes) or the router header (router nodes).

**Why:** TitleBar already has the hover-reveal infrastructure for Remove and Move Up buttons. Adding the copy icon there required zero new CSS patterns — it reuses the existing `visibility: hidden` + `:hover { visibility: visible }` approach, keeping the UI consistent.

**Alternative considered:** An absolutely-positioned icon on the node container. Rejected because it would have needed new hover state management and z-index handling.

### 2. Toast vs Modal Notification

**Decision:** A lightweight, non-blocking, auto-dismissing toast fixed at `top: 20px; right: 20px;`.

**Why:** A modal would interrupt the user's flow (pun intended). The toast gives feedback without blocking canvas interaction. The user can immediately press Ctrl+V right after seeing the message.

### 3. Clipboard Persistence Strategy

**Decision:** Dual-layer persistence — Redux `editorState.copiedNode` (in-memory, current session) + `localStorage` (cross-flow, cross-session).

**Why:** Redux state is lost on flow navigation (component unmounts and remounts). `localStorage` survives navigation, enabling cross-flow paste. `pasteNode` checks Redux first, falls back to localStorage.

```
Copy  →  Redux state  +  localStorage
Paste →  Redux state (primary)  →  localStorage (fallback)
Clear →  Both cleared
```

### 4. UUID Remapping Strategy

**Decision:** Deep clone via `JSON.parse/JSON.stringify`, then remap all UUIDs with an `old → new` map.

**Why:** A shallow clone would share UUID references with the original, causing jsPlumb connection conflicts and Redux state corruption. The old→new map allows internal references (e.g., `category.exit_uuid → exit.uuid`, `case.category_uuid → category.uuid`, `router.default_category_uuid`) to be remapped correctly after the fact.

**What gets remapped:**

- `node.uuid`
- `action.uuid` (all actions)
- `exit.uuid` (all exits) — `destination_uuid` set to `null` (no outbound connections)
- `category.uuid` + `category.exit_uuid`
- `case.uuid` + `case.category_uuid`
- `router.default_category_uuid`
- `inboundConnections` reset to `{}`
- `ghost` property deleted

### 5. Result Variable Naming

**Decision:** Auto-increment with `copy_of_` prefix. Pattern: `copy_of_<original>`, then `copy_of_<original>_01`, `_02`, etc.

**Why:** Avoids silent result name collisions that would cause incorrect data being written/read. The user gets a predictable naming scheme they can recognize and rename.

**Scope:** Handles both `set_run_result` action `name` field and `router.result_name`.

### 6. Cross-Flow @results Validation

**Decision:** Use the existing `FlowIssue` / `FlowIssueMap` system (Option A: inline issues on pasted node).

**Why:** The issues system was already built for exactly this purpose — flagging invalid references on nodes. Reusing it means no new UI code, consistent visual language (red indicators), and the user can click through to the specific action that has the bad reference.

**Detection:** Scans `JSON.stringify(action)` for all actions and `router.operand` using regex `/@results\.([a-zA-Z0-9_]+)/g`. Checks each matched key against the current flow's `assetStore.results`.

**Timing:** Issues are detected _before_ registering the pasted node's own result name, so a `set_run_result` node copying itself into another flow doesn't falsely report its own result as missing.

### 7. Interactive Message Node

**Decision:** Copy only the action node — do not automatically copy the paired Wait for Response router.

**Why:** Copying the paired WFR too would require tracking implicit node relationships and wiring up new connections between them, which is complex and error-prone. The user can copy the WFR separately if needed.

### 8. Mouse Position Tracking for Paste

**Decision:** Dedicated `pasteX` / `pasteY` instance variables on `Canvas`, updated unconditionally in `handleMouseMove`.

**Why:** The canvas's existing `lastX`/`lastY` variables are only updated during active drag operations. For paste, the user's mouse is not dragging — it's just hovering. Tracking it unconditionally gives a reliable cursor position at the moment Ctrl+V is pressed.

**Coordinate math:**

```
canvasX = pasteX - canvas.getBoundingClientRect().left
canvasY = pasteY - canvas.getBoundingClientRect().top - window.scrollY
position = snapToGrid(canvasX, canvasY)
```

---

## Architecture

### Data Flow

```
User clicks copy icon
  └─> Action.tsx / Node.tsx: handleCopy()
      └─> copyNode(nodeUUID) thunk
          ├─> localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(renderNode))
          └─> mergeEditorState({ copiedNode, toast })
              └─> FlowEditor renders <Toast> (auto-dismisses after 5s)

User presses Ctrl+V
  └─> Canvas.tsx: handleKeyDown()
      └─> pasteNode({ left, top }) thunk
          ├─> Read copiedNode from Redux (or localStorage fallback)
          ├─> cloneNodeWithNewUUIDs() — new UUIDs, no connections
          ├─> resolveResultNames() — rename copy_of_* if needed
          ├─> set position = snapped mouse coordinates
          ├─> mutators.mergeNode() → dispatch(updateNodes)
          ├─> detectCrossFlowIssues() → dispatch(updateIssues) if any
          ├─> mutators.addResultToStore() + addFlowResult() if result names exist
          ├─> markDirty() — debounced flow save
          └─> mergeEditorState({ toast: null }) — dismiss toast

User presses Esc
  └─> Canvas.tsx: handleKeyDown()
      └─> clearCopiedNode() thunk
          ├─> localStorage.removeItem(CLIPBOARD_KEY)
          └─> mergeEditorState({ copiedNode: null, toast: null })
```

### State Shape

Two fields added to `EditorState` (`src/store/editor.ts`):

```typescript
copiedNode: RenderNode | null; // in-memory clipboard (current session)
toast: ToastMessage | null; // active toast notification

interface ToastMessage {
  message: string;
  duration?: number;
}
```

---

## Files Changed

| File                                            | Change                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/store/clipboardHelpers.ts`                 | **NEW** — pure helper functions (no Redux dependency)                                                             |
| `src/store/editor.ts`                           | Added `copiedNode`, `toast` to `EditorState` and `ToastMessage` interface                                         |
| `src/store/thunks.ts`                           | Added `copyNode`, `pasteNode`, `clearCopiedNode` thunks and their type exports                                    |
| `src/components/toast/Toast.tsx`                | **NEW** — auto-dismissing toast component                                                                         |
| `src/components/toast/Toast.module.scss`        | **NEW** — toast styles with slide-in animation                                                                    |
| `src/components/titlebar/TitleBar.tsx`          | Added `showCopy` / `onCopy` props and copy button rendering                                                       |
| `src/components/titlebar/TitleBar.module.scss`  | Added `.copy_button` hover-reveal styles                                                                          |
| `src/components/flow/actions/action/Action.tsx` | Wired `copyNode` to action TitleBar (first action only)                                                           |
| `src/components/flow/node/Node.tsx`             | Wired `copyNode` to router TitleBar                                                                               |
| `src/components/canvas/Canvas.tsx`              | Added `pasteX`/`pasteY` tracking, Ctrl+V and Esc key handlers                                                     |
| `src/components/flow/Flow.tsx`                  | Passed `pasteNode` / `clearCopiedNode` to Canvas                                                                  |
| `src/components/index.tsx`                      | Rendered Toast, wired `toast` state and `clearCopiedNode`                                                         |
| `src/components/flow/Flow.test.ts`              | Added `pasteNode` / `clearCopiedNode` to test mock props                                                          |
| `src/components/index.test.ts`                  | Added `toast`, `clearCopiedNode`, `reset`, `updateTranslationFilters`, `onUpdateLocalizations` to test mock props |

---

## Key Helper Functions (`src/store/clipboardHelpers.ts`)

### `cloneNodeWithNewUUIDs(source: RenderNode): RenderNode`

Deep-clones a `RenderNode` and assigns fresh UUIDs to all internal identifiers. Resets `inboundConnections` to `{}` and clears `destination_uuid` on all exits so the cloned node starts with no connections.

### `generateCopyResultName(original: string, existingKeys: string[]): string`

Returns `copy_of_<original>`. If that name is already taken (checked via `snakify()`), increments to `copy_of_<original>_01`, `_02`, up to `_99`, then falls back to a UUID suffix.

### `resolveResultNames(cloned: RenderNode, existingKeys: string[]): void`

Mutates the cloned node in-place. Renames:

- `set_run_result` action `name` field
- `router.result_name`

Updates a local copy of `existingKeys` as it goes so multiple result names in the same node don't conflict with each other.

### `detectCrossFlowIssues(node: FlowNode, currentResultKeys: string[]): FlowIssue[]`

Scans action JSON strings and `router.operand` for `@results.xxx` expressions. For each key not found in `currentResultKeys`, emits a `FlowIssue` of type `MISSING_DEPENDENCY` with the description:

> "Invalid result variable detected. Please check the result variable configuration."

---

## Node Type Behavior Reference

| Node Type            | Content Copied                                          | Special Handling                            |
| -------------------- | ------------------------------------------------------- | ------------------------------------------- |
| Send Message         | message, labels, attachments, expressions, HSM template | None                                        |
| Wait for Response    | validation rules, categories                            | `router.result_name` renamed to `copy_of_*` |
| Interactive Message  | message body, options, translations, dynamic options    | Copy action node only (not paired WFR)      |
| Update Contact       | contact field + value/expression                        | None                                        |
| Save Result          | value/expression                                        | `action.name` renamed to `copy_of_*`        |
| Add to Collection    | node config referencing existing collection             | Collection not duplicated                   |
| Google Sheet (read)  | sheet name, row value, result name                      | None                                        |
| Google Sheet (write) | sheet name, field entries                               | None                                        |
| Call Webhook         | function, function body, API endpoint                   | None                                        |

---

## localStorage Schema

**Key:** `floweditor_clipboard`

**Value:** JSON-serialized `RenderNode` object (the original, not the clone — cloning happens on paste so each paste gets independent UUIDs).

```json
{
  "node": { "uuid": "...", "actions": [...], "exits": [...], "router": null },
  "ui": { "position": { "left": 120, "top": 240 }, "type": "execute_actions" },
  "inboundConnections": {}
}
```

---

## Keyboard Shortcuts

| Shortcut           | Action                               |
| ------------------ | ------------------------------------ |
| `Ctrl+V` / `Cmd+V` | Paste copied node at cursor position |
| `Esc`              | Clear clipboard and dismiss toast    |

**Note:** Ctrl+V is ignored when the cursor is inside an `<input>` or `<textarea>` element to avoid intercepting normal text paste.
