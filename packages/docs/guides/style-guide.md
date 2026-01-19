# CoRATES UI Style Guide

## Brand Identity

### Application Name

**CoRATES** - Collaborative Research Appraisal Tool for Evidence Synthesis

### Logo/Brand Icon

- Circular checkmark icon
- Primary color: `primary`
- White checkmark symbol inside

## Design Tokens

The application uses a **shadcn-style semantic token system** for theming. Tokens are defined in `global.css` and support light/dark modes.

### Token Reference

| Token                    | Light Value | Usage                     |
| ------------------------ | ----------- | ------------------------- |
| `background`             | slate-50    | Page backgrounds          |
| `foreground`             | slate-900   | Primary text              |
| `card`                   | white       | Card surfaces             |
| `card-foreground`        | slate-900   | Card text                 |
| `popover`                | white       | Dropdown/popover surfaces |
| `popover-foreground`     | slate-900   | Popover text              |
| `primary`                | blue-600    | Primary actions, links    |
| `primary-foreground`     | white       | Text on primary           |
| `secondary`              | slate-100   | Secondary buttons         |
| `secondary-foreground`   | slate-700   | Secondary button text     |
| `muted`                  | slate-100   | Subtle backgrounds        |
| `muted-foreground`       | slate-500   | Muted/secondary text      |
| `accent`                 | slate-100   | Hover highlights          |
| `accent-foreground`      | slate-900   | Accent text               |
| `destructive`            | red-600     | Danger/delete actions     |
| `destructive-foreground` | white       | Text on destructive       |
| `success`                | emerald-600 | Success states            |
| `success-foreground`     | white       | Text on success           |
| `warning`                | amber-500   | Warning states            |
| `warning-foreground`     | white       | Text on warning           |
| `border`                 | slate-200   | Default borders           |
| `border-subtle`          | slate-100   | Subtle dividers           |
| `input`                  | slate-200   | Input borders             |
| `ring`                   | blue-600    | Focus rings               |

### Using Tokens

```jsx
// Backgrounds
<div class="bg-background">        // Page background
<div class="bg-card">              // Card surface
<div class="bg-muted">             // Subtle background
<div class="bg-primary">           // Primary action background

// Text
<p class="text-foreground">        // Primary text
<p class="text-muted-foreground">  // Secondary/muted text
<p class="text-primary">           // Link/accent text

// Borders
<div class="border-border">        // Default border
<div class="border-border-subtle"> // Subtle divider

// Buttons
<button class="bg-primary text-primary-foreground">
<button class="bg-secondary text-secondary-foreground">
<button class="bg-destructive text-destructive-foreground">

// Focus
<input class="focus:ring-ring">
```

### Dark Mode

Add the `dark` class to `<html>` or a parent element to enable dark mode. All tokens automatically adjust.

```jsx
// Toggle dark mode
document.documentElement.classList.toggle('dark');
```

## Legacy Color Reference

While migrating to tokens, you may still see these Tailwind colors:

### Slate Scale (Neutrals)

