# @corates/ui

Shared UI component library for Corates built with [Ark UI](https://ark-ui.com/) and [SolidJS](https://solidjs.com/).

Most components have been migrated from Zag.js to Ark UI, which provides a more modern and maintainable API while maintaining backward compatibility.

## Installation

This package is meant to be used within the Corates monorepo. Add it as a dependency:

```bash
pnpm add @corates/ui --workspace
```

## Usage

Import components from the package:

```jsx
import { Dialog, Select, Toast, toaster } from '@corates/ui';
```

## Components

The following components are available (most migrated to Ark UI):

| Component     | Description                                          |
| ------------- | ---------------------------------------------------- |
| Accordion     | Expandable/collapsible content sections              |
| Avatar        | User avatar with fallback support                    |
| Checkbox      | Checkbox input with label support                    |
| Clipboard     | Copy to clipboard functionality                      |
| Collapsible   | Single collapsible content section                   |
| Combobox      | Searchable select with autocomplete                  |
| Dialog        | Modal dialog with backdrop                           |
| Editable      | Inline editable text                                 |
| FileUpload    | File upload with drag and drop                       |
| FloatingPanel | Draggable/resizable floating panel                   |
| Menu          | Dropdown menu with keyboard navigation               |
| NumberInput   | Numeric input with increment/decrement               |
| PasswordInput | Password input with visibility toggle                |
| PinInput      | OTP/PIN code input                                   |
| Popover       | Floating content panel                               |
| Progress      | Progress bar indicator                               |
| QRCode        | QR code generator                                    |
| RadioGroup    | Radio button group                                   |
| Select        | Dropdown select                                      |
| Splitter      | Resizable split panels                               |
| Switch        | Toggle switch                                        |
| Tabs          | Tabbed content panels                                |
| TagsInput     | Tag/chip input                                       |
| Toast/Toaster | Toast notifications (use `toaster` to create toasts) |
| ToggleGroup   | Group of toggle buttons                              |
| Tooltip       | Hover tooltips                                       |
| Tour          | Guided tour/onboarding                               |

## Styling

Components use Tailwind CSS classes. Make sure your Tailwind config includes the UI package in its content paths:

```js
// In your app's CSS or Tailwind config
@source "../../packages/ui/src/**/*.{js,jsx}";
```

## Peer Dependencies

This package requires the following peer dependencies:

- `solid-js` (^1.9.0)
- `solid-icons` (^1.1.0)
