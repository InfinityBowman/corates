When implementing new Zag components, check existing components for patterns and the Zag docs from the CoRATES MCP tool. Always add new components to this list and any modifications if nececcary.

Here are the existing components and a summary of them:

- `Avatar.jsx` - User avatar with image and fallback initials (supports `src`, `name`, `alt`, `onStatusChange`, `class` props)
- `Checkbox.jsx` - Checkbox input with label
- `Collapsible.jsx` - Expandable/collapsible content sections
- `Dialog.jsx` - Modal dialogs
- `FileUpload.jsx` - File upload with drag-and-drop
- `FloatingPanel.jsx` - Draggable and resizable floating panel (supports `open`, `onOpenChange`, `title`, `defaultSize`, `defaultPosition`, `size`, `position`, `onSizeChange`, `onPositionChange`, `onStageChange`, `resizable`, `draggable`, `minSize`, `maxSize`, `lockAspectRatio`, `showControls`, `showResizeHandles` props)
- `PasswordInput.jsx` - Password input with show/hide toggle (supports `label`, `password`, `onPasswordChange`, `autoComplete`, `inputClass` props)
- `Splitter.jsx` - Resizable split panes
- `Switch.jsx` - Toggle switch
- `Tabs.jsx` - Tabbed content
- `Toast.jsx` - Toast notifications (use via `useToast` from `@primitives/useToast.jsx`)
- `Tooltip.jsx` - Tooltips with arrow support (supports `content`, `placement`, `openDelay`, `closeDelay` props)
