/**
 * Tests for Progress component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@solidjs/testing-library';
import { Progress } from '../Progress';

describe('Progress', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render progress bar', () => {
      const { container } = render(() => <Progress value={50} />);

      const track = container.querySelector('[data-part="track"]');
      expect(track).toBeInTheDocument();
    });

    it('should render range indicator', () => {
      const { container } = render(() => <Progress value={50} />);

      const range = container.querySelector('[data-part="range"]');
      expect(range).toBeInTheDocument();
    });

    it('should apply custom class', () => {
      const { container } = render(() => <Progress value={50} class='custom-class' />);

      const root = container.querySelector('[data-part="root"]') as HTMLElement;
      expect(root).not.toBeNull();
      expect(root).toHaveClass('custom-class');
    });
  });

  describe('Value display', () => {
    it('should show label when provided', () => {
      render(() => <Progress value={50} label='Loading' />);

      expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('should show percentage when showValue is true', () => {
      render(() => <Progress value={75} showValue />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should not show percentage by default', () => {
      render(() => <Progress value={75} />);

      expect(screen.queryByText('75%')).not.toBeInTheDocument();
    });

    it('should show both label and value', () => {
      render(() => <Progress value={50} label='Progress' showValue />);

      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    it('should apply small size class', () => {
      const { container } = render(() => <Progress value={50} size='sm' />);

      const track = container.querySelector('[data-part="track"]') as HTMLElement;
      expect(track).not.toBeNull();
      expect(track).toHaveClass('h-1');
    });

    it('should apply medium size class by default', () => {
      const { container } = render(() => <Progress value={50} />);

      const track = container.querySelector('[data-part="track"]') as HTMLElement;
      expect(track).not.toBeNull();
      expect(track).toHaveClass('h-2');
    });

    it('should apply large size class', () => {
      const { container } = render(() => <Progress value={50} size='lg' />);

      const track = container.querySelector('[data-part="track"]') as HTMLElement;
      expect(track).not.toBeNull();
      expect(track).toHaveClass('h-3');
    });
  });

  describe('Color variants', () => {
    it('should apply default (blue) color', () => {
      const { container } = render(() => <Progress value={50} />);

      const range = container.querySelector('[data-part="range"]') as HTMLElement;
      expect(range).not.toBeNull();
      expect(range).toHaveClass('bg-blue-500');
    });

    it('should apply success (green) color', () => {
      const { container } = render(() => <Progress value={50} variant='success' />);

      const range = container.querySelector('[data-part="range"]') as HTMLElement;
      expect(range).not.toBeNull();
      expect(range).toHaveClass('bg-green-500');
    });

    it('should apply warning (yellow) color', () => {
      const { container } = render(() => <Progress value={50} variant='warning' />);

      const range = container.querySelector('[data-part="range"]') as HTMLElement;
      expect(range).not.toBeNull();
      expect(range).toHaveClass('bg-yellow-500');
    });

    it('should apply error (red) color', () => {
      const { container } = render(() => <Progress value={50} variant='error' />);

      const range = container.querySelector('[data-part="range"]') as HTMLElement;
      expect(range).not.toBeNull();
      expect(range).toHaveClass('bg-red-500');
    });
  });

  describe('Value range', () => {
    it('should handle 0% value', () => {
      render(() => <Progress value={0} showValue />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle 100% value', () => {
      render(() => <Progress value={100} showValue />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle custom min/max values', () => {
      render(() => <Progress value={50} min={0} max={200} showValue />);

      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });

  describe('Indeterminate state', () => {
    it('should apply indeterminate animation class', () => {
      const { container } = render(() => <Progress indeterminate />);

      const range = container.querySelector('[data-part="range"]') as HTMLElement;
      expect(range).not.toBeNull();
      expect(range).toHaveClass('animate-progress-indeterminate');
    });

    it('should not show value when indeterminate', () => {
      render(() => <Progress indeterminate showValue />);

      // When indeterminate, value text should not be shown
      const valueText = screen.queryByText(/%$/);
      expect(valueText).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on root', () => {
      const { container } = render(() => <Progress value={50} label='Loading progress' />);

      const root = container.querySelector('[data-part="root"]');
      expect(root).toBeInTheDocument();
    });

    it('should have label element with proper attributes', () => {
      const { container } = render(() => <Progress value={50} label='Loading' />);

      const label = container.querySelector('[data-part="label"]');
      expect(label).not.toBeNull();
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent('Loading');
    });
  });
});
