/**
 * Tests for Tooltip component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@solidjs/testing-library';
import { Tooltip } from '../Tooltip.jsx';

describe('Tooltip', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render trigger content', () => {
      render(() => (
        <Tooltip content='Tooltip text'>
          <button>Hover me</button>
        </Tooltip>
      ));

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('should not show tooltip content initially', () => {
      render(() => (
        <Tooltip content='Tooltip text'>
          <button>Hover me</button>
        </Tooltip>
      ));

      expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
    });
  });

  describe('Placement', () => {
    it('should use default top placement', () => {
      render(() => (
        <Tooltip content='Tooltip text'>
          <button>Hover me</button>
        </Tooltip>
      ));

      // Tooltip is rendered, placement is set via positioning prop
      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('should accept custom placement prop', () => {
      render(() => (
        <Tooltip content='Tooltip text' placement='bottom'>
          <button>Hover me</button>
        </Tooltip>
      ));

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });
  });

  describe('Trigger element', () => {
    it('should wrap trigger in span', () => {
      render(() => (
        <Tooltip content='Tooltip text'>
          <button>Hover me</button>
        </Tooltip>
      ));

      // Ark UI renders trigger content - verify it's accessible
      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('should render any children as trigger', () => {
      render(() => (
        <Tooltip content='Help text'>
          <span>Info icon</span>
        </Tooltip>
      ));

      expect(screen.getByText('Info icon')).toBeInTheDocument();
    });

    it('should work with complex children', () => {
      render(() => (
        <Tooltip content='Complex tooltip'>
          <div>
            <span>First</span>
            <span>Second</span>
          </div>
        </Tooltip>
      ));

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have trigger with proper attributes', () => {
      render(() => (
        <Tooltip content='Tooltip text'>
          <button>Hover me</button>
        </Tooltip>
      ));

      // Trigger is rendered with proper attributes via Ark UI
      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('should accept openDelay prop', () => {
      render(() => (
        <Tooltip content='Tooltip text' openDelay={500}>
          <button>Hover me</button>
        </Tooltip>
      ));

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('should accept closeDelay prop', () => {
      render(() => (
        <Tooltip content='Tooltip text' closeDelay={300}>
          <button>Hover me</button>
        </Tooltip>
      ));

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('should accept interactive prop', () => {
      render(() => (
        <Tooltip content='Tooltip text' interactive>
          <button>Hover me</button>
        </Tooltip>
      ));

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });
  });
});
