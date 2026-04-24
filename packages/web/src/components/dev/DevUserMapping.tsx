/**
 * DevUserMapping - Shared user mapping UI for dev import/template flows
 *
 * Shows extracted user IDs from import data and lets the user map each
 * to a real user via debounced search (same pattern as AddMemberModal).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SearchIcon, XIcon, UserIcon } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { searchUsers } from '@/server/functions/users.functions';

interface SearchResult {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface UserMappingEntry {
  originalId: string;
  mappedTo: SearchResult | null;
}

interface DevUserMappingProps {
  userIds: string[];
  projectId?: string;
  onConfirm: (_mapping: Record<string, string>) => void;
  onSkip: () => void;
  confirmLabel?: string;
  skipLabel?: string;
}

export function DevUserMapping({
  userIds,
  projectId,
  onConfirm,
  onSkip,
  confirmLabel = 'Import with Mapping',
  skipLabel = 'Import As-Is',
}: DevUserMappingProps) {
  const currentUser = useAuthStore(selectUser);
  const [entries, setEntries] = useState<UserMappingEntry[]>(() =>
    userIds.map(id => ({ originalId: id, mappedTo: null })),
  );

  const handleSelect = useCallback((originalId: string, user: SearchResult | null) => {
    setEntries(prev => prev.map(e => (e.originalId === originalId ? { ...e, mappedTo: user } : e)));
  }, []);

  const handleConfirm = () => {
    const mapping: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.mappedTo) {
        mapping[entry.originalId] = entry.mappedTo.id;
      }
    }
    onConfirm(mapping);
  };

  const hasMappings = entries.some(e => e.mappedTo !== null);

  return (
    <div className='flex flex-col gap-3'>
      <div className='text-foreground text-xs font-medium'>
        {userIds.length} user ID{userIds.length !== 1 ? 's' : ''} found in data
      </div>

      <div className='flex flex-col gap-2'>
        {entries.map(entry => (
          <MappingRow
            key={entry.originalId}
            originalId={entry.originalId}
            mappedTo={entry.mappedTo}
            currentUser={currentUser}
            projectId={projectId}
            onSelect={user => handleSelect(entry.originalId, user)}
          />
        ))}
      </div>

      <div className='flex gap-2'>
        <button
          className='flex-1 rounded bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50'
          onClick={handleConfirm}
          disabled={!hasMappings}
        >
          {confirmLabel}
        </button>
        <button
          className='border-border text-foreground hover:bg-muted flex-1 rounded border px-3 py-2 text-xs font-medium'
          onClick={onSkip}
        >
          {skipLabel}
        </button>
      </div>
    </div>
  );
}

// -- Individual mapping row with search --

interface MappingRowProps {
  originalId: string;
  mappedTo: SearchResult | null;
  currentUser: { id: string; email: string; name?: string; image?: string | null } | null;
  projectId?: string;
  onSelect: (_user: SearchResult | null) => void;
}

function MappingRow({ originalId, mappedTo, currentUser, projectId, onSelect }: MappingRowProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 300);

  // Search users on debounced query change
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setSearching(true);
      try {
        const data = await searchUsers({
          data: { q: debouncedQuery, projectId: projectId || undefined },
        });
        if (!cancelled) setResults(data as SearchResult[]);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, projectId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClear = () => {
    onSelect(null);
    setQuery('');
    setIsOpen(false);
  };

  const handleSelectUser = (user: SearchResult) => {
    onSelect(user);
    setQuery('');
    setIsOpen(false);
  };

  // Build dropdown options: current user first, then search results
  const options: SearchResult[] = [];
  if (currentUser && debouncedQuery.length < 2) {
    options.push({
      id: currentUser.id,
      name: currentUser.name || null,
      email: currentUser.email,
      image: currentUser.image || null,
    });
  }
  for (const r of results) {
    if (!options.some(o => o.id === r.id)) {
      options.push(r);
    }
  }

  return (
    <div
      className='border-border bg-muted flex items-center gap-2 rounded border p-2'
      ref={containerRef}
    >
      {/* Original ID */}
      <div className='min-w-0 shrink-0'>
        <code className='bg-muted text-muted-foreground text-2xs rounded px-1.5 py-0.5'>
          {originalId}
        </code>
      </div>

      <span className='text-muted-foreground text-xs'>-&gt;</span>

      {/* Mapped user or search input */}
      <div className='relative min-w-0 flex-1'>
        {mappedTo ?
          <div className='flex items-center gap-1.5'>
            <UserIcon size={12} className='shrink-0 text-purple-500' />
            <span className='text-foreground truncate text-xs font-medium'>
              {mappedTo.name || mappedTo.email}
            </span>
            {currentUser && mappedTo.id === currentUser.id && (
              <span className='text-2xs rounded bg-purple-100 px-1 text-purple-600'>(me)</span>
            )}
            <button
              className='text-muted-foreground hover:bg-muted hover:text-muted-foreground ml-auto shrink-0 rounded p-0.5'
              onClick={handleClear}
            >
              <XIcon size={10} />
            </button>
          </div>
        : <>
            <div className='relative'>
              <SearchIcon
                size={10}
                className='text-muted-foreground absolute top-1/2 left-1.5 -translate-y-1/2'
              />
              <input
                type='text'
                className='border-border w-full rounded border py-1 pr-2 pl-5 text-xs focus:border-purple-500 focus:outline-none'
                placeholder='Search user...'
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
              />
              {searching && (
                <span className='border-muted-foreground absolute top-1/2 right-1.5 size-3 -translate-y-1/2 animate-spin rounded-full border border-t-transparent' />
              )}
            </div>

            {/* Dropdown */}
            {isOpen && options.length > 0 && (
              <div className='border-border bg-card absolute top-full right-0 left-0 z-50 mt-1 max-h-32 overflow-y-auto rounded border shadow-lg'>
                {options.map(user => (
                  <button
                    key={user.id}
                    type='button'
                    className='flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-purple-50'
                    onClick={() => handleSelectUser(user)}
                  >
                    <UserIcon size={10} className='text-muted-foreground shrink-0' />
                    <span className='text-foreground truncate font-medium'>
                      {user.name || 'Unknown'}
                    </span>
                    <span className='text-muted-foreground truncate'>{user.email}</span>
                    {currentUser && user.id === currentUser.id && (
                      <span className='text-2xs rounded bg-purple-100 px-1 text-purple-600'>
                        (me)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {isOpen && debouncedQuery.length >= 2 && !searching && options.length === 0 && (
              <div className='border-border bg-card text-muted-foreground absolute top-full right-0 left-0 z-50 mt-1 rounded border p-2 text-xs shadow-lg'>
                No users found
              </div>
            )}
          </>
        }
      </div>
    </div>
  );
}

/**
 * Extract all unique user IDs from import data
 */
export function extractUserIds(data: Record<string, unknown>): string[] {
  const ids = new Set<string>();

  const members = data.members as Array<{ userId?: string }> | undefined;
  members?.forEach(m => {
    if (m.userId) ids.add(m.userId);
  });

  const studies = data.studies as
    | Array<{
        reviewer1?: string;
        reviewer2?: string;
        checklists?: Array<{ assignedTo?: string }>;
        pdfs?: Array<{ uploadedBy?: string }>;
      }>
    | undefined;
  studies?.forEach(s => {
    if (s.reviewer1) ids.add(s.reviewer1);
    if (s.reviewer2) ids.add(s.reviewer2);
    s.checklists?.forEach(c => {
      if (c.assignedTo) ids.add(c.assignedTo);
    });
    s.pdfs?.forEach(p => {
      if (p.uploadedBy) ids.add(p.uploadedBy);
    });
  });

  return Array.from(ids);
}

/**
 * Known template user IDs per template name.
 * The `empty` template has no users.
 */
export const TEMPLATE_USER_IDS: Record<string, string[]> = {
  'studies-only': ['user_lead'],
  'amstar2-complete': ['user_reviewer1'],
  'robins-i-progress': ['user_reviewer1'],
  'reconciliation-ready': ['user_reviewer1', 'user_reviewer2'],
  'full-workflow': ['user_lead', 'user_reviewer1', 'user_reviewer2'],
};
