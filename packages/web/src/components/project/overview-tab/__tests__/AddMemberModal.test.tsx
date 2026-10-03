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
// The full-workspace notice links to plans; no router is mounted here.
vi.mock('@tanstack/react-router', async importOriginal => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
}));
vi.mock('@/hooks/useWorkspaces', () => ({
  useCurrentWorkspace: () => ({
    workspace: { id: 'org-1', name: 'Lab', slug: 'lab', role: 'owner' },
    isLoading: false,
  }),
}));

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

function chipClearButton() {
  return screen.queryByRole('button', { name: 'Clear the selected person' });
}

function sendButton() {
  return screen.getByRole('button', { name: 'Send invitation' });
}

describe('AddMemberModal', () => {
  beforeEach(() => {
    searchUsers.mockReset();
    addMemberToProject.mockReset();
    searchUsers.mockImplementation(async ({ data }: { data: { q: string } }) =>
      [alice, bob].filter(
        u => u.name.toLowerCase().includes(data.q.toLowerCase()) || u.email === data.q,
      ),
    );
  });

  it('turns a picked person into a chip and lets a new search replace it', async () => {
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'ali' } });
    fireEvent.click(await screen.findByRole('option', { name: /Alice Example/ }));

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(chipClearButton()).toBeTruthy();
    expect(screen.getByText('Alice Example')).toBeTruthy();
    expect(searchBox()).toHaveValue('');

    fireEvent.change(searchBox(), { target: { value: 'bob' } });
    fireEvent.click(await screen.findByRole('option', { name: /Bob Example/ }));

    expect(screen.getByText('Bob Example')).toBeTruthy();
    expect(screen.queryByText('Alice Example')).toBeNull();
  });

  it('does not search again after a pick clears the input', async () => {
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'ali' } });
    fireEvent.click(await screen.findByRole('option', { name: /Alice Example/ }));

    await new Promise(r => setTimeout(r, 400));
    expect(searchUsers).toHaveBeenCalledTimes(1);
  });

  it('removes the chip from its clear button and from Backspace', async () => {
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'ali' } });
    fireEvent.click(await screen.findByRole('option', { name: /Alice Example/ }));
    fireEvent.click(chipClearButton()!);
    expect(chipClearButton()).toBeNull();
    expect(sendButton()).toBeDisabled();

    fireEvent.change(searchBox(), { target: { value: 'ali' } });
    fireEvent.click(await screen.findByRole('option', { name: /Alice Example/ }));
    fireEvent.keyDown(searchBox(), { key: 'Backspace' });
    expect(chipClearButton()).toBeNull();
  });

  it('offers an email row for an address with no account and sends to it', async () => {
    addMemberToProject.mockResolvedValue({ invitation: true, email: 'new@example.org' });
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'new@example.org' } });

    const row = await screen.findByTestId('invite-email-option');
    expect(row).toHaveTextContent('new@example.org');
    expect(sendButton()).toBeEnabled();

    fireEvent.click(sendButton());
    await waitFor(() => expect(addMemberToProject).toHaveBeenCalledTimes(1));
    expect(addMemberToProject.mock.calls[0][0].data).toMatchObject({
      email: 'new@example.org',
      role: 'member',
    });
  });

  it('stays usable when the workspace is full, and explains a refused new seat', async () => {
    addMemberToProject.mockRejectedValue({
      code: 'AUTH_FORBIDDEN',
      statusCode: 403,
      message: 'Quota exceeded: collaborators.org.max',
      details: { reason: 'quota_exceeded' },
    });
    render(
      <AddMemberModal
        isOpen
        onClose={() => {}}
        projectId='p1'
        orgId='o1'
        quotaInfo={{ used: 3, max: 3 }}
      />,
    );

    // A resend or someone already in the workspace needs no new seat, so the
    // server decides rather than the form.
    expect(screen.getByText('Your workspace is full')).toBeInTheDocument();
    expect(searchBox()).toBeEnabled();

    fireEvent.change(searchBox(), { target: { value: 'new@example.org' } });
    await screen.findByTestId('invite-email-option');
    fireEvent.click(sendButton());

    expect(await screen.findByText(/this person would need a new seat/)).toBeInTheDocument();
  });

  it('sends a pasted address without the invisible characters around it', async () => {
    addMemberToProject.mockResolvedValue({ invitation: true, email: 'new@example.org' });
    renderModal();

    fireEvent.change(searchBox(), { target: { value: '\u2060new@example.org' } });

    const row = await screen.findByTestId('invite-email-option');
    expect(row).toHaveTextContent('new@example.org');

    fireEvent.click(sendButton());
    await waitFor(() => expect(addMemberToProject).toHaveBeenCalledTimes(1));
    expect(addMemberToProject.mock.calls[0][0].data).toMatchObject({ email: 'new@example.org' });
  });

  it('does not offer an email row when the address already has an account', async () => {
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'alice@example.org' } });

    await screen.findByRole('option', { name: /Alice Example/ });
    expect(screen.queryByTestId('invite-email-option')).toBeNull();
  });

  it('selects the highlighted row with Enter', async () => {
    renderModal();

    fireEvent.change(searchBox(), { target: { value: 'example' } });
    await screen.findByRole('option', { name: /Alice Example/ });

    fireEvent.keyDown(searchBox(), { key: 'ArrowDown' });
    fireEvent.keyDown(searchBox(), { key: 'Enter' });

    expect(screen.getByText('Bob Example')).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
