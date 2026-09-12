/**
 * AddMemberModal - Search for a person or enter an email to invite them to
 * a project. One field holds the chosen person as a chip, the search input,
 * and the role picker; matches drop in as a list directly beneath it.
 */

import { useState, useEffect, useRef, useId } from 'react';
import { Link } from '@tanstack/react-router';
import { MailIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

type Target = { kind: 'user'; user: UserSearchResult } | { kind: 'email'; email: string };

const isValidEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

function rowId(listboxId: string, target: Target) {
  return `${listboxId}-${target.kind === 'user' ? target.user.id : 'email'}`;
}

function UserAvatar({ user, className }: { user: UserSearchResult; className: string }) {
  const label = user.name || user.email || undefined;
  return (
    <Avatar className={className}>
      <AvatarImage src={user.image ?? undefined} alt={label} />
      <AvatarFallback className='text-[9px]'>{getInitials(label)}</AvatarFallback>
    </Avatar>
  );
}

export function AddMemberModal({
  isOpen,
  onClose,
  projectId,
  orgId,
  quotaInfo,
}: AddMemberModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [target, setTarget] = useState<Target | null>(null);
  const [role, setRole] = useState<Role>('member');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const isAtQuotaLimit =
    quotaInfo && !isUnlimitedQuota(quotaInfo.max) && quotaInfo.used >= quotaInfo.max;

  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 300);
  const settled = debouncedQuery === trimmedQuery;

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!settled || debouncedQuery.length < 2) return;
    let cancelled = false;
    setSearching(true);
    (async () => {
      try {
        const found = await searchUsers({
          data: { q: debouncedQuery, projectId: projectId || undefined },
        });
        if (cancelled) return;
        setResults(found);
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
  }, [settled, debouncedQuery, projectId]);

  // A typed email with no matching account is offered as its own row once the
  // search has settled, so it does not flash before the account row arrives.
  const emailQuery = isValidEmail(trimmedQuery) ? trimmedQuery : null;
  const emailHasAccount =
    !!emailQuery && results.some(u => u.email?.toLowerCase() === emailQuery.toLowerCase());
  const offerEmail = !!emailQuery && !emailHasAccount && settled && !searching;
  const rows: Target[] = [
    ...(trimmedQuery.length >= 2 ? results.map(user => ({ kind: 'user', user }) as Target) : []),
    ...(offerEmail ? [{ kind: 'email', email: emailQuery } as Target] : []),
  ];
  const showNoMatch =
    rows.length === 0 && settled && !searching && trimmedQuery.length >= 2 && !emailQuery;
  const showList = rows.length > 0 || showNoMatch;

  // Typing a full email and pressing Send should work without picking the row.
  const pending: Target | null =
    target ?? (emailQuery && !emailHasAccount ? { kind: 'email', email: emailQuery } : null);
  const canSubmit = !!pending && !adding && !isAtQuotaLimit;

  const choose = (row: Target) => {
    setTarget(row);
    setQuery('');
    setResults([]);
    setError(null);
    inputRef.current?.focus();
  };

  const clearTarget = () => {
    setTarget(null);
    inputRef.current?.focus();
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setTarget(null);
    setRole('member');
    setError(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && query === '' && target) {
      e.preventDefault();
      setTarget(null);
      return;
    }
    if (rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(rows[Math.min(activeIndex, rows.length - 1)]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !pending) return;
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
          ...(pending.kind === 'user' ?
            { userId: pending.user.id, role }
          : { email: pending.email, role }),
        },
      })) as { invitation?: boolean; email?: string };
      clientLogger.info('client.collaborator.invited', { method: 'email' });
      const sentTo =
        result.email ||
        (pending.kind === 'user' ? pending.user.name || pending.user.email : pending.email);
      showToast.success(
        'Invitation sent',
        `${sentTo} can join the project from the link in the email.`,
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

  const activeRow = rows[Math.min(activeIndex, rows.length - 1)];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        className='gap-0 p-0 sm:max-w-md'
        showCloseButton={false}
        data-testid='invite-member-dialog'
      >
        <form onSubmit={handleSubmit}>
          <div className='px-4 pt-3.5'>
            <DialogTitle className='text-sm font-medium'>Invite a member</DialogTitle>
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

          <div className='px-4 pt-3 pb-4'>
            <div className='border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 relative rounded-lg border transition-colors focus-within:ring-3'>
              <div className='flex min-h-9 flex-wrap items-center gap-1.5 py-1 pr-1 pl-2.5'>
                {target && (
                  <span className='bg-muted text-foreground inline-flex h-6 max-w-full items-center gap-1.5 rounded-md pr-0.5 pl-1 text-xs font-medium'>
                    {target.kind === 'user' ?
                      <UserAvatar user={target.user} className='size-4' />
                    : <MailIcon className='text-muted-foreground size-3' />}
                    <span className='truncate'>
                      {target.kind === 'user' ?
                        target.user.name || target.user.email
                      : target.email}
                    </span>
                    <button
                      type='button'
                      onClick={clearTarget}
                      aria-label='Clear the selected person'
                      className='text-muted-foreground hover:bg-foreground/10 hover:text-foreground flex size-4 items-center justify-center rounded'
                    >
                      <XIcon className='size-3' />
                    </button>
                  </span>
                )}
                <input
                  ref={inputRef}
                  type='text'
                  role='combobox'
                  autoComplete='off'
                  aria-label='Search by name or email'
                  aria-expanded={rows.length > 0}
                  aria-controls={listboxId}
                  aria-autocomplete='list'
                  aria-activedescendant={activeRow ? rowId(listboxId, activeRow) : undefined}
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setError(null);
                    if (e.target.value.trim().length < 2) setResults([]);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={target ? '' : 'Name or email'}
                  disabled={!!isAtQuotaLimit}
                  className='placeholder:text-muted-foreground h-6 min-w-24 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed'
                />
                {searching && <Spinner size='sm' className='size-3.5' />}
                <Select value={role} onValueChange={v => setRole(v as Role)}>
                  <SelectTrigger
                    size='sm'
                    aria-label='Role'
                    className='text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted h-6 border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent'
                  >
                    <SelectValue>{ROLES.find(r => r.value === role)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align='end'>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        <span>{r.label}</span>
                        <span className='text-muted-foreground text-xs'>{r.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showList && (
                <div
                  id={listboxId}
                  role='listbox'
                  aria-label='People'
                  className='bg-popover text-popover-foreground ring-foreground/10 absolute top-full right-0 left-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg p-1 shadow-md ring-1'
                >
                  {rows.map((row, index) => (
                    <div
                      key={rowId(listboxId, row)}
                      id={rowId(listboxId, row)}
                      role='option'
                      aria-selected={index === activeIndex}
                      data-testid={row.kind === 'email' ? 'invite-email-option' : undefined}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => choose(row)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
                        index === activeIndex && 'bg-muted',
                      )}
                    >
                      {row.kind === 'user' ?
                        <>
                          <UserAvatar user={row.user} className='size-6' />
                          <span className='text-foreground truncate font-medium'>
                            {row.user.name || 'Unknown'}
                          </span>
                          <span className='text-muted-foreground min-w-0 truncate text-xs'>
                            {row.user.email}
                          </span>
                        </>
                      : <>
                          <span className='bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full'>
                            <MailIcon className='size-3' />
                          </span>
                          <span className='text-foreground truncate font-medium'>
                            Invite by email
                          </span>
                          <span className='text-muted-foreground min-w-0 truncate text-xs'>
                            {row.email}
                          </span>
                        </>
                      }
                    </div>
                  ))}
                  {showNoMatch && (
                    <p className='text-muted-foreground px-2 py-1.5 text-xs'>
                      No one matches &quot;{trimmedQuery}&quot;. Enter a full email address to
                      invite someone new.
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <Alert variant='destructive' className='mt-3'>
                {error}
              </Alert>
            )}
          </div>

          <div className='bg-muted/50 flex items-center justify-end gap-1.5 rounded-b-xl border-t px-4 py-2.5'>
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
