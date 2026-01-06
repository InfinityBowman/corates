# Tailwind CSS Documentation

Tailwind CSS is a utility-first CSS framework that generates styles by scanning HTML, JavaScript, and template files for class names. It provides a comprehensive design system through CSS utility classes, enabling rapid UI development without writing custom CSS. The framework operates at build-time, analyzing source files and generating only the CSS classes actually used in the project, resulting in optimized production bundles with zero runtime overhead.

The framework includes an extensive default color palette (18 colors with 11 shades each), responsive breakpoint system, customizable design tokens via CSS custom properties, and support for dark mode, pseudo-classes, pseudo-elements, and media queries through variant prefixes. Tailwind CSS v4.1 introduces CSS-first configuration using the `@theme` directive, native support for custom utilities via `@utility`, seamless integration with modern build tools through Vite, PostCSS, and framework-specific plugins, and enhanced arbitrary value syntax for maximum flexibility.

## Installation with Vite

Installing Tailwind CSS using the Vite plugin for modern JavaScript frameworks.

```bash
# Create a new Vite project
npm create vite@latest my-project
cd my-project

# Install Tailwind CSS and Vite plugin
npm install tailwindcss @tailwindcss/vite
```

```javascript
// vite.config.ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
})
```

```css
/* src/style.css */
@import "tailwindcss";
```

```html
<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="/src/style.css" rel="stylesheet">
</head>
<body>
  <h1 class="text-3xl font-bold underline">
    Hello world!
  </h1>
</body>
</html>
```

## Utility Classes with Variants

Applying conditional styles using variant prefixes for hover, focus, and responsive breakpoints.

```html
<!-- Hover and focus states -->
<button class="bg-sky-500 hover:bg-sky-700 focus:outline-2 focus:outline-offset-2 focus:outline-sky-500 active:bg-sky-800">
  Save changes
</button>

<!-- Responsive breakpoints -->
<div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
  <!-- 3 columns on mobile, 4 on tablets, 6 on desktop -->
</div>

<!-- Dark mode support -->
<div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
  Content adapts to color scheme preference
</div>

<!-- Multiple variants stacked -->
<button class="bg-violet-500 hover:bg-violet-600 focus:ring-2 focus:ring-violet-300 disabled:opacity-50 disabled:cursor-not-allowed md:text-lg">
  Submit
</button>
```

## Custom Theme Configuration

Defining custom design tokens using the `@theme` directive in CSS.

```css
/* app.css */
@import "tailwindcss";

@theme {
  /* Custom fonts */
  --font-display: "Satoshi", "sans-serif";
  --font-body: "Inter", system-ui, sans-serif;

  /* Custom colors */
  --color-brand-50: oklch(0.98 0.02 264);
  --color-brand-100: oklch(0.95 0.05 264);
  --color-brand-500: oklch(0.55 0.22 264);
  --color-brand-900: oklch(0.25 0.12 264);

  /* Custom breakpoints */
  --breakpoint-3xl: 120rem;
  --breakpoint-4xl: 160rem;

  /* Custom spacing */
  --spacing-18: calc(var(--spacing) * 18);

  /* Custom animations */
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
}
```

```html
<!-- Using custom theme tokens -->
<div class="font-display text-brand-500 3xl:text-6xl">
  Custom design system
</div>
```

## Arbitrary Values

Using square bracket notation for one-off custom values without leaving HTML.

```html
<!-- Arbitrary property values -->
<div class="top-[117px] lg:top-[344px]">
  Pixel-perfect positioning
</div>

<div class="bg-[#bada55] text-[22px] before:content-['Festivus']">
  Custom hex colors, font sizes, and content
</div>

<!-- Arbitrary properties -->
<div class="[mask-type:luminance] hover:[mask-type:alpha]">
  Any CSS property
</div>

<!-- CSS variables -->
<div class="bg-(--my-brand-color) fill-(--icon-color)">
  Reference custom properties
</div>

<!-- Grid with arbitrary values -->
<div class="grid grid-cols-[1fr_500px_2fr]">
  Complex grid layouts
</div>

<!-- Type hints for ambiguous values -->
<div class="text-(length:--my-var)">
  Font size from CSS variable
</div>
<div class="text-(color:--my-var)">
  Color from CSS variable
</div>
```

