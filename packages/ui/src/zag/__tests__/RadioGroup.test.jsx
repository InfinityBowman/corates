/**
 * Tests for RadioGroup component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { RadioGroup } from '../RadioGroup.jsx';

describe('RadioGroup', () => {
  const defaultItems = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  beforeEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render group label', () => {
      render(() => <RadioGroup items={defaultItems} label='Choose an option' />);

      expect(screen.getByText('Choose an option')).toBeInTheDocument();
    });

    it('should render all radio items', () => {
      render(() => <RadioGroup items={defaultItems} label='Options' />);

      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('should render item descriptions', () => {
      const itemsWithDesc = [
        { value: 'opt1', label: 'Option 1', description: 'First option description' },
        { value: 'opt2', label: 'Option 2', description: 'Second option description' },
      ];

      render(() => <RadioGroup items={itemsWithDesc} label='Options' />);

      expect(screen.getByText('First option description')).toBeInTheDocument();
      expect(screen.getByText('Second option description')).toBeInTheDocument();
    });

    it('should apply custom class', () => {
      const { container } = render(() => (
        <RadioGroup items={defaultItems} label='Options' class='custom-class' />
      ));

      const root = container.querySelector('[data-part="root"]');
      expect(root).toHaveClass('custom-class');
    });
  });

  describe('Uncontrolled behavior', () => {
    it('should select defaultValue initially', () => {
      const { container } = render(() => (
        <RadioGroup items={defaultItems} label='Options' defaultValue='option2' />
      ));

      const inputs = container.querySelectorAll('input[type="radio"]');
      const option2Input = [...inputs].find(input => input.value === 'option2');
      expect(option2Input.checked).toBe(true);
    });

    it('should update selection on click', async () => {
      const { container } = render(() => (
        <RadioGroup items={defaultItems} label='Options' defaultValue='option1' />
      ));

      const option2Label = screen.getByText('Option 2').closest('label');
      await fireEvent.click(option2Label);

      const inputs = container.querySelectorAll('input[type="radio"]');
      const option2Input = [...inputs].find(input => input.value === 'option2');
      expect(option2Input.checked).toBe(true);
    });
  });

  describe('Controlled behavior', () => {
    it('should reflect controlled value', () => {
      const { container } = render(() => (
        <RadioGroup items={defaultItems} label='Options' value='option3' />
      ));

      const inputs = container.querySelectorAll('input[type="radio"]');
      const option3Input = [...inputs].find(input => input.value === 'option3');
      expect(option3Input.checked).toBe(true);
    });

    it('should call onValueChange when selection changes', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <RadioGroup
          items={defaultItems}
          label='Options'
          value='option1'
          onValueChange={onValueChange}
        />
      ));

      const option2Label = screen.getByText('Option 2').closest('label');
      await fireEvent.click(option2Label);

      expect(onValueChange).toHaveBeenCalledWith({ value: 'option2' });
    });

    it('should accept onValueChange prop', () => {
      const onValueChange = vi.fn();
      const { container } = render(() => (
        <RadioGroup
          items={defaultItems}
          label='Options'
          value='option1'
          onValueChange={onValueChange}
        />
      ));

      // Component renders without error
      const root = container.querySelector('[data-part="root"]');
      expect(root).toBeInTheDocument();
    });
  });

  describe('Disabled state', () => {
    it('should disable all items when group is disabled', () => {
      const { container } = render(() => (
        <RadioGroup items={defaultItems} label='Options' disabled />
      ));

      const inputs = container.querySelectorAll('input[type="radio"]');
      for (const input of inputs) {
        expect(input.disabled).toBe(true);
      }
    });

    it('should disable individual items', () => {
      const itemsWithDisabled = [
        { value: 'opt1', label: 'Option 1' },
        { value: 'opt2', label: 'Option 2', disabled: true },
        { value: 'opt3', label: 'Option 3' },
      ];

      const { container } = render(() => <RadioGroup items={itemsWithDisabled} label='Options' />);

      const inputs = container.querySelectorAll('input[type="radio"]');
      const opt2Input = [...inputs].find(input => input.value === 'opt2');
      expect(opt2Input.disabled).toBe(true);
    });

    it('should apply disabled styling to disabled items', () => {
      const itemsWithDisabled = [
        { value: 'opt1', label: 'Option 1' },
        { value: 'opt2', label: 'Option 2', disabled: true },
      ];

      render(() => <RadioGroup items={itemsWithDisabled} label='Options' />);

      const opt2Label = screen.getByText('Option 2').closest('label');
      expect(opt2Label).toHaveClass('cursor-not-allowed');
    });
  });

  describe('Orientation', () => {
    it('should render vertically by default', () => {
      const { container } = render(() => <RadioGroup items={defaultItems} label='Options' />);

      const itemsContainer = container.querySelector('.flex-col');
      expect(itemsContainer).toBeInTheDocument();
    });

    it('should render horizontally when orientation is horizontal', () => {
      const { container } = render(() => (
        <RadioGroup items={defaultItems} label='Options' orientation='horizontal' />
      ));

      const itemsContainer = container.querySelector('.flex-row');
      expect(itemsContainer).toBeInTheDocument();
    });
  });

  describe('Form integration', () => {
    it('should have name attribute on inputs', () => {
      const { container } = render(() => (
        <RadioGroup items={defaultItems} label='Options' name='myRadioGroup' />
      ));

      const inputs = container.querySelectorAll('input[type="radio"]');
      for (const input of inputs) {
        expect(input.name).toBe('myRadioGroup');
      }
    });
  });

  describe('Accessibility', () => {
    it('should have radiogroup role', () => {
      render(() => <RadioGroup items={defaultItems} label='Options' />);

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toBeInTheDocument();
    });

    it('should have radio roles for items', () => {
      render(() => <RadioGroup items={defaultItems} label='Options' />);

      const radios = screen.getAllByRole('radio');
      expect(radios.length).toBe(3);
    });

    it('should have checked input for selected item', () => {
      const { container } = render(() => (
        <RadioGroup items={defaultItems} label='Options' value='option2' />
      ));

      const inputs = container.querySelectorAll('input[type="radio"]');
      const option2Input = [...inputs].find(input => input.value === 'option2');
      expect(option2Input.checked).toBe(true);
    });
  });

  describe('Visual states', () => {
    it('should show checked indicator on selected item', () => {
      const { container } = render(() => (
        <RadioGroup items={defaultItems} label='Options' value='option1' />
      ));

      const controls = container.querySelectorAll('[data-part="item-control"]');
      const option1Control = [...controls][0];
      expect(option1Control).toHaveAttribute('data-state', 'checked');
    });

    it('should show unchecked indicator on unselected items', () => {
      const { container } = render(() => (
        <RadioGroup items={defaultItems} label='Options' value='option1' />
      ));

      const controls = container.querySelectorAll('[data-part="item-control"]');
      const option2Control = [...controls][1];
      expect(option2Control).toHaveAttribute('data-state', 'unchecked');
    });
  });
});
