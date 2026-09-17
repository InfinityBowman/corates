import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ReviewerAssignment } from '../ReviewerAssignment';
import type { MemberEntry, StudyInfo } from '@/stores/projectStore';

vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

const members = ['me', 'alice', 'bob'].map(
  id =>
    ({
      userId: id,
      name: id,
      email: `${id}@example.com`,
      givenName: id,
      familyName: '',
      image: null,
    }) as unknown as MemberEntry,
);

const studies = ['s1', 's2'].map(
  id =>
    ({
      id,
      name: id,
      reviewer1: null,
      reviewer2: null,
      checklists: [],
      appraisals: [],
      pdfs: [],
    }) as unknown as StudyInfo,
);

const onSave = vi.fn();
const onClose = vi.fn();

function renderSheet() {
  render(
    <TooltipProvider>
      <ReviewerAssignment
        scope={null}
        studies={studies}
        members={members}
        currentUserId='me'
        onSave={onSave}
        onClose={onClose}
      />
    </TooltipProvider>,
  );
}

function setShares(values: Record<string, number>) {
  fireEvent.click(screen.getByRole('button', { name: /shares/i }));
  for (const [id, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(`Custom share for ${id}`), {
      target: { value: String(value) },
    });
  }
}

describe('ReviewerAssignment', () => {
  beforeEach(() => {
    onSave.mockReset();
    onClose.mockReset();
  });

  it('offers Auto-fill and save while nothing has been edited and slots are empty', () => {
    renderSheet();
    expect(screen.queryByRole('button', { name: 'Save reviewers' })).toBeNull();
    setShares({ me: 0, alice: 50, bob: 50 });
    fireEvent.click(screen.getByRole('button', { name: 'Auto-fill and save' }));

    expect(onSave).toHaveBeenCalledTimes(2);
    for (const [, slots] of onSave.mock.calls) {
      expect([slots.reviewer1, slots.reviewer2].sort()).toEqual(['alice', 'bob']);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it('disables Auto-fill and save when every share is zero', () => {
    renderSheet();
    setShares({ me: 0, alice: 0, bob: 0 });
    expect(screen.getByRole('button', { name: 'Auto-fill and save' })).toBeDisabled();
  });

  it('fills the draft from the shares popover and switches the footer to Save reviewers', () => {
    renderSheet();
    setShares({ me: 0, alice: 50, bob: 50 });
    const popover = screen.getByText('Share of studies').closest('[role="dialog"]')!;
    fireEvent.click(within(popover as HTMLElement).getByRole('button', { name: 'Auto-fill' }));

    expect(screen.getByRole('button', { name: 'Save reviewers' })).toBeEnabled();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('2 of 2 studies have two reviewers')).toBeInTheDocument();
  });
});
