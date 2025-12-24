/**
 * Tests for Switch component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { Switch } from '../Switch.tsx';

describe('Switch', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render switch control', () => {
      const { container } = render(() => <Switch />);

      const switchControl = container.querySelector('[data-part="control"]');
      expect(switchControl).toBeInTheDocument();
    });

    it('should render hidden input', () => {
      const { container } = render(() => <Switch />);

      const input = container.querySelector('input[type="checkbox"]');
      expect(input).toBeInTheDocument();
    });

    it('should apply custom class', () => {
      const { container } = render(() => <Switch class='custom-class' />);

      const label = container.querySelector('label');
      expect(label.className).toContain('custom-class');
    });
  });

  describe('Uncontrolled behavior', () => {
    it('should start unchecked by default', () => {
      const { container } = render(() => <Switch />);

      const control = container.querySelector('[data-part="control"]');
      expect(control).toHaveAttribute('data-state', 'unchecked');
    });

    it('should start checked when defaultChecked is true', () => {
      const { container } = render(() => <Switch defaultChecked />);

      const control = container.querySelector('[data-part="control"]');
      expect(control).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('Controlled behavior', () => {
    it('should reflect controlled checked state', () => {
      const { container } = render(() => <Switch checked={true} />);

      const control = container.querySelector('[data-part="control"]');
      expect(control).toHaveAttribute('data-state', 'checked');
    });

    it('should accept onChange prop', () => {
      const onChange = vi.fn();
      const { container } = render(() => <Switch onChange={onChange} />);

      // Component renders without error with onChange
      const control = container.querySelector('[data-part="control"]');
      expect(control).toBeInTheDocument();
    });
  });

  describe('Disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      const { container } = render(() => <Switch disabled />);

      const input = container.querySelector('input[type="checkbox"]');
      expect(input.disabled).toBe(true);
    });

    it('should apply disabled styling', () => {
      const { container } = render(() => <Switch disabled />);

      const label = container.querySelector('label');
      expect(label.className).toContain('cursor-not-allowed');
    });
  });

  describe('Form integration', () => {
    it('should have name attribute for form submission', () => {
      const { container } = render(() => <Switch name='notifications' />);

      const input = container.querySelector('input[type="checkbox"]');
      expect(input.name).toBe('notifications');
    });
  });

  describe('Visual states', () => {
    it('should show thumb in correct position when unchecked', () => {
      const { container } = render(() => <Switch />);

      const thumb = container.querySelector('[data-part="thumb"]');
      expect(thumb).toHaveAttribute('data-state', 'unchecked');
    });

    it('should show thumb in correct position when checked', () => {
      const { container } = render(() => <Switch checked={true} />);

      const thumb = container.querySelector('[data-part="thumb"]');
      expect(thumb).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('Accessibility', () => {
    it('should have proper control element', () => {
      const { container } = render(() => <Switch />);

      const control = container.querySelector('[data-part="control"]');
      expect(control).toBeInTheDocument();
    });

    it('should have hidden input for form submission', () => {
      const { container } = render(() => <Switch name='toggle' />);

      const input = container.querySelector('input[type="checkbox"]');
      expect(input).toHaveAttribute('name', 'toggle');
    });
  });
});
