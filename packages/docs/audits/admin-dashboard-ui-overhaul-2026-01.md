# Admin Dashboard UI Overhaul Plan

**Date:** January 2026  
**Status:** Planning  
**Priority:** High  
**Reference:** Polar Dashboard ([reference/polar](../../../reference/polar))

## Executive Summary

This plan outlines a comprehensive UI overhaul for the CoRATES admin dashboard, drawing inspiration from Polar's polished design system. The goal is to achieve visual consistency, improved user experience, and a more professional appearance while maintaining our SolidJS + Tailwind stack.

---

## Part 1: Current State Analysis

### Issues Identified

1. **Inconsistent Component Structure**
   - No clear atomic design hierarchy (atoms, molecules, organisms)
   - Components mix layout concerns with business logic
   - No standardized Section/ShadowBox patterns

2. **Visual Inconsistencies**
   - Mixed border radius values (rounded-lg, rounded-md)
   - Inconsistent shadow usage (some cards have shadow-sm, others none)
   - Input focus styles vary across components
   - Text color hierarchy not consistently applied

3. **Missing Design Patterns**
   - No standardized container component (like Polar's ShadowBox)
   - No unified Section component for content groupings
   - No data table abstraction with consistent styling
   - Status badges have inconsistent implementations

4. **Layout Issues**
   - Dashboard body lacks consistent max-width constraints
   - Section spacing is ad-hoc (mb-6, mb-8, gap-4 mixed)
   - No responsive sidebar collapse pattern

### Current File Structure

```
packages/web/src/components/admin/
  AdminDashboard.jsx      # Main dashboard
  AdminLayout.jsx         # Layout wrapper
  AnalyticsSection.jsx    # Charts section
  UserTable.jsx           # User management table
  OrgList.jsx             # Organization list
  ProjectList.jsx         # Project explorer
  StorageManagement.jsx   # Storage admin
  billing-observability/  # Stripe admin tools
  charts/                 # Chart components
  styles/
    admin-tokens.js       # Design tokens (needs expansion)
```

---

## Part 2: Polar Design Patterns to Adopt

### 2.1 Container Components

**Polar's ShadowBox Pattern:**

```jsx
// Clean container with consistent styling
<ShadowBox className='...'>{children}</ShadowBox>

// Base styles: rounded-xl border bg-gray-50 p-8 lg:rounded-4xl
```

**Action:** Create `AdminBox` component with configurable padding and optional header.

### 2.2 Section Component

**Polar's Section Pattern:**

```jsx
<Section title='Users' description='Manage system users' cta={<Button>Add User</Button>}>
  {content}
</Section>
```

**Features:**

- Consistent title typography (text-lg font-medium)
- Optional description (text-gray-500)
- Optional CTA slot in header
- Configurable compact mode

### 2.3 Data Table Abstraction

**Polar's DataTable Pattern:**

- Wraps @tanstack/react-table
- Consistent header styling (bg-gray-50 or dark:bg-polar-800)
- Rounded corners on container (rounded-2xl border)
- Built-in loading skeleton
- Pagination component included

**Action:** Create `AdminDataTable` wrapper using `@tanstack/solid-table` with:

- Full TanStack Table integration (sorting, filtering, pagination)
- Loading state with skeletons
- Empty state slot
- Consistent styling
- Optional row selection
- Built-in pagination component

**Installed:** `@tanstack/solid-table ^8.21.3`

### 2.4 Input Styling

**Polar's Input Pattern:**

```css
h-10 rounded-xl border border-gray-200 bg-white px-3 py-2
text-base shadow-xs outline-none placeholder:text-gray-400
focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100
```

**Key differences from current:**

- Uses `ring-[3px]` not `ring-2`
- Focus ring color is `ring-blue-100` (lighter)
- Border changes to `border-blue-300` on focus
- Includes `shadow-xs` baseline

### 2.5 Button Variants (CVA Pattern)

**Polar uses class-variance-authority (cva):**

```js
const buttonVariants = cva('base-classes', {
  variants: {
    variant: { default, destructive, outline, secondary, ghost, link },
    size: { default, sm, lg, icon }
  },
  defaultVariants: { variant: 'default', size: 'default' }
})
```

**Action:** Adopt CVA for button variants in design tokens.

### 2.6 Status Badges

**Polar's Status Component:**

```jsx
<Status status='Active' className='bg-green-100 text-green-800' />
// Base: flex items-center justify-center rounded-[0.5em] px-[0.7em] py-[0.3em]
```

---

## Part 3: Implementation Phases

### Phase 1: Foundation Components (2-3 days)

**Files to create:**

1. **`AdminBox.jsx`** - Container component

   ```jsx
   // Base wrapper replacing ad-hoc card patterns
   // Props: padding ('compact' | 'default' | 'spacious'), className
   // Styles: rounded-xl border border-gray-200 bg-white shadow-xs
   ```

2. **`AdminSection.jsx`** - Section grouping component

   ```jsx
   // Props: title, description, cta, compact, className, children
   // Handles section header layout consistently
   ```

3. **`AdminDataTable.jsx`** - Table abstraction

   ```jsx
   // Props: columns, data, loading, emptyState, pagination, onRowClick
   // Wraps table with consistent container + header styling
   ```

4. **Update `admin-tokens.js`**
   - Add CVA-style button variant generator
   - Add new input focus styles (softer ring)
   - Add spacing scale constants
   - Add animation tokens (for loading states)

**Files to update:**

- `AdminDashboard.jsx` - Use new Section component
- `UserTable.jsx` - Migrate to AdminDataTable pattern

### Phase 2: Layout Restructure (2 days)

**Objectives:**

- Create `DashboardBody` wrapper with max-width constraints
- Implement consistent page header pattern
- Add responsive sidebar improvements

**Files to create:**

1. **`DashboardHeader.jsx`**

   ```jsx
   // Props: title, description, icon, actions
   // Consistent page header across all admin views
   ```

2. **`DashboardBody.jsx`**
   ```jsx
   // Wrapper providing max-width, padding, scroll behavior
   // Props: wide (boolean for full-width mode)
   ```

**Files to update:**

- `AdminLayout.jsx` - Integrate DashboardBody
- All page components - Use DashboardHeader

### Phase 3: Component Migration (3-4 days)

**Migrate each component to use new patterns:**

| Component                 | Changes                                     |
| ------------------------- | ------------------------------------------- |
| `AdminDashboard.jsx`      | Use AdminSection, AdminBox, DashboardHeader |
| `UserTable.jsx`           | Use AdminDataTable, AdminSection            |
| `OrgList.jsx`             | Use AdminDataTable, AdminSection, AdminBox  |
| `ProjectList.jsx`         | Use AdminDataTable, AdminSection            |
| `StorageManagement.jsx`   | Use AdminSection, AdminBox                  |
| `AnalyticsSection.jsx`    | Use AdminSection with chart grid            |
| `OrgDetail.jsx`           | Use AdminSection, AdminBox for sub-sections |
| `billing-observability/*` | Update all to use new patterns              |

### Phase 4: Input & Form Styling (1-2 days)

**Objectives:**

- Standardize all inputs with new focus ring style
- Add input slot support (icons, actions)
- Create form field wrapper component

**Files to create:**

1. **`AdminInput.jsx`**

   ```jsx
   // Props: preSlot, postSlot, size, className
   // Implements Polar-style soft focus rings
   ```

2. **`AdminSelect.jsx`**
   ```jsx
   // Styled select with consistent focus states
   ```

**Update across all components:**

- Search inputs
- Filter dropdowns
- Form fields in dialogs

### Phase 5: Polish & Refinement (2 days)

**Tasks:**

1. **Loading States**
   - Add skeleton components
   - Consistent spinner placement
   - Loading overlays for tables

2. **Empty States**
   - Create EmptyState component
   - Add to tables and lists
   - Include optional action CTA

3. **Animations**
   - Subtle hover transitions
   - Loading fade-in effects
   - Accordion/collapse animations

4. **Accessibility Audit**
   - Verify focus rings visible on all interactive elements
   - Check color contrast ratios
   - Add aria-labels where missing

---

## Part 4: Design Token Updates

### New Token Structure

```javascript
// admin-tokens.js

// Spacing Scale (consistent with Polar)
export const spacing = {
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
};

// Border Radius Scale
export const radius = {
  sm: '0.375rem', // rounded-sm
  md: '0.5rem', // rounded-md
  lg: '0.75rem', // rounded-lg
  xl: '1rem', // rounded-xl
  '2xl': '1.5rem', // rounded-2xl
  '4xl': '2rem', // rounded-4xl (Polar's large cards)
};

// Shadow Scale (softer than defaults)
export const shadow = {
  xs: '0 0px 2px rgba(0, 0, 0, 0.04)',
  sm: '0 0px 8px rgba(0, 0, 0, 0.04), 0 0px 2px rgba(0, 0, 0, 0.06)',
  md: '0 0px 15px rgba(0, 0, 0, 0.04), 0 0px 2px rgba(0, 0, 0, 0.06)',
};

// Focus Ring (softer, Polar-style)
export const focusRing = {
  default: 'focus:outline-none focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100',
  error: 'focus:outline-none focus:border-red-300 focus:ring-[3px] focus:ring-red-100',
};

// Text Colors (refined hierarchy)
export const text = {
  primary: 'text-gray-900', // Headings, primary content
  secondary: 'text-gray-500', // Descriptions, labels
  tertiary: 'text-gray-400', // Hints, placeholders
  disabled: 'text-gray-300', // Disabled states
  inverse: 'text-white', // On dark backgrounds
};

// Background Colors
export const bg = {
  page: 'bg-gray-50', // Page background
  card: 'bg-white', // Card/box background
  elevated: 'bg-white', // Elevated surfaces
  subtle: 'bg-gray-50', // Subtle backgrounds (table headers)
  hover: 'hover:bg-gray-50', // Hover states
  active: 'bg-blue-50', // Active/selected states
};
```

### Button Variants (CVA-style)

```javascript
// Using cva-like pattern for SolidJS
export const buttonVariants = (variant = 'default', size = 'default') => {
  const base =
    'inline-flex items-center justify-center cursor-pointer font-medium select-none rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap';

  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 border border-blue-700',
    destructive: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
    outline: 'border border-gray-200 bg-transparent hover:bg-gray-50 text-gray-900',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-900',
    link: 'text-blue-600 hover:underline bg-transparent',
  };

  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-8 px-3 py-1.5 text-xs rounded-lg',
    lg: 'h-12 px-5 py-3',
    icon: 'h-8 w-8 p-2',
  };

  return `${base} ${variants[variant]} ${sizes[size]}`;
};
```

---

## Part 5: Component Specifications

### AdminBox Component

```jsx
/**
 * AdminBox - Consistent container component
 *
 * @param {Object} props
 * @param {'compact'|'default'|'spacious'} props.padding - Padding size
 * @param {string} props.className - Additional classes
 * @param {JSX.Element} props.children - Box content
 */
export function AdminBox(props) {
  const paddingClasses = {
    compact: 'p-4',
    default: 'p-6',
    spacious: 'p-8',
  };

  return (
    <div
      class={`rounded-xl border border-gray-200 bg-white shadow-xs ${paddingClasses[props.padding || 'default']} ${props.className || ''}`}
    >
      {props.children}
    </div>
  );
}
```

### AdminSection Component

```jsx
/**
 * AdminSection - Section grouping with header
 *
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {string} props.description - Optional description
 * @param {JSX.Element} props.cta - Optional action button
 * @param {boolean} props.compact - Use compact spacing
 * @param {JSX.Element} props.children - Section content
 */
export function AdminSection(props) {
  return (
    <div class={`flex flex-col ${props.compact ? 'gap-4' : 'gap-6'}`}>
      <div class='flex flex-col gap-1'>
        <div class='flex items-center justify-between'>
          <h2 class='text-lg font-medium text-gray-900'>{props.title}</h2>
          <Show when={props.cta}>{props.cta}</Show>
        </div>
        <Show when={props.description}>
          <p class='text-sm text-gray-500'>{props.description}</p>
        </Show>
      </div>
      {props.children}
    </div>
  );
}
```

### AdminDataTable Component

```jsx
import {
  createSolidTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/solid-table';
import { createSignal, For, Show } from 'solid-js';

/**
 * AdminDataTable - TanStack Table wrapper with consistent styling
 *
 * @param {Object} props
 * @param {Array} props.columns - TanStack column definitions
 * @param {Array} props.data - Table data
 * @param {boolean} props.loading - Loading state
 * @param {JSX.Element} props.emptyState - Empty state component
 * @param {boolean} props.enableSorting - Enable column sorting
 * @param {boolean} props.enablePagination - Enable pagination
 * @param {number} props.pageSize - Items per page (default: 10)
 * @param {Function} props.onRowClick - Row click handler
 */
export function AdminDataTable(props) {
  const [sorting, setSorting] = createSignal([]);

  const table = createSolidTable({
    get data() {
      return props.data || [];
    },
    get columns() {
      return props.columns;
    },
    state: {
      get sorting() {
        return sorting();
      },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: props.enableSorting ? getSortedRowModel() : undefined,
    getPaginationRowModel: props.enablePagination ? getPaginationRowModel() : undefined,
    initialState: {
      pagination: { pageSize: props.pageSize || 10 },
    },
  });

  return (
    <div class='flex flex-col gap-4'>
      <div class='overflow-hidden rounded-xl border border-gray-200'>
        <table class='w-full'>
          <thead class='border-b border-gray-200 bg-gray-50'>
            <For each={table.getHeaderGroups()}>
              {headerGroup => (
                <tr>
                  <For each={headerGroup.headers}>
                    {header => (
                      <th
                        class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'
                        classList={{ 'cursor-pointer select-none': header.column.getCanSort() }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div class='flex items-center gap-2'>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <Show when={header.column.getIsSorted()}>
                            <span>{header.column.getIsSorted() === 'asc' ? ' ^' : ' v'}</span>
                          </Show>
                        </div>
                      </th>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>
          <tbody class='divide-y divide-gray-200'>
            <Show when={props.loading}>
              <For each={Array(5).fill(0)}>
                {() => (
                  <tr>
                    <For each={props.columns}>
                      {() => (
                        <td class='px-6 py-4'>
                          <div class='h-4 animate-pulse rounded bg-gray-200' />
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </Show>
            <Show when={!props.loading && table.getRowModel().rows.length === 0}>
              <tr>
                <td colspan={props.columns.length} class='px-6 py-12 text-center'>
                  {props.emptyState || <span class='text-gray-500'>No data available</span>}
                </td>
              </tr>
            </Show>
            <Show when={!props.loading && table.getRowModel().rows.length > 0}>
              <For each={table.getRowModel().rows}>
                {row => (
                  <tr
                    class='hover:bg-gray-50'
                    classList={{ 'cursor-pointer': !!props.onRowClick }}
                    onClick={() => props.onRowClick?.(row.original)}
                  >
                    <For each={row.getVisibleCells()}>
                      {cell => (
                        <td class='px-6 py-4 text-sm text-gray-900'>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      <Show when={props.enablePagination && table.getPageCount() > 1}>
        <div class='flex items-center justify-between px-2'>
          <span class='text-sm text-gray-500'>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div class='flex gap-2'>
            <button
              class='rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50'
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </button>
            <button
              class='rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50'
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
```

---

## Part 6: Migration Checklist

### Pre-Migration

- [ ] Create new component files (AdminBox, AdminSection, AdminDataTable)
- [ ] Update admin-tokens.js with new token structure
- [ ] Test new components in isolation

### Phase 1 Migration

- [ ] AdminDashboard.jsx - Wrap stats in AdminSection
- [ ] AdminDashboard.jsx - Use AdminBox for stats cards
- [ ] UserTable.jsx - Migrate to AdminDataTable

### Phase 2 Migration

- [ ] OrgList.jsx - Use AdminSection + AdminDataTable
- [ ] ProjectList.jsx - Use AdminSection + AdminDataTable
- [ ] StorageManagement.jsx - Use AdminSection + AdminBox

### Phase 3 Migration

- [ ] OrgDetail.jsx - Sub-sections with AdminBox
- [ ] OrgBillingSummary.jsx - Use AdminBox
- [ ] SubscriptionList.jsx - Use AdminDataTable
- [ ] GrantList.jsx - Use AdminDataTable

### Phase 4 Migration

- [ ] billing-observability/AdminBillingLedgerPage.jsx
- [ ] billing-observability/AdminBillingStuckStatesPage.jsx
- [ ] billing-observability/StripeToolsPage.jsx

### Polish

- [ ] Add skeleton loading states
- [ ] Add empty states with CTAs
- [ ] Audit all focus states
- [ ] Test keyboard navigation
- [ ] Verify mobile responsiveness

---

## Part 7: Success Criteria

1. **Visual Consistency**
   - All containers use AdminBox or AdminSection
   - All tables use AdminDataTable pattern
   - Consistent spacing scale throughout

2. **Code Quality**
   - No hardcoded styling (use design tokens)
   - Components are composable and reusable
   - Clear prop interfaces

3. **User Experience**
   - Smooth loading transitions
   - Clear empty states
   - Accessible focus indicators
   - Responsive at all breakpoints

4. **Maintainability**
   - Easy to add new admin pages
   - Design changes propagate through tokens
   - Clear component hierarchy

---

## Appendix: Reference Files

### Polar Source Files (for reference)

- `reference/polar/clients/packages/ui/src/components/atoms/ShadowBox.tsx`
- `reference/polar/clients/packages/ui/src/components/atoms/Button.tsx`
- `reference/polar/clients/packages/ui/src/components/atoms/Input.tsx`
- `reference/polar/clients/packages/ui/src/components/atoms/datatable/DataTable.tsx`
- `reference/polar/clients/apps/web/src/components/Layout/Section.tsx`
- `reference/polar/clients/apps/web/src/components/Settings/Section.tsx`
- `reference/polar/clients/apps/app/design-system/theme.ts`
- `reference/polar/clients/apps/web/src/styles/globals.css`

### Current CoRATES Files to Update

- `packages/web/src/components/admin/styles/admin-tokens.js`
- `packages/web/src/components/admin/*.jsx` (all components)

---

## Timeline Estimate

| Phase               | Duration       | Dependencies |
| ------------------- | -------------- | ------------ |
| Phase 1: Foundation | 2-3 days       | None         |
| Phase 2: Layout     | 2 days         | Phase 1      |
| Phase 3: Migration  | 3-4 days       | Phase 1, 2   |
| Phase 4: Inputs     | 1-2 days       | Phase 1      |
| Phase 5: Polish     | 2 days         | All phases   |
| **Total**           | **10-13 days** |              |

---

## Notes

- Do not use emojis anywhere in the implementation
- Follow existing project conventions (SolidJS patterns, JSX syntax)
- Test in Safari specifically (known to have CSS rendering quirks)
- Components should work with existing TanStack Query patterns
- Maintain backwards compatibility during migration
