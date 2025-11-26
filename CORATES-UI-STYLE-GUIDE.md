# CoRATES UI Style Guide

## Brand Identity

### Application Name

**CoRATES** - Collaborative Research Appraisal Tool for Evidence Synthesis

### Logo/Brand Icon

- Circular checkmark icon in gradient design
- Primary color: `blue-600`
- White checkmark symbol inside

## Color Palette

### Primary Colors

- **Blue Primary**: `blue-600` (#2563eb)
- **Blue Dark**: `blue-700` (#1d4ed8)
- **Blue Light**: `blue-500` (#3b82f6)
- **Blue Hover**: `blue-800` (#1e40af)

### Secondary Colors

- **Indigo Primary**: `indigo-600` (#4f46e5)
- **Indigo Dark**: `indigo-700` (#4338ca)

### Accent Colors

- **Red**: `red-600` (#dc2626) for destructive actions
- **Red Hover**: `red-700` (#b91c1c)
- **Green**: For success states (implied from traffic light patterns)

### Neutral Colors

- **Gray Scale**:
  - `gray-50` (#f9fafb) - lightest backgrounds
  - `gray-100` (#f3f4f6) - subtle backgrounds
  - `gray-200` (#e5e7eb) - borders, dividers
  - `gray-300` (#d1d5db) - disabled states
  - `gray-400` (#9ca3af) - placeholder text, icons
  - `gray-500` (#6b7280) - secondary text
  - `gray-600` (#4b5563) - body text
  - `gray-700` (#374151) - headings
  - `gray-800` (#1f2937) - dark text
  - `gray-900` (#111827) - darkest text

### Background Colors

- **Main Background**: `bg-gradient-to-br from-blue-50 via-white to-indigo-50`
- **Card Background**: `bg-white`
- **Feature Backgrounds**: `bg-blue-50`, `bg-blue-100`
- **Sidebar Background**: Light gray tones

## Typography

### Font Family

Primary: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

### Font Sizes

- **4XS**: `0.375rem` (6px)
- **3XS**: `0.5rem` (8px)
- **2XS**: `0.625rem` (10px)
- **XS**: `text-xs` - 12px
- **SM**: `text-sm` - 14px
- **Base**: `text-base` - 16px
- **LG**: `text-lg` - 18px
- **XL**: `text-xl` - 20px
- **2XL**: `text-2xl` - 24px
- **3XL**: `text-3xl` - 30px
- **4XL**: `text-4xl` - 36px
- **6XL**: `text-6xl` - 60px
- **7XL**: `text-7xl` - 72px

### Font Weights

- **Medium**: `font-medium`
- **Semibold**: `font-semibold`
- **Bold**: `font-bold`
- **Extrabold**: `font-extrabold` (for brand name)

### Text Colors

- **Primary**: `text-gray-900`
- **Secondary**: `text-gray-600`
- **Muted**: `text-gray-500`
- **Placeholder**: `text-gray-400`
- **Brand**: `text-blue-600`
- **Links**: `text-indigo-600`

## Layout & Spacing

### Container Patterns

- **Max Width**: `max-w-4xl mx-auto` for main content
- **Page Padding**: `p-6` for main content areas
- **Card Padding**: `p-4` to `p-8` depending on component

### Spacing Scale

- **Gap/Margin**: `gap-2`, `gap-4`, `gap-6`, `gap-8`
- **Padding**: `p-2`, `p-4`, `p-6`, `p-8`, `p-12`

### Breakpoints

- **XS**: `30rem` (480px) - Custom breakpoint
- **SM**: Standard Tailwind breakpoints apply

## Components

### Buttons

#### Primary Button

```jsx
<button class="inline-flex items-center px-8 py-4 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
```

#### Secondary Button

```jsx
<button class="inline-flex items-center px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:text-blue-600 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
```

#### Small Action Button

```jsx
<button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
```

#### Destructive Button

```jsx
<button class="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition">
```

#### Icon Button

```jsx
<button class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
```

#### Navbar Link Button

```jsx
<button class="hover:bg-blue-600 px-2 py-1.5 rounded transition font-medium">
```

### Form Elements

#### Input Field

```jsx
<input class="w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition">
```

#### Large Input

```jsx
<input class="flex-1 px-4 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
```

#### Label

```jsx
<label class="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">
```

### Cards & Containers

#### Main Card

```jsx
<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
```

#### Feature Card

```jsx
<div class="text-center p-8 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
```

#### Project Card

```jsx
<div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-200">
```

#### Form Section

```jsx
<div class="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
```

#### Checklist Item

```jsx
<div class="group bg-white border border-gray-200 rounded hover:shadow-sm hover:border-blue-300 transition-all duration-200">
```

#### Empty State

```jsx
<div class="text-center py-8 bg-white rounded-lg border-2 border-dashed border-gray-300">
```

### Navigation

#### Navbar

```jsx
<nav class="flex items-center justify-between bg-linear-to-r from-blue-700 to-blue-500 text-white px-4 py-2 shadow-lg">
```

#### Sidebar Toggle

```jsx
<button class="-ml-1.5 bg-white/80 text-blue-700 p-1.5 rounded-full shadow hover:bg-white transition-all duration-200 border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400">
```

### Icons & Graphics

#### Icon Containers

- Feature icons: `w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-6`
- Small icons: `w-4 h-4`, `w-5 h-5`
- Avatar placeholders: `w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full`

#### SVG Icon Standards

- Stroke width: `stroke-width="2"`
- Standard viewBox: `viewBox="0 0 24 24"`
- Icon colors: `text-gray-400`, `text-blue-500`, etc.

### Badges & Tags

#### Status Badge

```jsx
<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
```

#### Count Badge

```jsx
<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
```

### Modals & Overlays

#### Dialog Backdrop

```jsx
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
```

#### Dialog Content

```jsx
<div class="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 mx-2 animate-fade-in">
```

### Lists & Tables

#### List Item

```jsx
<div class="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
```

#### Traffic Light Cell (Charts)

- Colors: Green (`#22c55e`), Yellow (`#eab308`), Red (`#ef4444`), Gray (`#e5e7eb`)
- Cell styling: `border-radius: 2px`, `stroke: white`, `stroke-width: 1`

## Animation & Transitions

### Standard Transitions

- **Duration**: `duration-200`, `duration-300` for hover states
- **Easing**: `transition-all`, `transition-colors`, `transition-shadow`
- **Transform**: `transform hover:scale-105` for interactive elements

### Custom Animations

#### Fade In

```css
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fade-in 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Hover Effects

- **Scale**: `hover:scale-[1.02]` for buttons
- **Shadow**: `hover:shadow-xl` for cards
- **Background**: Color shifts with `hover:bg-` classes
- **Border**: `hover:border-blue-300` for interactive elements

## Accessibility

### Focus States

- **Ring**: `focus:ring-2 focus:ring-blue-500`
- **Border**: `focus:border-transparent`
- **Outline**: `focus:outline-none` (when using custom ring)

### Color Contrast

- Ensure sufficient contrast ratios between text and backgrounds
- Use semantic colors (red for destructive, blue for primary actions)

### Interactive Elements

- Minimum touch target of 44px for mobile
- Clear visual feedback for all interactive states
- Proper ARIA labels and semantic HTML

## Content Patterns

### Headings Hierarchy

- **Page Title**: `text-6xl md:text-7xl font-bold` with gradient text
- **Section Heading**: `text-3xl md:text-4xl font-bold`
- **Subsection**: `text-xl font-bold`, `text-lg font-semibold`
- **Component Title**: `text-base font-semibold`

### Text Content

- **Body**: `text-lg text-gray-500` for descriptions
- **Label**: `text-xs sm:text-sm font-semibold text-gray-700`
- **Meta**: `text-xs text-gray-500` for timestamps, secondary info

### Empty States

- Icon + heading + description pattern
- Muted colors: `text-gray-400` for icons, `text-gray-500` for text
- Call-to-action when appropriate

## Data Visualization

### Chart Containers

```jsx
<div style="background: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); padding: 16px; margin: 16px 0;">
```

### Color Coding (AMSTAR Ratings)

- **Yes**: `#22c55e` (Green)
- **Partial Yes**: `#eab308` (Yellow)
- **No**: `#ef4444` (Red)
- **No MA/Not Applicable**: `#e5e7eb` (Gray)

## Custom Scrollbars

### Sidebar Scrollbar

```css
.sidebar-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db #f9fafb;
}
.sidebar-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.sidebar-scrollbar::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}
```

## Implementation Notes

### Framework

- Built with **Solid.js** and **Tailwind CSS v4**
- Uses **Vite** for building and **PWA** capabilities
- State management via local stores and API integration

### Responsive Design

- **Mobile-first** approach with `sm:` breakpoints
- Flexible layouts with `flex-col sm:flex-row` patterns
- Scalable typography with responsive text sizes

### Code Patterns

- Consistent use of SolidJS reactive patterns
- Component composition with clear prop interfaces
- Utility-first CSS with Tailwind classes

This style guide provides the foundation for maintaining visual consistency and implementing new features in the CoRATES application.
