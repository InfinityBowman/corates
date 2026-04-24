/**
 * AddMemberModal - Search and add members to a project
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { TriangleAlertIcon } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
import { isUnlimitedQuota } from '@corates/shared/plans';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { searchUsersQuery } from '@/server/functions/users.functions';
import { addMemberToProject } from '@/server/functions/org-projects.functions';
import type { UserSearchResult } from '@/server/functions/users.server';

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
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<'member' | 'owner'>('member');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAtQuotaLimit =
    quotaInfo && !isUnlimitedQuota(quotaInfo.max) && quotaInfo.used >= quotaInfo.max;

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
        const results = await searchUsersQuery({
          data: { q: debouncedQuery, projectId: projectId || undefined },
        });
        if (!cancelled) setSearchResults(results);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Search failed');
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, projectId]);

  const isValidEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
  const canAddByEmail = !selectedUser && isValidEmail(searchQuery) && searchQuery.length >= 3;

  const handleSelectUser = useCallback((user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.name || user.email || '');
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
    if (!orgId) {
      setError('No organization context');
      return;
    }

    setAdding(true);
    setError(null);
    try {
      const result = (await addMemberToProject({
        data: {
          orgId,
          projectId,
          ...(selectedUser ?
            { userId: selectedUser.id, role: selectedRole }
          : { email: searchQuery.trim(), role: selectedRole }),
        },
      })) as { invitation?: boolean; email?: string };
      if (result.invitation) {
        showToast.success('Invitation Sent', `Invitation sent to ${result.email || searchQuery}`);
      }
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add member. Please try again.');
    } finally {
      setAdding(false);
    }
  }, [selectedUser, canAddByEmail, orgId, projectId, selectedRole, searchQuery, handleClose]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          {isAtQuotaLimit && (
            <Alert variant='warning'>
              <TriangleAlertIcon />
              <div>
                <AlertTitle>Collaborator limit reached</AlertTitle>
                <AlertDescription>
                  Your team has {quotaInfo?.used} of {quotaInfo?.max} collaborators.{' '}
                  <Link to='/settings/plans' className='font-medium underline'>
                    Upgrade your plan
                  </Link>{' '}
                  to add more team members.
                </AlertDescription>
              </div>
            </Alert>
          )}

          <div className='relative'>
            <label className='text-secondary-foreground mb-1 block text-sm font-medium'>
              Search by name or email
            </label>
            <input
              ref={inputRef}
              type='text'
              autoComplete='off'
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setError(null);
              }}
              placeholder='Type at least 2 characters...'
              className='border-border text-foreground placeholder-muted-foreground/70 focus:ring-primary w-full rounded-lg border px-3 py-2 focus:border-transparent focus:ring-2 focus:outline-none'
              disabled={!!isAtQuotaLimit}
            />

            {searchResults.length > 0 && !selectedUser && (
              <div className='border-border bg-card absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border shadow-lg'>
                {searchResults.map((user: UserSearchResult) => (
                  <button
                    key={user.id}
                    type='button'
                    onClick={() => handleSelectUser(user)}
                    className='flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50'
                  >
                    <Avatar className='size-8 shrink-0'>
                      <AvatarImage
                        src={user.image ?? undefined}
                        alt={user.name || user.email || undefined}
                      />
                      <AvatarFallback className='bg-primary text-sm text-white'>
                        {getInitials(user.name || user.email || undefined)}
                      </AvatarFallback>
                    </Avatar>
                    <div className='min-w-0'>
                      <p className='text-foreground truncate font-medium'>
                        {user.name || 'Unknown'}
                      </p>
                      <p className='text-muted-foreground truncate text-sm'>{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searching && (
              <div className='absolute top-8 right-3'>
                <div className='border-primary size-5 animate-spin rounded-full border-2 border-t-transparent' />
              </div>
            )}
          </div>

          {searchQuery.length >= 2 &&
            !searching &&
            searchResults.length === 0 &&
            !selectedUser &&
            !canAddByEmail && (
              <p className='text-muted-foreground text-sm'>
                No users found matching &quot;{searchQuery}&quot;
              </p>
            )}

          {canAddByEmail && (
            <Alert variant='info'>
              <p className='text-sm'>
                No user found. You can send an invitation to{' '}
                <span className='font-medium'>{searchQuery.trim()}</span>.
              </p>
            </Alert>
          )}

          {selectedUser && (
            <div className='border-info-border bg-info-bg flex items-center justify-between rounded-lg border p-3'>
              <div className='flex items-center gap-3'>
                <Avatar className='size-10'>
                  <AvatarImage
                    src={selectedUser.image ?? undefined}
                    alt={selectedUser.name || selectedUser.email || undefined}
                  />
                  <AvatarFallback className='bg-primary text-white'>
                    {getInitials(selectedUser.name || selectedUser.email || undefined)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className='text-foreground font-medium'>{selectedUser.name || 'Unknown'}</p>
                  <p className='text-muted-foreground text-sm'>{selectedUser.email}</p>
                </div>
              </div>
              <Button
                variant='ghost'
                size='icon-sm'
                onClick={() => {
                  setSelectedUser(null);
                  setSearchQuery('');
                }}
              >
                <span className='sr-only'>Remove selection</span>
              </Button>
            </div>
          )}

          {(selectedUser || canAddByEmail) && (
            <div>
              <label className='text-secondary-foreground mb-1 block text-sm font-medium'>
                Role
              </label>
              <Select
                value={selectedRole}
                onValueChange={v => setSelectedRole(v as 'member' | 'owner')}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a role' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='member'>Member - Can edit project content</SelectItem>
                  <SelectItem value='owner'>Owner - Full access and member management</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <Alert variant='destructive'>{error}</Alert>}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMember}
            disabled={(!selectedUser && !canAddByEmail) || adding || !!isAtQuotaLimit}
          >
            {adding ?
              canAddByEmail ?
                'Sending Invitation...'
              : 'Adding...'
            : canAddByEmail ?
              'Send Invitation'
            : 'Add Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
