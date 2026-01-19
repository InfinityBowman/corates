# Color Token Migration Audit

This document summarizes the color usage patterns across the codebase and provides migration guidance for adopting the semantic token system.

## Summary

| Category                                | Occurrences | Files | Priority |
| --------------------------------------- | ----------- | ----- | -------- |
| `gray-*` colors (should be `slate-*`)   | 309+        | 50+   | High     |
| `bg-blue-50` (app/hover backgrounds)    | 33+         | 21    | High     |
| `hover:bg-blue-50` patterns             | 28          | 21    | Medium   |
| `bg-blue-500/600/700` (primary buttons) | 143         | 88    | Medium   |
| Status colors (`emerald/amber/red-50`)  | 70+         | 30+   | Low      |
| Focus ring patterns                     | 183         | 90    | Low      |

## New Tokens Added

The following tokens were added to `global.css` to support common patterns:

```css
/* Light mode */
--color-primary-subtle: oklch(0.97 0.014 254.604); /* blue-50 */
--color-destructive-subtle: oklch(0.971 0.013 17.38); /* red-50 */
--color-success-subtle: oklch(0.979 0.021 166.113); /* emerald-50 */
--color-warning-subtle: oklch(0.987 0.022 95.277); /* amber-50 */

/* Dark mode */
--color-primary-subtle: oklch(0.282 0.091 267.935); /* blue-950 */
--color-destructive-subtle: oklch(0.258 0.092 26.042); /* red-950 */
--color-success-subtle: oklch(0.262 0.051 172.552); /* emerald-950 */
--color-warning-subtle: oklch(0.344 0.075 66.288); /* amber-950 */
```

## Migration Mappings

### High Priority: Gray to Slate

The codebase mixes `gray-*` and `slate-*` colors inconsistently. Slate has a subtle blue undertone that matches the primary brand color better.

| Current             | Token Replacement           | Direct Replacement   |
| ------------------- | --------------------------- | -------------------- |
| `bg-gray-50`        | `bg-background`             | `bg-slate-50`        |
| `bg-gray-100`       | `bg-muted`                  | `bg-slate-100`       |
| `bg-gray-200`       | `bg-secondary`              | `bg-slate-200`       |
| `text-gray-500`     | `text-muted-foreground`     | `text-slate-500`     |
| `text-gray-600`     | -                           | `text-slate-600`     |
| `text-gray-700`     | `text-secondary-foreground` | `text-slate-700`     |
| `text-gray-900`     | `text-foreground`           | `text-slate-900`     |
| `border-gray-200`   | `border-border`             | `border-slate-200`   |
| `hover:bg-gray-50`  | `hover:bg-muted`            | `hover:bg-slate-50`  |
| `hover:bg-gray-100` | `hover:bg-muted`            | `hover:bg-slate-100` |

### High Priority: Blue-50 Backgrounds

`bg-blue-50` is used extensively for:

- Main app background (Layout.jsx)
- Selected/active states
- Hover states
- Icon container backgrounds
- Info banners

| Current                  | Token Replacement               |
| ------------------------ | ------------------------------- |
| `bg-blue-50`             | `bg-primary-subtle`             |
| `hover:bg-blue-50`       | `hover:bg-primary-subtle`       |
| `group-hover:bg-blue-50` | `group-hover:bg-primary-subtle` |

**Key file:** `Layout.jsx:80` uses `bg-blue-50` for the main app background.

### Medium Priority: Primary Button Colors

| Current                 | Token Replacement             |
| ----------------------- | ----------------------------- |
| `bg-blue-600`           | `bg-primary`                  |
| `bg-blue-700`           | - (use `hover:bg-primary/90`) |
| `hover:bg-blue-700`     | `hover:bg-primary/90`         |
| `text-blue-600`         | `text-primary`                |
| `text-blue-700`         | `text-primary`                |
| `border-blue-600`       | `border-primary`              |
| `ring-blue-600`         | `ring-ring`                   |
| `focus:ring-blue-500`   | `focus:ring-ring`             |
| `focus:border-blue-500` | `focus:border-primary`        |

### Low Priority: Status Colors

For status indicators, banners, and badges:

| Current            | Token Replacement       |
| ------------------ | ----------------------- |
| `bg-emerald-50`    | `bg-success-subtle`     |
| `bg-green-50`      | `bg-success-subtle`     |
| `bg-emerald-600`   | `bg-success`            |
| `text-emerald-600` | `text-success`          |
| `bg-amber-50`      | `bg-warning-subtle`     |
| `bg-yellow-50`     | `bg-warning-subtle`     |
| `bg-amber-500`     | `bg-warning`            |
| `text-amber-600`   | `text-warning`          |
| `bg-red-50`        | `bg-destructive-subtle` |
| `bg-red-600`       | `bg-destructive`        |
| `text-red-600`     | `text-destructive`      |

## Files by Category

### Layout and Core (migrate first)

- `Layout.jsx` - Main app background (`bg-blue-50`)
- `Navbar.jsx` - Navigation styling
- `components/sidebar/*` - Sidebar components

### Settings Pages (already partially migrated)

- `ProfileSettings.jsx` - Uses tokens
- `PersonaSection.jsx` - Uses some tokens
- `AcademicInfoSection.jsx` - Uses some tokens
- Other settings pages - Need migration

### UI Components

- `components/ui/*.tsx` - Base UI components (buttons, inputs, etc.)
- These should use tokens for maximum theme flexibility

### Project Views

- `components/project/*` - Heavy use of blue-50 and gray colors
- `components/dashboard/*` - Mixed gray/slate usage

### Mocks (low priority)

- `components/mocks/*` - Demo/prototype components
- Can be migrated last or left as-is

## Suggested Migration Order

1. **Layout.jsx** - Change `bg-blue-50` to `bg-primary-subtle`
2. **UI components** (`components/ui/`) - Ensure base components use tokens
3. **Settings pages** - Complete token migration
4. **Dashboard components** - Migrate gray to slate/tokens
5. **Project components** - Largest surface area
6. **Remaining files** - Mocks and edge cases

## Considerations

### Gray vs Slate Decision

The codebase should standardize on either:

- **Option A:** Use `slate-*` everywhere (has blue undertone, matches brand)
- **Option B:** Use `gray-*` everywhere (pure neutral)

Recommendation: Use `slate-*` since it complements the blue primary color.

### When NOT to Use Tokens

Some cases may warrant keeping direct color references:

- One-off decorative elements
- Complex gradients
- Third-party component overrides
- Status badge colors that need to remain consistent regardless of theme

### Opacity Variants

For hover/focus states, prefer opacity variants over separate colors:

```jsx
// Preferred
className = 'bg-primary hover:bg-primary/90';

// Avoid
className = 'bg-blue-600 hover:bg-blue-700';
```

## Testing Dark Mode

After migration, test dark mode by adding `class="dark"` to the `<html>` element:

```js
document.documentElement.classList.add('dark');
```

All token-based colors should automatically switch to their dark variants.
