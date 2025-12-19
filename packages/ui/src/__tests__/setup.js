/**
 * Vitest Test Setup for UI Package
 * Global configuration and utilities for testing Zag components
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock import.meta.env for tests
vi.stubGlobal('import.meta', {
  env: {
    DEV: true,
    MODE: 'test',
  },
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver as a proper class
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver as a proper class
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver;

// Mock crypto.randomUUID
if (!global.crypto) {
  global.crypto = {};
}
global.crypto.randomUUID = vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2));

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = vi.fn(id => clearTimeout(id));

// Mock Element.prototype methods used by Zag
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.focus = vi.fn();
Element.prototype.blur = vi.fn();

// Mock getComputedStyle for Zag positioning
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = vi.fn().mockImplementation(element => {
  const styles = originalGetComputedStyle?.(element) || {};
  return {
    ...styles,
    getPropertyValue: vi.fn().mockReturnValue(''),
    position: 'static',
    display: 'block',
    visibility: 'visible',
    overflow: 'visible',
  };
});

// Mock getBoundingClientRect for Zag positioning
Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
  top: 0,
  left: 0,
  bottom: 100,
  right: 100,
  width: 100,
  height: 100,
  x: 0,
  y: 0,
  toJSON: vi.fn(),
});

// Mock PointerEvent if not available
if (typeof PointerEvent === 'undefined') {
  class MockPointerEvent extends MouseEvent {
    constructor(type, props) {
      super(type, props);
      this.pointerId = props?.pointerId ?? 0;
      this.pointerType = props?.pointerType ?? 'mouse';
      this.isPrimary = props?.isPrimary ?? true;
    }
  }
  global.PointerEvent = MockPointerEvent;
}

// Mock clipboard API
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
    writable: true,
  });
}
