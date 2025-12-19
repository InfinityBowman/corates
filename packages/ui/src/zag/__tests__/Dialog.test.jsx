/**
 * Tests for Dialog and ConfirmDialog components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { Dialog, ConfirmDialog, useConfirmDialog } from '../Dialog.jsx';

describe('Dialog', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(() => (
        <Dialog open={false} title="Test Dialog">
          <p>Dialog content</p>
        </Dialog>
      ));

      expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      render(() => (
        <Dialog open={true} title="Test Dialog">
          <p>Dialog content</p>
        </Dialog>
      ));

      expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      expect(screen.getByText('Dialog content')).toBeInTheDocument();
    });

    it('should render title', () => {
      render(() => (
        <Dialog open={true} title="My Dialog Title">
          <p>Content</p>
        </Dialog>
      ));

      expect(screen.getByText('My Dialog Title')).toBeInTheDocument();
    });

    it('should render description when provided', () => {
      render(() => (
        <Dialog open={true} title="Title" description="This is a description">
          <p>Content</p>
        </Dialog>
      ));

      expect(screen.getByText('This is a description')).toBeInTheDocument();
    });

    it('should render children content', () => {
      render(() => (
        <Dialog open={true} title="Title">
          <p>Custom content here</p>
          <button>Action button</button>
        </Dialog>
      ));

      expect(screen.getByText('Custom content here')).toBeInTheDocument();
      expect(screen.getByText('Action button')).toBeInTheDocument();
    });
  });

  describe('Open/Close behavior', () => {
    it('should accept onOpenChange prop', () => {
      const onOpenChange = vi.fn();
      render(() => (
        <Dialog open={true} title="Title" onOpenChange={onOpenChange}>
          <p>Content</p>
        </Dialog>
      ));

      // Component renders correctly with onOpenChange prop
      expect(screen.getByText('Title')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(() => (
        <Dialog open={true} title="Title">
          <p>Content</p>
        </Dialog>
      ));

      const closeButton = document.querySelector('[data-part="close-trigger"]');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    it('should apply small size class', () => {
      render(() => (
        <Dialog open={true} title="Small Dialog" size="sm">
          <p>Content</p>
        </Dialog>
      ));

      const content = document.querySelector('[data-part="content"]');
      expect(content.className).toContain('max-w-sm');
    });

    it('should apply medium size class by default', () => {
      render(() => (
        <Dialog open={true} title="Medium Dialog">
          <p>Content</p>
        </Dialog>
      ));

      const content = document.querySelector('[data-part="content"]');
      expect(content.className).toContain('max-w-md');
    });

    it('should apply large size class', () => {
      render(() => (
        <Dialog open={true} title="Large Dialog" size="lg">
          <p>Content</p>
        </Dialog>
      ));

      const content = document.querySelector('[data-part="content"]');
      expect(content.className).toContain('max-w-lg');
    });
  });

  describe('Accessibility', () => {
    it('should have dialog role', () => {
      render(() => (
        <Dialog open={true} title="Accessible Dialog">
          <p>Content</p>
        </Dialog>
      ));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('should have proper title attributes', () => {
      render(() => (
        <Dialog open={true} title="Dialog Title">
          <p>Content</p>
        </Dialog>
      ));

      const title = document.querySelector('[data-part="title"]');
      expect(title).toHaveTextContent('Dialog Title');
    });
  });
});

describe('ConfirmDialog', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(() => (
        <ConfirmDialog
          open={false}
          title="Confirm"
          description="Are you sure?"
        />
      ));

      expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      render(() => (
        <ConfirmDialog
          open={true}
          title="Confirm Action"
          description="Are you sure you want to proceed?"
        />
      ));

      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('should render default button text', () => {
      render(() => (
        <ConfirmDialog
          open={true}
          title="Confirm Title"
          description="Description"
        />
      ));

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      // Confirm button shows "Confirm" text
      const buttons = screen.getAllByRole('button');
      const confirmButton = buttons.find(btn => btn.textContent === 'Confirm');
      expect(confirmButton).toBeInTheDocument();
    });

    it('should render custom button text', () => {
      render(() => (
        <ConfirmDialog
          open={true}
          title="Delete Item"
          description="This action cannot be undone"
          confirmText="Delete"
          cancelText="Keep"
        />
      ));

      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Keep')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('should apply danger variant styling', () => {
      render(() => (
        <ConfirmDialog
          open={true}
          title="Delete"
          description="Are you sure?"
          variant="danger"
        />
      ));

      const iconBg = document.querySelector('.bg-red-100');
      expect(iconBg).toBeInTheDocument();
    });

    it('should apply warning variant styling', () => {
      render(() => (
        <ConfirmDialog
          open={true}
          title="Warning"
          description="Proceed with caution"
          variant="warning"
        />
      ));

      const iconBg = document.querySelector('.bg-amber-100');
      expect(iconBg).toBeInTheDocument();
    });

    it('should apply info variant styling', () => {
      render(() => (
        <ConfirmDialog
          open={true}
          title="Info"
          description="This is informational"
          variant="info"
        />
      ));

      const iconBg = document.querySelector('.bg-blue-100');
      expect(iconBg).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should accept onConfirm prop', () => {
      const onConfirm = vi.fn();
      render(() => (
        <ConfirmDialog
          open={true}
          title="Confirm Action"
          description="Proceed?"
          onConfirm={onConfirm}
        />
      ));

      // Component renders correctly with onConfirm prop
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('should call onOpenChange with false when cancel is clicked', () => {
      const onOpenChange = vi.fn();
      render(() => (
        <ConfirmDialog
          open={true}
          title="Confirm"
          description="Proceed?"
          onOpenChange={onOpenChange}
        />
      ));

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Loading state', () => {
    it('should show loading text when loading', () => {
      render(() => (
        <ConfirmDialog
          open={true}
          title="Confirm"
          description="Proceed?"
          loading={true}
        />
      ));

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should disable buttons when loading', () => {
      render(() => (
        <ConfirmDialog
          open={true}
          title="Confirm"
          description="Proceed?"
          loading={true}
        />
      ));

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have alertdialog role', () => {
      render(() => (
        <ConfirmDialog
          open={true}
          title="Confirm"
          description="Are you sure?"
        />
      ));

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toBeInTheDocument();
    });
  });
});

describe('useConfirmDialog', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should start with dialog closed', () => {
    const TestComponent = () => {
      const { isOpen, ConfirmDialogComponent } = useConfirmDialog();
      return (
        <div>
          <span data-testid="is-open">{isOpen() ? 'open' : 'closed'}</span>
          <ConfirmDialogComponent />
        </div>
      );
    };

    render(() => <TestComponent />);

    expect(screen.getByTestId('is-open')).toHaveTextContent('closed');
  });

  it('should return open function', () => {
    const TestComponent = () => {
      const { open, ConfirmDialogComponent } = useConfirmDialog();
      return (
        <div>
          <span data-testid="has-open">{typeof open === 'function' ? 'yes' : 'no'}</span>
          <ConfirmDialogComponent />
        </div>
      );
    };

    render(() => <TestComponent />);

    expect(screen.getByTestId('has-open')).toHaveTextContent('yes');
  });

  it('should return close function', () => {
    const TestComponent = () => {
      const { close, ConfirmDialogComponent } = useConfirmDialog();
      return (
        <div>
          <span data-testid="has-close">{typeof close === 'function' ? 'yes' : 'no'}</span>
          <ConfirmDialogComponent />
        </div>
      );
    };

    render(() => <TestComponent />);

    expect(screen.getByTestId('has-close')).toHaveTextContent('yes');
  });

  it('should return setLoading function', () => {
    const TestComponent = () => {
      const { setLoading, ConfirmDialogComponent } = useConfirmDialog();
      return (
        <div>
          <span data-testid="has-setLoading">{typeof setLoading === 'function' ? 'yes' : 'no'}</span>
          <ConfirmDialogComponent />
        </div>
      );
    };

    render(() => <TestComponent />);

    expect(screen.getByTestId('has-setLoading')).toHaveTextContent('yes');
  });

  it('should return dialogProps function', () => {
    const TestComponent = () => {
      const { dialogProps, ConfirmDialogComponent } = useConfirmDialog();
      return (
        <div>
          <span data-testid="has-dialogProps">{typeof dialogProps === 'function' ? 'yes' : 'no'}</span>
          <ConfirmDialogComponent />
        </div>
      );
    };

    render(() => <TestComponent />);

    expect(screen.getByTestId('has-dialogProps')).toHaveTextContent('yes');
  });
});