## Color System

Working with Tailwind's comprehensive color palette and opacity modifiers.

```html
<!-- Using default color palette -->
<div class="bg-sky-500 border-pink-300 text-gray-950">
  Color utilities across all properties
</div>

<!-- Opacity modifiers -->
<div class="bg-black/75 text-white/90">
  Alpha channel with percentage
</div>

<div class="bg-pink-500/[71.37%]">
  Arbitrary opacity values
</div>

<div class="bg-cyan-400/(--my-alpha-value)">
  Opacity from CSS variable
</div>

<!-- Dark mode color variants -->
<div class="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700">
  <span class="text-pink-600 dark:text-pink-400">
    Adapts to color scheme
  </span>
</div>

<!-- Color utilities reference -->
<!-- bg-* (background), text-* (text), border-* (border) -->
<!-- decoration-* (text decoration), outline-* (outline) -->
<!-- shadow-* (box shadow), ring-* (ring shadow) -->
<!-- accent-* (form controls), caret-* (text cursor) -->
<!-- fill-* (SVG fill), stroke-* (SVG stroke) -->
```

## Dark Mode

Implementing dark mode with CSS media queries or manual toggle.

```html
<!-- Using prefers-color-scheme (default) -->
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  <div class="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg">
    Content automatically adapts
  </div>
</div>
```

```css
/* Manual dark mode toggle with class selector */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

```html
<!-- Manual dark mode -->
<html class="dark">
  <body>
    <div class="bg-white dark:bg-black">
      Controlled by .dark class
    </div>
  </body>
