/**
 * UI Component Library
 *
 * Shadcn-style composable primitives built on Ark UI for SolidJS.
 * Each component is a thin styling wrapper around Ark UI primitives.
 *
 * Usage:
 *   import { Button, Dialog, DialogContent } from '@/components/ui';
 *
 * For better tree-shaking, import directly from individual files:
 *   import { Button } from '@/components/ui/button';
 *   import { Dialog, DialogContent } from '@/components/ui/dialog';
 *
 * Each component file contains JSDoc examples showing common usage patterns.
 */

// Utilities
export * from './cn';
export * from './z-index';

// Components
export * from './button';
export * from './dialog';
export * from './select';
export * from './tooltip';
export * from './popover';
export * from './avatar';
export * from './spinner';
export * from './toast';
export * from './menu';
export * from './tabs';
export * from './checkbox';
export * from './switch';
export * from './collapsible';
export * from './steps';
export * from './alert-dialog';
