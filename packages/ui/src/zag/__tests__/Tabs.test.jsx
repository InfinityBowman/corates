/**
 * Tests for Tabs component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { Tabs } from '../Tabs.jsx';

describe('Tabs', () => {
  const defaultTabs = [
    { value: 'tab1', label: 'Tab 1' },
    { value: 'tab2', label: 'Tab 2' },
    { value: 'tab3', label: 'Tab 3' },
  ];

  beforeEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render all tab triggers', () => {
      render(() => <Tabs tabs={defaultTabs} />);

      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Tab 3')).toBeInTheDocument();
    });

    it('should render tab list container', () => {
      const { container } = render(() => <Tabs tabs={defaultTabs} />);

      const tabList = container.querySelector('[data-part="list"]');
      expect(tabList).toBeInTheDocument();
    });

    it('should render with icons', () => {
      const tabsWithIcons = [
        { value: 'tab1', label: 'Tab 1', icon: <span data-testid="icon1">📁</span> },
        { value: 'tab2', label: 'Tab 2', icon: <span data-testid="icon2">📄</span> },
      ];

      render(() => <Tabs tabs={tabsWithIcons} />);

      expect(screen.getByTestId('icon1')).toBeInTheDocument();
      expect(screen.getByTestId('icon2')).toBeInTheDocument();
    });

    it('should render count badges', () => {
      const tabsWithCounts = [
        { value: 'tab1', label: 'Tab 1', count: 5 },
        { value: 'tab2', label: 'Tab 2', count: 10 },
      ];

      render(() => <Tabs tabs={tabsWithCounts} />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should render dynamic count via getCount', () => {
      const tabsWithGetCount = [
        { value: 'tab1', label: 'Tab 1', getCount: () => 42 },
      ];

      render(() => <Tabs tabs={tabsWithGetCount} />);

      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  describe('Default selection', () => {
    it('should select first tab by default', () => {
      const { container } = render(() => <Tabs tabs={defaultTabs} />);

      const firstTrigger = container.querySelector('[data-part="trigger"]');
      expect(firstTrigger).toHaveAttribute('data-selected');
    });

    it('should select specified defaultValue', () => {
      render(() => <Tabs tabs={defaultTabs} defaultValue="tab2" />);

      const tab2Button = screen.getByText('Tab 2').closest('button');
      expect(tab2Button).toHaveAttribute('data-selected');
    });
  });

  describe('Controlled behavior', () => {
    it('should reflect controlled value', () => {
      render(() => <Tabs tabs={defaultTabs} value="tab3" />);

      const tab3Button = screen.getByText('Tab 3').closest('button');
      expect(tab3Button).toHaveAttribute('data-selected');
    });

    it('should call onValueChange when tab is clicked', async () => {
      const onValueChange = vi.fn();
      render(() => <Tabs tabs={defaultTabs} onValueChange={onValueChange} />);

      const tab2Button = screen.getByText('Tab 2');
      await fireEvent.click(tab2Button);

      expect(onValueChange).toHaveBeenCalledWith('tab2');
    });

    it('should update when controlled value changes', () => {
      const TestComponent = () => {
        const [value, setValue] = createSignal('tab1');
        return (
          <div>
            <Tabs tabs={defaultTabs} value={value()} onValueChange={setValue} />
            <button data-testid="change" onClick={() => setValue('tab3')}>
              Change to Tab 3
            </button>
          </div>
        );
      };

      render(() => <TestComponent />);

      // Initially tab1 is selected
      let tab1Button = screen.getByText('Tab 1').closest('button');
      expect(tab1Button).toHaveAttribute('data-selected');

      // Change to tab3
      fireEvent.click(screen.getByTestId('change'));

      const tab3Button = screen.getByText('Tab 3').closest('button');
      expect(tab3Button).toHaveAttribute('data-selected');
    });
  });

  describe('Tab content', () => {
    it('should render content for active tab', () => {
      render(() => (
        <Tabs tabs={defaultTabs}>
          {(value) => <div data-testid={`content-${value}`}>Content for {value}</div>}
        </Tabs>
      ));

      // First tab content should be visible
      const content = screen.getByTestId('content-tab1');
      expect(content).toBeInTheDocument();
    });

    it('should switch content when tab changes', async () => {
      render(() => (
        <Tabs tabs={defaultTabs}>
          {(value) => <div data-testid={`content-${value}`}>Content for {value}</div>}
        </Tabs>
      ));

      // Click tab 2
      await fireEvent.click(screen.getByText('Tab 2'));

      // Tab 2 content should be rendered
      const content = screen.getByTestId('content-tab2');
      expect(content).toBeInTheDocument();
    });
  });

  describe('Keyboard navigation', () => {
    it('should have focusable tab triggers', () => {
      render(() => <Tabs tabs={defaultTabs} />);

      const triggers = screen.getAllByRole('tab');
      expect(triggers.length).toBe(3);
    });
  });

  describe('Accessibility', () => {
    it('should have proper tab roles', () => {
      render(() => <Tabs tabs={defaultTabs} />);

      const triggers = screen.getAllByRole('tab');
      expect(triggers.length).toBe(3);
    });

    it('should have tablist role', () => {
      render(() => <Tabs tabs={defaultTabs} />);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
    });

    it('should have aria-selected on active tab', () => {
      render(() => <Tabs tabs={defaultTabs} value="tab2" />);

      const tab2Button = screen.getByText('Tab 2').closest('button');
      expect(tab2Button).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Styling', () => {
    it('should apply selected styling to active tab', () => {
      render(() => <Tabs tabs={defaultTabs} value="tab1" />);

      const tab1Button = screen.getByText('Tab 1').closest('button');
      expect(tab1Button).toHaveAttribute('data-selected');
    });

    it('should not apply selected styling to inactive tabs', () => {
      render(() => <Tabs tabs={defaultTabs} value="tab1" />);

      const tab2Button = screen.getByText('Tab 2').closest('button');
      expect(tab2Button).not.toHaveAttribute('data-selected');
    });
  });
});
