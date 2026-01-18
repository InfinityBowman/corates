/**
 * Z-Index Constants
 *
 * Centralized z-index values for overlay components to ensure consistent layering.
 * All values are Tailwind CSS classes for compatibility with existing setup.
 *
 * Z-Index Tier System:
 * - z-40: Tooltips, Popovers, Menus, Comboboxes (lowest overlay tier, non-blocking)
 * - z-50: Dialogs, Drawers, Toasts (modal overlays and notifications)
 * - z-100: Tour backdrops, System banners (high-priority overlays)
 * - z-101: Tour spotlight (above tour backdrop)
 * - z-102: Tour content (highest, above all other overlays)
 */

export const Z_INDEX = {
  /** Tooltip and Popover - Lowest overlay tier for non-blocking hints */
  TOOLTIP: 'z-40',
  POPOVER: 'z-40',

  /** Menu and Combobox - Dropdown menus and autocomplete */
  MENU: 'z-40',
  COMBOBOX: 'z-40',

  /** Select - Dropdown select (needs to be above dialogs) */
  SELECT: 'z-[60]',

  /** Dialog and Drawer Backdrop - Modal backdrops */
  BACKDROP: 'z-50',

  /** Dialog and Drawer Content - Modal content */
  DIALOG: 'z-50',

  /** Toast - Toast notifications */
  TOAST: 'z-50',

  /** Tour Backdrop - Tour overlay backdrop */
  TOUR_BACKDROP: 'z-100',

  /** Tour Spotlight - Tour spotlight effect */
  TOUR_SPOTLIGHT: 'z-101',

  /** Tour Content - Tour content (highest overlay) */
  TOUR_CONTENT: 'z-102',

  /** Banner - System-level banners (e.g., ImpersonationBanner) */
  BANNER: 'z-100',
} as const;