</html>
```

```javascript
// Dark mode toggle logic
// On page load or theme change
document.documentElement.classList.toggle(
  "dark",
  localStorage.theme === "dark" ||
    (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
);

// User chooses light mode
localStorage.theme = "light";

// User chooses dark mode
localStorage.theme = "dark";

// User chooses system preference
localStorage.removeItem("theme");
```

## State Variants

Styling elements based on pseudo-classes and parent/sibling state.

```html
<!-- Form state variants -->
<input
  type="email"
  required
  class="border-gray-300
         focus:border-sky-500
         focus:ring-2
         focus:ring-sky-300
         invalid:border-pink-500
         invalid:text-pink-600
         disabled:bg-gray-100
         disabled:opacity-50
         placeholder:text-gray-400"
  placeholder="you@example.com"
/>

<!-- List item variants -->
<ul role="list">
  <li class="py-4 first:pt-0 last:pb-0 odd:bg-gray-50 even:bg-white">
    Item content
  </li>
</ul>

<!-- Parent state with group -->
<a href="#" class="group">
  <h3 class="text-gray-900 group-hover:text-white">Title</h3>
  <p class="text-gray-500 group-hover:text-white">Description</p>
</a>

<!-- Sibling state with peer -->
<form>
  <input type="email" class="peer" />
  <p class="invisible peer-invalid:visible text-red-500">
    Please provide a valid email address.
  </p>
</form>

<!-- Has variant -->
<label class="has-checked:bg-indigo-50 has-checked:ring-indigo-200">
  <input type="radio" class="checked:border-indigo-500" />
  Option
</label>
```

## Responsive Design

Building mobile-first responsive layouts with breakpoint variants.

```html
<!-- Mobile-first responsive grid -->
<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
  <!-- Adapts from 1 to 6 columns -->
</div>

<!-- Responsive spacing and typography -->
<div class="px-4 sm:px-6 lg:px-8">
  <h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">
    Responsive heading
  </h1>
  <p class="mt-2 sm:mt-4 text-sm sm:text-base lg:text-lg">
    Text scales with viewport
  </p>
</div>

<!-- Container queries -->
<div class="@container">
  <div class="flex flex-col @md:flex-row @lg:gap-8">
    <!-- Responds to parent container width -->
  </div>
</div>

<!-- Min/max width breakpoints -->
<div class="hidden md:block">Desktop only</div>
<div class="block md:hidden">Mobile only</div>
<div class="min-[900px]:grid-cols-3">Custom breakpoint</div>
<div class="max-md:text-center">Below medium</div>
```

## Custom Utilities

Creating reusable custom utility classes with variant support.

```css
/* Simple custom utility */
@utility content-auto {
  content-visibility: auto;
}

/* Complex utility with nesting */
@utility scrollbar-hidden {
  &::-webkit-scrollbar {
    display: none;
  }
}

/* Functional utility with theme values */
@theme {
  --tab-size-2: 2;
  --tab-size-4: 4;
  --tab-size-github: 8;
}

@utility tab-* {
  tab-size: --value(--tab-size-*);
}

/* Supporting arbitrary, bare, and theme values */
@utility opacity-* {
  opacity: --value([percentage]);
  opacity: calc(--value(integer) * 1%);
  opacity: --value(--opacity-*);
}

/* Utility with modifiers */
@utility text-* {
  font-size: --value(--text-*, [length]);
  line-height: --modifier(--leading-*, [length], [*]);
}

/* Negative value support */
@utility inset-* {
  inset: --spacing(--value(integer));
  inset: --value([percentage], [length]);
}

@utility -inset-* {
  inset: --spacing(--value(integer) * -1);
  inset: calc(--value([percentage], [length]) * -1);
}
```

```html
<!-- Using custom utilities -->
<div class="content-auto scrollbar-hidden tab-4">
  Custom utilities work with variants
</div>

<div class="hover:tab-github lg:tab-[12]">
  Variants and arbitrary values supported
</div>

<div class="text-2xl/relaxed">
  Utility with modifier (font-size/line-height)
</div>
```

## Custom Variants

Registering custom conditional styles with the `@custom-variant` directive.

```css
/* Simple custom variant */
@custom-variant theme-midnight (&:where([data-theme="midnight"] *));

/* Variant with media query */
@custom-variant any-hover {
  @media (any-hover: hover) {
    &:hover {
      @slot;
    }
  }
}

/* ARIA state variant */
@custom-variant aria-asc (&[aria-sort="ascending"]);
@custom-variant aria-desc (&[aria-sort="descending"]);

/* Data attribute variant */
@custom-variant data-checked (&[data-ui~="checked"]);
```

```html
<!-- Using custom variants -->
<html data-theme="midnight">
  <button class="theme-midnight:bg-black theme-midnight:text-white">
    Midnight theme button
  </button>
</html>

<th aria-sort="ascending" class="aria-asc:rotate-0 aria-desc:rotate-180">
  Sortable column
</th>

<div data-ui="checked active" class="data-checked:underline">
  Checked state
</div>

<!-- Arbitrary variants -->
<div class="[&.is-dragging]:cursor-grabbing [&_p]:mt-4">
  One-off custom selectors
</div>
```

## Applying Variants in CSS

Using the `@variant` directive to apply variants within custom CSS.

```css
/* Single variant */
.my-element {
  background: white;

  @variant dark {
    background: black;
  }
}

/* Nested variants */
.my-button {
  background: white;

  @variant dark {
    background: gray;

    @variant hover {
      background: black;
    }
  }
}

/* Compiled output */
.my-element {
  background: white;
}

@media (prefers-color-scheme: dark) {
  .my-element {
    background: black;
  }
}
```

## Layer Organization

Organizing custom styles into Tailwind's cascade layers.

```css
@import "tailwindcss";

/* Base styles for HTML elements */
@layer base {
  h1 {
    font-size: var(--text-2xl);
    font-weight: bold;
  }

  h2 {
    font-size: var(--text-xl);
    font-weight: 600;
  }

  body {
    font-family: var(--font-body);
  }
}

/* Reusable component classes */
@layer components {
  .btn {
    padding: --spacing(2) --spacing(4);
    border-radius: var(--radius);
    font-weight: 600;
    transition: all 150ms;
  }

  .btn-primary {
    background-color: var(--color-blue-500);
    color: white;
  }

  .card {
    background-color: var(--color-white);
    border-radius: var(--radius-lg);
    padding: --spacing(6);
    box-shadow: var(--shadow-xl);
  }

  /* Third-party component overrides */
  .select2-dropdown {
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
  }
}
```

```html
<!-- Components can be overridden by utilities -->
<div class="card rounded-none">
  Square corners despite card class
</div>

<button class="btn btn-primary hover:bg-blue-600 disabled:opacity-50">
  Component with utility overrides
</button>
```

## Functions and Directives

Using Tailwind's CSS functions for dynamic values and opacity adjustments.

```css
/* Alpha function for opacity */
.my-element {
  color: --alpha(var(--color-lime-300) / 50%);
  background: --alpha(var(--color-blue-500) / 25%);
}

/* Spacing function */
.my-element {
  margin: --spacing(4);
  padding: calc(--spacing(6) - 1px);
}

/* In arbitrary values */
<div class="py-[calc(--spacing(4)-1px)] mt-[--spacing(8)]">
  <!-- ... -->
</div>

/* Source directive for additional content */
@source "../node_modules/@my-company/ui-lib";

/* Apply directive for inline utilities */
.select2-dropdown {
  @apply rounded-b-lg shadow-md;
}

.select2-search {
  @apply rounded border border-gray-300;
}

.select2-results__group {
  @apply text-lg font-bold text-gray-900;
}
```

## Pseudo-elements

Styling ::before, ::after, ::placeholder, and other pseudo-elements.

```html
<!-- Required field indicator -->
<label>
  <span class="after:ml-0.5 after:text-red-500 after:content-['*']">
    Email
  </span>
  <input type="email" class="placeholder:text-gray-400 placeholder:italic" placeholder="you@example.com" />
</label>

<!-- File input styling -->
<input
  type="file"
  class="file:mr-4 file:rounded-full file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-violet-700 hover:file:bg-violet-100"
/>

<!-- Custom list markers -->
<ul class="list-disc marker:text-sky-400">
  <li>First item</li>
  <li>Second item</li>
</ul>

<!-- Text selection styling -->
<div class="selection:bg-fuchsia-300 selection:text-fuchsia-900">
  <p>Select this text to see custom colors</p>
</div>

<!-- First letter drop cap -->
<p class="first-letter:float-left first-letter:mr-3 first-letter:text-7xl first-letter:font-bold first-line:uppercase first-line:tracking-widest">
  Typography with pseudo-elements
</p>
```

## Media Queries

Conditional styling based on user preferences and device capabilities.

```html
<!-- Reduced motion -->
<button class="transition hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
  Respects user preference
</button>

<button class="motion-safe:animate-spin">
  Only animates if motion allowed
</button>

<!-- Contrast preference -->
<label>
  <input class="contrast-more:border-gray-400 contrast-less:border-gray-100" />
  <p class="opacity-75 contrast-more:opacity-100">
    Adjusts for contrast needs
  </p>
</label>

<!-- Pointer type -->
<div class="grid grid-cols-4 gap-2 pointer-coarse:grid-cols-2 pointer-coarse:gap-4">
  <!-- Larger touch targets on touch devices -->
</div>

<!-- Orientation -->
<div class="portrait:hidden">
  Hidden in portrait mode
</div>

<div class="landscape:grid-cols-2">
  Layout adapts to orientation
</div>

<!-- Print styles -->
<article class="print:hidden">
  Not shown when printing
</article>

<div class="hidden print:block">
  Only visible in print
</div>

<!-- Feature support -->
<div class="flex supports-[display:grid]:grid supports-backdrop-filter:backdrop-blur">
  Progressive enhancement
</div>
```

## Summary

Tailwind CSS provides a complete utility-first design system that eliminates the need for writing custom CSS in most cases. The framework's primary use cases include rapid prototyping, building production applications with consistent design systems, creating responsive layouts, implementing dark mode, and maintaining design consistency across large teams. By using utility classes directly in markup, developers can iterate quickly, avoid naming conventions, and prevent CSS bloat since only used styles are generated.

The v4.1 release enhances the developer experience with CSS-first configuration, eliminating JavaScript configuration files for most projects. Integration patterns include using the Vite plugin for modern frameworks, PostCSS for custom build pipelines, the Tailwind CLI for simple projects, and CDN scripts for rapid prototyping. The framework excels at component-driven development when combined with React, Vue, Svelte, or other modern frameworks, where utility classes are co-located with component logic. Custom design systems can be fully defined in CSS using `@theme`, with project-specific utilities and variants extending the framework's capabilities without writing JavaScript plugins.
