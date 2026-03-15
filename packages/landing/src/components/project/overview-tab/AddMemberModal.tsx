/**
 * AddMemberModal - Search and add members to a project
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { TriangleAlertIcon } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/apiFetch';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  orgId: string | null;
  quotaInfo?: { used: number; max: number };
}

export function AddMemberModal({
  isOpen,
  onClose,
  projectId,
  orgId,
  quotaInfo,
}: AddMemberModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState('member');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAtQuotaLimit = quotaInfo && !isUnlimitedQuota(quotaInfo.max) && quotaInfo.used >= quotaInfo.max;

  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search users on debounced query change
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setSearching(true);
      try {
        const results = await apiFetch.get(
          `/api/users/search?q=${encodeURIComponent(debouncedQuery)}&projectId=${encodeURIComponent(projectId)}`,
          { toastMessage: false },
        );
        if (!cancelled) setSearchResults(results as any[]);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Search failed');
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery, projectId]);

  const isValidEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
  const canAddByEmail = !selectedUser && isValidEmail(searchQuery) && searchQuery.length >= 3;

  const handleSelectUser = useCallback((user: any) => {
    setSelectedUser(user);
    setSearchQuery(user.name || user.email);
    setSearchResults([]);
  }, []);

  const handleClose = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setSelectedRole('member');
    setError(null);
    onClose();
  }, [onClose]);

  const handleAddMember = useCallback(async () => {
    if (!selectedUser && !canAddByEmail) return;
    if (!orgId) { setError('No organization context'); return; }

    setAdding(true);
    setError(null);
    try {
      const result = await apiFetch.post(
        `/api/orgs/${orgId}/projects/${projectId}/members`,
        selectedUser
          ? { userId: selectedUser.id, role: selectedRole }
          : { email: searchQuery.trim(), role: selectedRole },
        { toastMessage: false },
      );
      if ((result as any).invitation) {
        showToast.success('Invitation Sent', `Invitation sent to ${(result as any).email || searchQuery}`);
      }
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add member. Please try again.');
    } finally {
      setAdding(false);
    }
  }, [selectedUser, canAddByEmail, orgId, projectId, selectedRole, searchQuery, handleClose]);

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isAtQuotaLimit && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <TriangleAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">Collaborator limit reached</p>
                <p className="mt-1 text-amber-700">
                  Your team has {quotaInfo?.used} of {quotaInfo?.max} collaborators.{' '}
                  <Link to="/settings/plans" className="font-medium underline">Upgrade your plan</Link>{' '}
                  to add more team members.
                </p>
              </div>
            </div>
          )}

          <div className="relative">
            <label className="text-secondary-foreground mb-1 block text-sm font-medium">
              Search by name or email
            </label>
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setError(null); }}
              placeholder="Type at least 2 characters..."
              className="border-border text-foreground placeholder-muted-foreground/70 focus:ring-primary w-full rounded-lg border px-3 py-2 focus:border-transparent focus:ring-2 focus:outline-none"
              disabled={!!isAtQuotaLimit}
            />

            {searchResults.length > 0 && !selectedUser && (
              <div className="border-border bg-card absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border shadow-lg">
                {searchResults.map((user: any) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={user.image} alt={user.name || user.email} />
                      <AvatarFallback className="bg-primary text-sm text-white">
                        {getInitials(user.name || user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-foreground truncate font-medium">{user.name || 'Unknown'}</p>
                      <p className="text-muted-foreground truncate text-sm">{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searching && (
              <div className="absolute top-8 right-3">
                <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            )}
          </div>

          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && !selectedUser && !canAddByEmail && (
            <p className="text-muted-foreground text-sm">No users found matching &quot;{searchQuery}&quot;</p>
          )}

          {canAddByEmail && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-secondary-foreground text-sm">
                No user found. You can send an invitation to{' '}
                <span className="font-medium">{searchQuery.trim()}</span>.
              </p>
            </div>
          )}

          {selectedUser && (
            <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.image} alt={selectedUser.name || selectedUser.email} />
                  <AvatarFallback className="bg-primary text-white">
                    {getInitials(selectedUser.name || selectedUser.email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-foreground font-medium">{selectedUser.name || 'Unknown'}</p>
                  <p className="text-muted-foreground text-sm">{selectedUser.email}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { setSelectedUser(null); setSearchQuery(''); }}
              >
                <span className="sr-only">Remove selection</span>
              </Button>
            </div>
          )}

          {(selectedUser || canAddByEmail) && (
            <div>
              <label className="text-secondary-foreground mb-1 block text-sm font-medium">Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member - Can edit project content</SelectItem>
                  <SelectItem value="owner">Owner - Full access and member management</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMember}
            disabled={(!selectedUser && !canAddByEmail) || adding || !!isAtQuotaLimit}
          >
            {adding ? (canAddByEmail ? 'Sending Invitation...' : 'Adding...') : canAddByEmail ? 'Send Invitation' : 'Add Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
