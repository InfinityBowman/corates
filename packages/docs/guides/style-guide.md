# CoRATES UI Style Guide

## Brand Identity

### Application Name

**CoRATES** - Collaborative Research Appraisal Tool for Evidence Synthesis

### Logo/Brand Icon

- Circular checkmark icon
- Primary color: `blue-600`
- White checkmark symbol inside

## Color Palette

### Primary Colors

- **Blue Primary**: `blue-600` (#2563eb)
- **Blue Dark**: `blue-700` (#1d4ed8)
- **Blue Light**: `blue-500` (#3b82f6)
- **Blue Hover**: `blue-800` (#1e40af)

### Accent Colors

- **Red**: `red-600` (#dc2626) for destructive actions
- **Red Hover**: `red-700` (#b91c1c)
- **Emerald**: `emerald-600` (#059669) for success states
- **Amber**: `amber-500` (#f59e0b) for warnings

### Neutral Colors (Slate)

The application uses the **slate** color palette (not gray):

- `slate-50` (#f8fafc) - page backgrounds, alternating rows
- `slate-100` (#f1f5f9) - subtle backgrounds, dividers
- `slate-200` (#e2e8f0) - borders, card outlines
- `slate-300` (#cbd5e1) - disabled states
- `slate-400` (#94a3b8) - placeholder text, muted labels
- `slate-500` (#64748b) - secondary text, descriptions
- `slate-600` (#475569) - body text
- `slate-700` (#334155) - headings, button text
- `slate-900` (#0f172a) - primary text, titles

### Background Colors

- **Page Background**: `bg-slate-50` or `bg-gradient-to-br from-slate-50 to-slate-100/80`
- **Card Background**: `bg-white`
- **Stat Card Variants**:
  - Default: `bg-slate-50 border-slate-200`
  - Success: `bg-emerald-50 border-emerald-200`
  - Info: `bg-blue-50 border-blue-200`

## Typography

### Font Family

Primary: Inter (system fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)

### Font Sizes

- **XS**: `text-xs` - 12px (labels, badges, meta)
- **SM**: `text-sm` - 14px (body text, descriptions)
- **Base**: `text-base` - 16px (section headers)
- **LG**: `text-lg` - 18px (card titles, names)
- **XL**: `text-xl` - 20px (page subtitles)
- **2XL**: `text-2xl` - 24px (page titles, large stats)

### Font Weights

- **Medium**: `font-medium` (body text, buttons)
- **Semibold**: `font-semibold` (section headers, labels)
- **Bold**: `font-bold` (stats, emphasis)

### Text Colors

- **Primary**: `text-slate-900`
- **Secondary**: `text-slate-600` or `text-slate-500`
- **Muted/Label**: `text-slate-400`
- **Placeholder**: `text-slate-400`
- **Brand/Links**: `text-blue-600`
- **Link Hover**: `text-blue-700`

### Label Pattern

Section labels use uppercase tracking:

```jsx
<label class='mb-1 block text-xs font-medium tracking-wide text-slate-400 uppercase'>Label Text</label>
```

## Layout & Spacing

### Container Patterns

- **Max Width**: `max-w-7xl mx-auto` for main content, `max-w-3xl` for settings
- **Page Padding**: `px-6 py-6` for main content areas
- **Card Padding**: `p-5` or `p-6` for cards

### Spacing Scale

- **Gap/Margin**: `gap-2`, `gap-3`, `gap-4`, `gap-6`
- **Padding**: `p-3`, `p-4`, `p-5`, `p-6`
- **Section Spacing**: `mb-6` between major sections

## Components

### Buttons

#### Primary Button

```jsx
<button class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50'>
  Primary Action
</button>
```

#### Secondary Button

```jsx
<button class='rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50'>
  Secondary Action
</button>
```

#### Text Button (Links)

```jsx
<button class='text-sm font-medium text-blue-600 transition-colors hover:text-blue-700'>Edit</button>
```

#### Icon Button

```jsx
<button class='rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-blue-500 focus:outline-none'>
  <FiTrash2 class='h-4 w-4' />
</button>
```

#### Disabled State (Quota Limit)

```jsx
<span class='inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-400'>
  <FiPlus class='h-4 w-4' />
  Invite
</span>
```

### Form Elements

#### Input Field

```jsx
<input class='block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none' />
```

#### Select (Ark UI)

Uses the `@/components/ui/select` component with `createListCollection`.

#### Label

```jsx
<label class='mb-1.5 block text-sm font-medium text-slate-700'>Field Label</label>
```

### Cards & Containers

#### Standard Card (Project View)

```jsx
<div class='rounded-xl border border-slate-200 bg-white p-5'>
  <h2 class='mb-5 text-base font-semibold text-slate-900'>Section Title</h2>
  {/* Content */}
</div>
```

#### Settings Card (with Header)

```jsx
<div class='overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md'>
  {/* Header */}
  <div class='border-b border-slate-100 bg-linear-to-r from-slate-50 to-white px-6 py-4'>
    <div class='flex items-center space-x-2.5'>
      <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50'>
        <FiIcon class='h-4 w-4 text-blue-600' />
      </div>
      <div>
        <h2 class='text-base font-semibold text-slate-900'>Section Title</h2>
        <p class='text-sm text-slate-500'>Description text</p>
      </div>
    </div>
  </div>
  {/* Content */}
  <div class='p-6'>{/* ... */}</div>
</div>
```

#### Stat Card

```jsx
<div class='rounded-lg border border-slate-200 bg-slate-50 p-4 text-center'>
  <div class='mb-2 flex justify-center'>
    <Icon class='h-5 w-5 text-slate-500' />
  </div>
  <p class='text-2xl font-bold text-slate-900'>42</p>
  <p class='mt-1 text-xs font-medium text-slate-500'>Label</p>
</div>
```

#### Stat Card Variants

```jsx
// Success variant
<div class='rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center'>
  <p class='text-2xl font-bold text-emerald-700'>12</p>
  <p class='mt-1 text-xs font-medium text-emerald-600'>Ready</p>
</div>

// Info variant
<div class='rounded-lg border border-blue-200 bg-blue-50 p-4 text-center'>
  <p class='text-2xl font-bold text-blue-700'>8</p>
  <p class='mt-1 text-xs font-medium text-blue-600'>Completed</p>
</div>
```

#### Collapsible Section

```jsx
<div class='overflow-hidden rounded-xl border border-slate-200 bg-white'>
  <Collapsible>
    <CollapsibleTrigger class='w-full cursor-pointer justify-between px-5 py-4 transition-colors select-none hover:bg-slate-50'>
      <h2 class='text-base font-semibold text-slate-900'>Section Title</h2>
      <div class='flex items-center gap-2 text-sm text-slate-500'>
        Click to expand
        <CollapsibleIndicator>
          <FiChevronDown class='h-4 w-4' />
        </CollapsibleIndicator>
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class='border-t border-slate-100 px-5 py-5'>{/* Content */}</div>
    </CollapsibleContent>
  </Collapsible>
</div>
```

### Navigation

#### Page Header (Sticky)

```jsx
<header class='sticky top-0 z-20 border-b border-slate-200 bg-white'>
  <div class='mx-auto max-w-7xl px-6'>{/* Header content */}</div>
</header>
```

#### Tab Navigation

Uses `@/components/ui/tabs` components:

```jsx
<TabsTrigger
  value='tab-value'
  class='group relative gap-2 rounded-t-lg px-4 py-2.5 text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-700 data-selected:text-slate-900'
>
  <span class='opacity-60 transition-opacity group-data-selected:opacity-100'>{icon}</span>
  <span class='font-medium'>Tab Label</span>
</TabsTrigger>
<TabsIndicator class='h-0.5 rounded-full bg-blue-600' />
```

#### Tab Badge

```jsx
<span class='min-w-6 rounded-full bg-slate-100 px-1.5 py-0.5 text-center text-xs font-medium text-slate-600 tabular-nums transition-colors group-data-selected:bg-blue-50 group-data-selected:text-blue-700'>
  {count}
</span>
```

### Badges & Tags

#### Role Badge

```jsx
<span class='inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize'>
  owner
</span>
```

#### Status Badge (Verified)

```jsx
<span class='inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/10'>
  <FiCheck class='h-3 w-3' />
  Verified
</span>
```

#### Count Badge (Project Card)

```jsx
<span class='inline-flex items-center rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800 capitalize'>
  {role}
</span>
```

### Avatars

Uses `@/components/ui/avatar` component:

```jsx
<Avatar class='h-9 w-9'>
  <AvatarImage src={imageUrl} alt={name} />
  <AvatarFallback class='bg-blue-600 text-white'>{getInitials(name)}</AvatarFallback>
</Avatar>
```

#### Avatar with Overlay (Profile Photo)

```jsx
<div class='group relative'>
  <img src={url} class='h-20 w-20 rounded-full object-cover shadow-md ring-2 ring-white' />
  <button class='absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-slate-900/60 opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100'>
    <FiCamera class='h-5 w-5 text-white' />
  </button>
</div>
```

#### Avatar Fallback (Initials)

```jsx
<div class='flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-blue-600 text-xl font-semibold text-white shadow-md'>
  {initials}
</div>
```

### Lists

#### Alternating Row

```jsx
<div
  class='flex items-center justify-between rounded-lg p-3 transition-colors'
  style={{ background: index() % 2 === 0 ? '#f8fafc' : 'transparent' }}
>
  {/* Row content */}
</div>
```

#### Divider Between Sections

```jsx
<div class='border-t border-slate-100' />
```

### Modals & Overlays

Uses `@/components/ui/alert-dialog` for confirmations:

```jsx
<AlertDialog open={open()} onOpenChange={setOpen}>
  <AlertDialogBackdrop />
  <AlertDialogPositioner>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogIcon variant='danger' />
        <div>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogDescription>Description text</AlertDialogDescription>
        </div>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction variant='danger'>Confirm</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialogPositioner>
</AlertDialog>
```

### Data Visualization

#### Chart Containers

See `ChartSection.jsx` for chart implementations.

#### Color Coding (AMSTAR Ratings)

- **Yes**: `#22c55e` (Green / emerald-500)
- **Partial Yes**: `#eab308` (Yellow / yellow-500)
- **No**: `#ef4444` (Red / red-500)
- **No MA/Not Applicable**: `#e5e7eb` (Gray / slate-200)

## Animation & Transitions

### Standard Transitions

- **Duration**: `duration-200` for hover states
- **Easing**: `transition-all`, `transition-colors`, `transition-shadow`
- **Opacity**: `transition-opacity`

### Hover Effects

- **Shadow**: `hover:shadow-md` for cards
- **Background**: `hover:bg-slate-50` for interactive rows
- **Text Color**: `hover:text-blue-700` for links

### Focus States

- **Ring**: `focus:ring-2 focus:ring-blue-500/20`
- **Border**: `focus:border-blue-500`
- **Outline**: `focus:outline-none`

## Page Layouts

### Settings Page

```jsx
<div class='min-h-full bg-linear-to-br from-slate-50 to-slate-100/80 py-8'>
  <div class='mx-auto max-w-3xl px-4 sm:px-6'>
    {/* Page header */}
    <div class='mb-8'>
      <h1 class='text-2xl font-semibold tracking-tight text-slate-900'>Page Title</h1>
      <p class='mt-1 text-slate-500'>Page description</p>
    </div>

    {/* Cards */}
    <div class='mb-6'>{/* Card content */}</div>
  </div>
</div>
```

### Project View

```jsx
<div class='min-h-screen bg-slate-50'>
  {/* Sticky header with tabs */}
  <header class='sticky top-0 z-20 border-b border-slate-200 bg-white'>
    <div class='mx-auto max-w-7xl px-6'>{/* Header + Tabs */}</div>
  </header>

  {/* Main content */}
  <main class='mx-auto max-w-7xl px-6 py-6'>{/* Tab content */}</main>
</div>
```

## Accessibility

### Focus States

All interactive elements use:

```
focus:ring-2 focus:ring-blue-500/20 focus:outline-none
```

### Color Contrast

- Primary text (`slate-900`) on white backgrounds: 15.4:1
- Secondary text (`slate-500`) on white backgrounds: 5.6:1
- Blue links (`blue-600`) on white backgrounds: 4.5:1

### Interactive Elements

- Minimum touch target: 44px for mobile
- Clear visual feedback for all interactive states
- Proper ARIA labels via Ark UI components

## Implementation Notes

### Framework

- Built with **SolidJS** and **Tailwind CSS v4**
- UI components from **Ark UI** (`@ark-ui/solid`)
- Icons from **solid-icons** (fi, bi, ai, cg prefixes)

### Component Library

Use components from `@/components/ui/`:

- `select` - Dropdown selects with collections
- `tabs` - Tab navigation
- `switch` - Toggle switches
- `avatar` - User avatars with fallbacks
- `collapsible` - Expandable sections
- `alert-dialog` - Confirmation dialogs
- `toast` - Notifications
- `editable` - Inline editing

### Responsive Design

- Mobile-first approach with `sm:` and `md:` breakpoints
- Flexible layouts with `flex-col sm:flex-row` patterns
- Grid layouts: `grid-cols-2 md:grid-cols-3`

This style guide reflects the actual patterns used in the CoRATES application as of the current implementation.
