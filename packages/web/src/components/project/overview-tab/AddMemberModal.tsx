/**
 * AddMemberModal - Search for a person or enter an email to invite them to
 * a project. Composer-style dialog matching CreateProjectModal.
 */

import { useState, useEffect, useRef, useId } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRightIcon, MailIcon, TriangleAlertIcon, UsersIcon, XIcon } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { searchUsers } from '@/server/functions/users.functions';
import { addMemberToProject } from '@/server/functions/org-projects.functions';
import type { UserSearchResult } from '@/server/functions/users.server';
import { clientLogger } from '@/lib/clientLogger';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  orgId: string | null;
  quotaInfo?: { used: number; max: number };
}

type Role = 'member' | 'owner';

const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: 'member',
    label: 'Reviewer',
    description: 'Appraises studies and edits project content',
  },
  { value: 'owner', label: 'Lead', description: 'Also assigns reviewers and manages members' },
];

const isValidEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('member');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const isAtQuotaLimit =
    quotaInfo && !isUnlimitedQuota(quotaInfo.max) && quotaInfo.used >= quotaInfo.max;

  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const settled = debouncedQuery === searchQuery;

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Selecting a person fills the input with their name; searching that would
  // only re-list them, so the search is paused until the query is edited.
  useEffect(() => {
    if (!settled || selectedUser || debouncedQuery.trim().length < 2) return;
    let cancelled = false;
    setSearching(true);
    (async () => {
      try {
        const results = await searchUsers({
          data: { q: debouncedQuery, projectId: projectId || undefined },
        });
        if (cancelled) return;
        setSearchResults(results);
        setActiveIndex(0);
        setSearching(false);
      } catch (err: unknown) {
        if (cancelled) return;
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { setError, showToast: false });
        setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
      setSearching(false);
    };
  }, [settled, selectedUser, debouncedQuery, projectId]);

  const trimmedQuery = searchQuery.trim();
  const canAddByEmail = !selectedUser && isValidEmail(trimmedQuery) && trimmedQuery.length >= 3;
  const canSubmit = (!!selectedUser || canAddByEmail) && !adding && !isAtQuotaLimit;
  const showResults = !selectedUser && searchResults.length > 0;
  const showNoMatch =
    !selectedUser &&
    !canAddByEmail &&
    settled &&
    !searching &&
    trimmedQuery.length >= 2 &&
    searchResults.length === 0;

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    setSelectedUser(null);
    setError(null);
    if (value.trim().length < 2) setSearchResults([]);
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.name || user.email || '');
    setSearchResults([]);
    setError(null);
  };

  const clearSelection = () => {
    setSelectedUser(null);
    setSearchQuery('');
    setSearchResults([]);
    inputRef.current?.focus();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setSelectedRole('member');
    setError(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectUser(searchResults[activeIndex]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!orgId) {
      setError('This project is not linked to a team yet. Reload the page and try again.');
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
          : { email: trimmedQuery, role: selectedRole }),
        },
      })) as { invitation?: boolean; email?: string };
      clientLogger.info('client.collaborator.invited', { method: 'email' });
      showToast.success(
        'Invitation sent',
        `${result.email || trimmedQuery} can join the project from the link in the email.`,
      );
      // The invitations list is a D1 fact read through React Query. Nothing
      // pushes it to this client, so refetch after the write.
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.invitations(projectId) });
      handleClose();
    } catch (err: unknown) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { setError, showToast: false });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        className='gap-0 overflow-hidden p-0 sm:max-w-md'
        showCloseButton={false}
        data-testid='invite-member-dialog'
      >
        <DialogTitle className='sr-only'>Invite a member</DialogTitle>

        <form onSubmit={handleSubmit}>
          <div className='text-muted-foreground flex items-center gap-2 px-4 pt-3 text-xs'>
            <span className='bg-muted inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 font-medium'>
              <UsersIcon className='size-3' />
              Members
            </span>
            <ChevronRightIcon className='size-3' />
            <span>Invite a member</span>
          </div>

          {isAtQuotaLimit && (
            <div className='px-4 pt-3'>
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
            </div>
          )}

          <div className='relative px-4 pt-2.5 pb-1'>
            <Input
              ref={inputRef}
              type='text'
              role='combobox'
              autoComplete='off'
              aria-label='Search by name or email'
              aria-expanded={showResults}
              aria-controls={listboxId}
              aria-autocomplete='list'
              aria-activedescendant={
                showResults ? `${listboxId}-${searchResults[activeIndex]?.id}` : undefined
              }
              value={searchQuery}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Name or email'
              disabled={!!isAtQuotaLimit}
              className='h-auto rounded-none border-0 px-0 py-1 text-lg font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-lg'
            />
            {searching && (
              <div className='absolute top-1/2 right-4 -translate-y-1/2'>
                <Spinner size='sm' className='size-4' />
              </div>
            )}
          </div>

          <div className='min-h-16 px-4 pb-4'>
            {selectedUser ?
              <div className='border-border bg-card flex items-center gap-3 rounded-lg border py-2 pr-1.5 pl-2.5'>
                <Avatar className='size-7'>
                  <AvatarImage
                    src={selectedUser.image ?? undefined}
                    alt={selectedUser.name || selectedUser.email || undefined}
                  />
                  <AvatarFallback className='text-[10px]'>
                    {getInitials(selectedUser.name || selectedUser.email || undefined)}
                  </AvatarFallback>
                </Avatar>
                <div className='min-w-0 flex-1'>
                  <p className='text-foreground truncate text-sm font-medium'>
                    {selectedUser.name || 'Unknown'}
                  </p>
                  <p className='text-muted-foreground truncate text-xs'>{selectedUser.email}</p>
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-xs'
                  className='text-muted-foreground hover:text-foreground'
                  onClick={clearSelection}
                  aria-label='Clear the selected person'
                >
                  <XIcon className='size-3.5' />
                </Button>
              </div>
            : showResults ?
              <div
                id={listboxId}
                role='listbox'
                aria-label='People'
                className='border-border bg-card max-h-56 overflow-y-auto rounded-lg border py-1'
              >
                {searchResults.map((user, index) => (
                  <div
                    key={user.id}
                    id={`${listboxId}-${user.id}`}
                    role='option'
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleSelectUser(user)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-sm',
                      index === activeIndex && 'bg-muted',
                    )}
                  >
                    <Avatar className='size-6'>
                      <AvatarImage
                        src={user.image ?? undefined}
                        alt={user.name || user.email || undefined}
                      />
                      <AvatarFallback className='text-[10px]'>
                        {getInitials(user.name || user.email || undefined)}
                      </AvatarFallback>
                    </Avatar>
                    <span className='text-foreground truncate font-medium'>
                      {user.name || 'Unknown'}
                    </span>
                    <span className='text-muted-foreground min-w-0 truncate text-xs'>
                      {user.email}
                    </span>
                  </div>
                ))}
              </div>
            : canAddByEmail ?
              <div className='border-border bg-card flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm'>
                <span className='bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full'>
                  <MailIcon className='size-3.5' />
                </span>
                <p className='text-muted-foreground min-w-0 text-xs'>
                  No user found. You can send an invitation to{' '}
                  <span className='text-foreground font-medium break-all'>{trimmedQuery}</span>.
                </p>
              </div>
            : showNoMatch ?
              <p className='text-muted-foreground text-xs'>
                No one matches &quot;{trimmedQuery}&quot;. Enter a full email address to invite
                someone new.
              </p>
            : <p className='text-muted-foreground text-xs'>
                Search by name to find someone with an account, or enter an email to invite them.
              </p>
            }

            {error && (
              <Alert variant='destructive' className='mt-3'>
                {error}
              </Alert>
            )}
          </div>

          <div className='bg-muted/50 flex items-center justify-between gap-2 border-t px-4 py-2.5'>
            <Select value={selectedRole} onValueChange={v => setSelectedRole(v as Role)}>
              <SelectTrigger
                size='sm'
                aria-label='Role'
                className='h-6 text-xs'
                disabled={!selectedUser && !canAddByEmail}
              >
                <SelectValue>{ROLES.find(r => r.value === selectedRole)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent align='start'>
                {ROLES.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    <span>{role.label}</span>
                    <span className='text-muted-foreground text-xs'>{role.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className='flex items-center gap-1.5'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={handleClose}
                disabled={adding}
              >
                Cancel
              </Button>
              <Button type='submit' size='sm' disabled={!canSubmit}>
                {adding ? 'Sending...' : 'Send invitation'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
