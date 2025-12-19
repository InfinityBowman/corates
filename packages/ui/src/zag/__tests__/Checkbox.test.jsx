/**
 * Tests for Checkbox component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { Checkbox } from '../Checkbox.jsx';

describe('Checkbox', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render checkbox with label', () => {
      render(() => <Checkbox label='Accept terms' />);

      expect(screen.getByText('Accept terms')).toBeInTheDocument();
    });

    it('should render checkbox without label', () => {
      const { container } = render(() => <Checkbox />);

      const checkbox = container.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeInTheDocument();
    });

    it('should apply custom class', () => {
      const { container } = render(() => <Checkbox class='custom-class' />);

      const label = container.querySelector('label');
      expect(label.className).toContain('custom-class');
    });
  });

  describe('Uncontrolled behavior', () => {
    it('should have hidden input element', () => {
      const { container } = render(() => <Checkbox label='Test' />);

      const input = container.querySelector('input[type="checkbox"]');
      expect(input).toBeInTheDocument();
    });

    it('should render control element', () => {
      const { container } = render(() => <Checkbox label='Test' />);

      const control = container.querySelector('[data-part="control"]');
      expect(control).toBeInTheDocument();
    });
  });

  describe('Controlled behavior', () => {
    it('should call onChange when clicked', async () => {
      const onChange = vi.fn();
      const { container } = render(() => <Checkbox label='Test' onChange={onChange} />);

      const label = container.querySelector('label');
      await fireEvent.click(label);

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should support controlled state changes', () => {
      const TestComponent = () => {
        const [checked, setChecked] = createSignal(false);
        return (
          <div>
            <Checkbox label='Controlled' checked={checked()} onChange={setChecked} />
            <span data-testid='state'>{checked() ? 'checked' : 'unchecked'}</span>
          </div>
        );
      };

      const { container } = render(() => <TestComponent />);

      expect(screen.getByTestId('state')).toHaveTextContent('unchecked');

      const label = container.querySelector('label');
      fireEvent.click(label);

      expect(screen.getByTestId('state')).toHaveTextContent('checked');
    });
  });

  describe('Disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      const { container } = render(() => <Checkbox label='Test' disabled />);

      const input = container.querySelector('input[type="checkbox"]');
      expect(input.disabled).toBe(true);
    });

    it('should apply disabled styling', () => {
      const { container } = render(() => <Checkbox label='Test' disabled />);

      const label = container.querySelector('label');
      expect(label.className).toContain('cursor-not-allowed');
    });
  });

  describe('Indeterminate state', () => {
    it('should render control element when indeterminate', () => {
      const { container } = render(() => <Checkbox label='Test' indeterminate />);

      const controlDiv = container.querySelector('[data-part="control"]');
      expect(controlDiv).toBeInTheDocument();
    });
  });

  describe('Form integration', () => {
    it('should have name attribute for form submission', () => {
      const { container } = render(() => <Checkbox label='Test' name='acceptTerms' />);

      const input = container.querySelector('input[type="checkbox"]');
      expect(input.name).toBe('acceptTerms');
    });

    it('should have value attribute for form submission', () => {
      const { container } = render(() => <Checkbox label='Test' name='option' value='option1' />);

      const input = container.querySelector('input[type="checkbox"]');
      expect(input.value).toBe('option1');
    });
  });

  describe('Accessibility', () => {
    it('should have proper control element', () => {
      const { container } = render(() => <Checkbox label='Accept terms' />);

      const control = container.querySelector('[data-part="control"]');
      expect(control).toBeInTheDocument();
    });

    it('should have hidden input for form', () => {
      const { container } = render(() => <Checkbox label='Test' />);

      const input = container.querySelector('input[type="checkbox"]');
      expect(input).not.toBeNull();
    });
  });
});