- `slate-50` (#f8fafc) - page backgrounds
- `slate-100` (#f1f5f9) - subtle backgrounds
- `slate-200` (#e2e8f0) - borders
- `slate-400` (#94a3b8) - placeholder text
- `slate-500` (#64748b) - secondary text
- `slate-700` (#334155) - headings
- `slate-900` (#0f172a) - primary text

### Semantic Colors

- `blue-600` (#2563eb) - primary actions
- `red-600` (#dc2626) - destructive actions
- `emerald-600` (#059669) - success states
- `amber-500` (#f59e0b) - warnings

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
<button class='bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring/20 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow focus:ring-2 focus:outline-none disabled:opacity-50'>
  Primary Action
</button>
```

#### Secondary Button

```jsx
<button class='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50'>
  Secondary Action
</button>
```

#### Text Button (Links)

```jsx
<button class='text-primary hover:text-primary/80 text-sm font-medium transition-colors'>Edit</button>
```

#### Destructive Button

```jsx
<button class='bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all disabled:opacity-50'>
  Delete
</button>
```

#### Icon Button

```jsx
<button class='text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus:ring-ring rounded p-1.5 transition-colors focus:ring-2 focus:outline-none'>
  <FiTrash2 class='h-4 w-4' />
</button>
```

#### Disabled State (Quota Limit)

```jsx
<span class='bg-muted text-muted-foreground inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium'>
  <FiPlus class='h-4 w-4' />
  Invite
</span>
```

### Form Elements

#### Input Field

```jsx
<input class='border-input bg-card focus:border-ring focus:ring-ring/20 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:ring-2 focus:outline-none' />
```

#### Select (Ark UI)

Uses the `@/components/ui/select` component with `createListCollection`.

#### Label

```jsx
<label class='text-foreground mb-1.5 block text-sm font-medium'>Field Label</label>
```

#### Muted Label (Uppercase)

```jsx
<label class='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>Label Text</label>
```

### Cards & Containers

#### Standard Card (Project View)

```jsx
<div class='border-border bg-card rounded-xl border p-5'>
  <h2 class='text-card-foreground mb-5 text-base font-semibold'>Section Title</h2>
  {/* Content */}
</div>
```

#### Settings Card (with Header)

```jsx
<div class='border-border/60 bg-card overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
  {/* Header */}
  <div class='border-border-subtle from-muted to-card border-b bg-linear-to-r px-6 py-4'>
    <div class='flex items-center space-x-2.5'>
      <div class='bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg'>
        <FiIcon class='text-primary h-4 w-4' />
      </div>
      <div>
        <h2 class='text-card-foreground text-base font-semibold'>Section Title</h2>
        <p class='text-muted-foreground text-sm'>Description text</p>
      </div>
    </div>
  </div>
  {/* Content */}
  <div class='p-6'>{/* ... */}</div>
</div>
```

#### Stat Card

```jsx
<div class='border-border bg-muted rounded-lg border p-4 text-center'>
  <div class='mb-2 flex justify-center'>
    <Icon class='text-muted-foreground h-5 w-5' />
  </div>
  <p class='text-foreground text-2xl font-bold'>42</p>
  <p class='text-muted-foreground mt-1 text-xs font-medium'>Label</p>
</div>
```

#### Stat Card Variants

```jsx
// Success variant
<div class='rounded-lg border border-success/30 bg-success/10 p-4 text-center'>
  <p class='text-2xl font-bold text-success'>12</p>
  <p class='mt-1 text-xs font-medium text-success'>Ready</p>
</div>

// Primary/Info variant
<div class='rounded-lg border border-primary/30 bg-primary/10 p-4 text-center'>
  <p class='text-2xl font-bold text-primary'>8</p>
  <p class='mt-1 text-xs font-medium text-primary'>Completed</p>
</div>
```

#### Collapsible Section

```jsx
<div class='border-border bg-card overflow-hidden rounded-xl border'>
  <Collapsible>
    <CollapsibleTrigger class='hover:bg-muted w-full cursor-pointer justify-between px-5 py-4 transition-colors select-none'>
      <h2 class='text-foreground text-base font-semibold'>Section Title</h2>
      <div class='text-muted-foreground flex items-center gap-2 text-sm'>
        Click to expand
        <CollapsibleIndicator>
          <FiChevronDown class='h-4 w-4' />
        </CollapsibleIndicator>
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class='border-border-subtle border-t px-5 py-5'>{/* Content */}</div>
    </CollapsibleContent>
  </Collapsible>
</div>
```

### Navigation

#### Page Header (Sticky)

```jsx
<header class='border-border bg-card sticky top-0 z-20 border-b'>
  <div class='mx-auto max-w-7xl px-6'>{/* Header content */}</div>
</header>
```

#### Tab Navigation

Uses `@/components/ui/tabs` components:

```jsx
<TabsTrigger
  value='tab-value'
  class='group relative gap-2 rounded-t-lg px-4 py-2.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground data-selected:text-foreground'
>
  <span class='opacity-60 transition-opacity group-data-selected:opacity-100'>{icon}</span>
  <span class='font-medium'>Tab Label</span>
</TabsTrigger>
<TabsIndicator class='h-0.5 rounded-full bg-primary' />
```

#### Tab Badge

```jsx
<span class='bg-muted text-muted-foreground group-data-selected:bg-primary/10 group-data-selected:text-primary min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums transition-colors'>
  {count}
</span>
```

### Badges & Tags

#### Role Badge

```jsx
<span class='border-primary/30 bg-primary/10 text-primary inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize'>
  owner
</span>
```

#### Status Badge (Verified)

```jsx
<span class='bg-success/10 text-success ring-success/20 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ring-1'>
  <FiCheck class='h-3 w-3' />
  Verified
</span>
```

#### Count Badge (Project Card)

```jsx
<span class='bg-primary/15 text-primary inline-flex items-center rounded-full px-2 py-1 font-medium capitalize'>
  {role}
</span>
```

### Avatars

Uses `@/components/ui/avatar` component:

```jsx
<Avatar class='h-9 w-9'>
  <AvatarImage src={imageUrl} alt={name} />
  <AvatarFallback class='bg-primary text-primary-foreground'>{getInitials(name)}</AvatarFallback>
</Avatar>
```

#### Avatar with Overlay (Profile Photo)

```jsx
<div class='group relative'>
  <img src={url} class='ring-card h-20 w-20 rounded-full object-cover shadow-md ring-2' />
  <button class='bg-foreground/60 absolute inset-0 flex cursor-pointer items-center justify-center rounded-full opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100'>
    <FiCamera class='text-card h-5 w-5' />
  </button>
</div>
```

#### Avatar Fallback (Initials)

```jsx
<div class='from-primary to-primary/80 text-primary-foreground flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br text-xl font-semibold shadow-md'>
  {initials}
</div>
```

### Lists

#### Alternating Row

```jsx
<div class='odd:bg-muted/50 flex items-center justify-between rounded-lg p-3 transition-colors'>
  {/* Row content */}
</div>
```

#### Divider Between Sections

```jsx
<div class='border-border-subtle border-t' />
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
- **Background**: `hover:bg-muted` for interactive rows
- **Text Color**: `hover:text-primary/80` for links

### Focus States

- **Ring**: `focus:ring-2 focus:ring-ring/20`
- **Border**: `focus:border-ring`
- **Outline**: `focus:outline-none`

## Page Layouts

### Settings Page

```jsx
<div class='from-background to-muted/80 min-h-full bg-linear-to-br py-8'>
  <div class='mx-auto max-w-3xl px-4 sm:px-6'>
    {/* Page header */}
    <div class='mb-8'>
      <h1 class='text-foreground text-2xl font-semibold tracking-tight'>Page Title</h1>
      <p class='text-muted-foreground mt-1'>Page description</p>
    </div>

    {/* Cards */}
    <div class='mb-6'>{/* Card content */}</div>
  </div>
</div>
```

### Project View

```jsx
<div class='bg-background min-h-screen'>
  {/* Sticky header with tabs */}
  <header class='border-border bg-card sticky top-0 z-20 border-b'>
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
focus:ring-2 focus:ring-ring/20 focus:outline-none
```

### Color Contrast

- `foreground` on `card` backgrounds: 15.4:1
- `muted-foreground` on `card` backgrounds: 5.6:1
- `primary` on `card` backgrounds: 4.5:1

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
