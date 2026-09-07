import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddMemberModal } from '../AddMemberModal';

const { searchUsers, addMemberToProject } = vi.hoisted(() => ({
  searchUsers: vi.fn(),
  addMemberToProject: vi.fn(),
}));

vi.mock('@/server/functions/users.functions', () => ({ searchUsers }));
vi.mock('@/server/functions/org-projects.functions', () => ({ addMemberToProject }));
vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: vi.fn() } }));
vi.mock('@/lib/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/clientLogger', () => ({ clientLogger: { info: vi.fn() } }));

const alice = {
  id: 'u-alice',
  name: 'Alice Example',
  givenName: 'Alice',
  familyName: 'Example',
  username: null,
  image: null,
  email: 'alice@example.org',
};
const bob = { ...alice, id: 'u-bob', name: 'Bob Example', email: 'bob@example.org' };

function renderModal() {
  return render(<AddMemberModal isOpen onClose={() => {}} projectId='p1' orgId='o1' />);
}

function searchBox() {
  return screen.getByRole('combobox', { name: 'Search by name or email' });
}

describe('AddMemberModal search', () => {
  beforeEach(() => {
    searchUsers.mockReset();
    searchUsers.mockImplementation(async ({ data }: { data: { q: string } }) =>
      [alice, bob].filter(u => u.name.toLowerCase().includes(data.q.toLowerCase())),
    );
  });

  it('shows fresh results after a selection when the query is edited', async () => {
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'ali' } });
    const option = await screen.findByRole('option', { name: /Alice Example/ });
    fireEvent.click(option);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear the selected person' })).toBeTruthy();
    expect(searchBox()).toHaveValue('Alice Example');

    fireEvent.change(searchBox(), { target: { value: 'bob' } });

    expect(screen.queryByRole('button', { name: 'Clear the selected person' })).toBeNull();
    await screen.findByRole('option', { name: /Bob Example/ });
    expect(screen.queryByRole('option', { name: /Alice Example/ })).toBeNull();
  });

  it("does not search for the selected person's own name", async () => {
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'ali' } });
    fireEvent.click(await screen.findByRole('option', { name: /Alice Example/ }));

    await new Promise(r => setTimeout(r, 400));
    expect(searchUsers).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clears the selection from the visible clear button', async () => {
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'ali' } });
    fireEvent.click(await screen.findByRole('option', { name: /Alice Example/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear the selected person' }));

    expect(searchBox()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeDisabled();
  });

  it('offers an email invitation when nothing matches a full address', async () => {
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'new@example.org' } });

    await waitFor(() =>
      expect(screen.getByText(/No user found\. You can send an invitation to/)).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeEnabled();
  });

  it('selects the highlighted result with Enter', async () => {
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'example' } });
    await screen.findByRole('option', { name: /Alice Example/ });

    fireEvent.keyDown(searchBox(), { key: 'ArrowDown' });
    fireEvent.keyDown(searchBox(), { key: 'Enter' });

    expect(searchBox()).toHaveValue('Bob Example');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
