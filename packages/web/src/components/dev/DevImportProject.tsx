/**
 * DevImportProject - Create dev projects from templates or snapshot JSON
 *
 * Two creation modes:
 * 1. From Template - pick a mock template, map template users to real users,
 *    create the project, then seed it through the sync engine.
 * 2. From JSON - create a project and import an exported workspace snapshot
 *    (the engine's opaque JSON, as produced by the JSON tab's Export).
 *
 * Templates and seeding live in `@/dev/mock-templates` and `@/dev/seed`,
 * which must stay lazy-imported so fixture data stays out of the main bundle.
 */

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import {
  UploadIcon,
  CheckIcon,
  AlertCircleIcon,
  LayoutTemplateIcon,
  BracesIcon,
  SearchIcon,
  XIcon,
  UserIcon,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { createProject } from '@/server/functions/org-projects.functions';
import { importState } from '@/server/functions/dev-tools.functions';
import { searchUsers } from '@/server/functions/users.functions';
import { collectSnapshotUserIds, remapSnapshotUserIds } from '@/dev/snapshot';
import { useOrgs } from '@/hooks/useOrgs';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ActionResult {
  success: boolean;
  message: string;
}

type CreationMode = 'template' | 'json';

interface TemplateOption {
  name: string;
  description: string;
}

interface SearchResult {
  id: string;
  name: string | null;
  email: string;
}

/** Distinct template-user ids referenced by a template's studies, in
 * appearance order — each becomes a mapping row in the Assign Users UI.
 * PDF uploadedBy ids are deliberately not surfaced: they only label list
 * rows, and pool-PDF uploads use the creating user anyway. */
function collectTemplateUserIds(data: {
  studies: Array<{
    reviewer1: string | null;
    reviewer2: string | null;
    checklists: Array<{ assignedTo: string | null }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const study of data.studies) {
    if (study.reviewer1) ids.add(study.reviewer1);
    if (study.reviewer2) ids.add(study.reviewer2);
    for (const checklist of study.checklists) {
      if (checklist.assignedTo) ids.add(checklist.assignedTo);
    }
  }
  return [...ids];
}

/** Friendly labels for the fixture user ids; unknown ids show as-is. */
const TEMPLATE_USER_LABELS: Record<string, string> = {
  user_lead: 'Lead',
  user_reviewer1: 'Reviewer 1',
  user_reviewer2: 'Reviewer 2',
};

function templateUserLabel(id: string): string {
  return TEMPLATE_USER_LABELS[id] ?? id;
}

export function DevImportProject() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgs, isLoading: orgsLoading } = useOrgs();
  const currentUser = useAuthStore(selectUser);

  const [mode, setMode] = useState<CreationMode>('template');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  // Template state
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  // Null while the selected template's user ids are still loading, so Create
  // cannot enable on a vacuous `.every` and let ids pass through unmapped.
  const [templateUserIds, setTemplateUserIds] = useState<string[] | null>([]);
  const [projectName, setProjectName] = useState('');
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});

  // JSON state
  const [jsonProjectName, setJsonProjectName] = useState('Imported Project');
  const [jsonText, setJsonText] = useState('');
  const [jsonUserIds, setJsonUserIds] = useState<string[]>([]);
  const [jsonAssignments, setJsonAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (orgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  const resolvedOrgId = orgs.length === 1 ? orgs[0].id : selectedOrgId;

  useEffect(() => {
    let cancelled = false;
    void import('@/dev/mock-templates').then(({ getTemplateNames, getTemplateDescriptions }) => {
      if (cancelled) return;
      const descriptions = getTemplateDescriptions();
      setTemplates(
        getTemplateNames().map(name => ({ name, description: descriptions[name] ?? '' })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-fill project name + derive user-mapping rows when template changes
  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateUserIds([]);
      return;
    }
    const tmpl = templates.find(t => t.name === selectedTemplate);
    if (tmpl) setProjectName(tmpl.description);

    let cancelled = false;
    setTemplateUserIds(null);
    void import('@/dev/mock-templates').then(({ getTemplate }) => {
      if (cancelled) return;
      const data = getTemplate(selectedTemplate);
      setTemplateUserIds(data ? collectTemplateUserIds(data) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTemplate, templates]);

  // Surface the user ids a pasted snapshot references so they can be
  // remapped to real members before import (unmapped ids pass through).
  const debouncedJsonText = useDebouncedValue(jsonText, 300);
  useEffect(() => {
    let ids: string[] = [];
    try {
      const parsed: unknown = JSON.parse(debouncedJsonText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        ids = collectSnapshotUserIds(parsed as Record<string, unknown>);
      }
    } catch {
      // Not valid JSON (yet) -- no mapping rows to offer
    }
    setJsonUserIds(ids);
  }, [debouncedJsonText]);

  const handleAssignRole = useCallback((roleId: string, userId: string) => {
    setRoleAssignments(prev => ({ ...prev, [roleId]: userId }));
  }, []);

  const handleClearRole = useCallback((roleId: string) => {
    setRoleAssignments(prev => {
      const next = { ...prev };
      delete next[roleId];
      return next;
    });
  }, []);

  const canCreateFromTemplate =
    resolvedOrgId &&
    currentUser &&
    selectedTemplate &&
    projectName.trim() &&
    templateUserIds !== null &&
    templateUserIds.every(id => roleAssignments[id]);

  const canCreateFromJson = resolvedOrgId && jsonProjectName.trim() && jsonText.trim();

  // Add mapped users as project members (skip creator, they're already a
  // member) so remapped reviewer ids resolve in member UIs. Uses the
  // dev-gated direct-add route: the user-facing path only sends invitations,
  // but template import needs immediate membership.
  const addAssignedMembers = async (projectId: string, mapping: Record<string, string>) => {
    if (!resolvedOrgId) return;
    const assignedUserIds = [...new Set(Object.values(mapping))];
    for (const userId of assignedUserIds) {
      if (userId === currentUser?.id) continue;
      try {
        await fetch('/api/test/add-project-member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: resolvedOrgId, projectId, userId, role: 'member' }),
        });
      } catch {
        // Non-fatal -- user may already be a member or not in org
      }
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!resolvedOrgId || !currentUser || !selectedTemplate || !projectName.trim()) return;

    setIsCreating(true);
    setResult(null);

    try {
      const newProject = (await createProject({
        data: { orgId: resolvedOrgId, name: projectName.trim() },
      })) as { id: string };

      await addAssignedMembers(newProject.id, roleAssignments);

      const { devApplyTemplate } = await import('@/dev/seed');
      const { studies, pdfs, references } = await devApplyTemplate(
        newProject.id,
        selectedTemplate,
        {
          mode: 'replace',
          userMapping: roleAssignments,
          actorId: currentUser.id,
          orgId: resolvedOrgId,
          enrichReferences: true,
          onProgress: message => setResult({ success: true, message }),
        },
      );

      let message = `Project created with ${studies} ${studies === 1 ? 'study' : 'studies'}`;
      if (references > 0) {
        message += `, ${references} ${references === 1 ? 'reference' : 'references'}`;
      }
      if (pdfs > 0) {
        message += `, ${pdfs} ${pdfs === 1 ? 'PDF' : 'PDFs'}`;
      } else if (studies > 0) {
        message += ' (no dev PDFs: run pnpm --filter web dev:pdfs)';
      }
      setResult({ success: true, message });

      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

      setTimeout(() => {
        navigate({ to: `/projects/${newProject.id}` });
      }, 800);
    } catch (err) {
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateFromJson = async () => {
    if (!resolvedOrgId || !jsonProjectName.trim() || !jsonText.trim()) return;

    let snapshot: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('snapshot must be a JSON object');
      }
      snapshot = parsed as Record<string, unknown>;
    } catch (err) {
      setResult({ success: false, message: `Invalid JSON: ${(err as Error).message}` });
      return;
    }

    setIsCreating(true);
    setResult(null);

    try {
      const newProject = (await createProject({
        data: { orgId: resolvedOrgId, name: jsonProjectName.trim() },
      })) as { id: string };

      await addAssignedMembers(newProject.id, jsonAssignments);

      await importState({
        data: {
          orgId: resolvedOrgId,
          projectId: newProject.id,
          snapshot: remapSnapshotUserIds(snapshot, jsonAssignments),
        },
      });

      setResult({ success: true, message: 'Project imported' });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

      setTimeout(() => {
        navigate({ to: `/projects/${newProject.id}` });
      }, 500);
    } catch (err) {
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setJsonText(await file.text());
      setResult(null);
    } catch {
      setResult({ success: false, message: 'Failed to read file' });
    }
  };

  const modeButtonClass = (active: boolean) =>
    cn('flex-1', active && 'bg-purple-600 text-white hover:bg-purple-700');

  return (
    <div className='flex h-full flex-col gap-3 p-3'>
      <div className='text-foreground text-sm font-medium'>Create Dev Project</div>

      {/* Mode toggle */}
      <div className='bg-muted flex gap-1 rounded-lg p-1'>
        <Button
          variant={mode === 'template' ? 'default' : 'ghost'}
          size='sm'
          className={modeButtonClass(mode === 'template')}
          onClick={() => setMode('template')}
        >
          <LayoutTemplateIcon />
          From Template
        </Button>
        <Button
          variant={mode === 'json' ? 'default' : 'ghost'}
          size='sm'
          className={modeButtonClass(mode === 'json')}
          onClick={() => setMode('json')}
        >
          <BracesIcon />
          From JSON
        </Button>
      </div>

      {/* Org selector */}
      {!orgsLoading && orgs.length > 1 && (
        <div>
          <label className='text-2xs text-muted-foreground mb-1 block font-medium tracking-wide uppercase'>
            Organization
          </label>
          <Select
            value={selectedOrgId || undefined}
            onValueChange={value => setSelectedOrgId(value || null)}
          >
            <SelectTrigger size='sm' className='w-full text-xs'>
              <SelectValue placeholder='Select organization' />
            </SelectTrigger>
            <SelectContent className='z-10000'>
              {orgs.map(org => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Template mode */}
      {mode === 'template' && (
        <>
          <div>
            <label className='text-2xs text-muted-foreground mb-1 block font-medium tracking-wide uppercase'>
              Template
            </label>
            <Select
              value={selectedTemplate || undefined}
              onValueChange={value => {
                setSelectedTemplate(value);
                setRoleAssignments({});
              }}
              disabled={isCreating || templates.length === 0}
            >
              <SelectTrigger size='sm' className='w-full text-xs'>
                <SelectValue placeholder='Select a template...' />
              </SelectTrigger>
              <SelectContent className='z-10000'>
                {templates.map(t => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name} - {t.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <>
              <div>
                <label className='text-2xs text-muted-foreground mb-1 block font-medium tracking-wide uppercase'>
                  Project Name
                </label>
                <Input
                  type='text'
                  className='h-7 text-xs'
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              {templateUserIds !== null && templateUserIds.length > 0 && (
                <div className='flex flex-col gap-2'>
                  <label className='text-2xs text-muted-foreground font-medium tracking-wide uppercase'>
                    Assign Users
                  </label>
                  {templateUserIds.map(templateUserId => (
                    <UserSearchField
                      key={templateUserId}
                      label={templateUserLabel(templateUserId)}
                      selectedUserId={roleAssignments[templateUserId] || null}
                      currentUser={currentUser}
                      excludeUserIds={Object.entries(roleAssignments)
                        .filter(([k]) => k !== templateUserId)
                        .map(([, v]) => v)}
                      onSelect={userId => handleAssignRole(templateUserId, userId)}
                      onClear={() => handleClearRole(templateUserId)}
                      disabled={isCreating}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <Button
            size='sm'
            className='mt-auto bg-purple-600 text-white hover:bg-purple-700'
            onClick={handleCreateFromTemplate}
            disabled={!canCreateFromTemplate || isCreating}
          >
            {isCreating ?
              <Spinner size='sm' variant='white' />
            : <LayoutTemplateIcon />}
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>
        </>
      )}

      {/* JSON mode */}
      {mode === 'json' && (
        <>
          <div>
            <label className='text-2xs text-muted-foreground mb-1 block font-medium tracking-wide uppercase'>
              Project Name
            </label>
            <Input
              type='text'
              className='h-7 text-xs'
              value={jsonProjectName}
              onChange={e => setJsonProjectName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div>
            <label className='text-2xs text-muted-foreground mb-1 block font-medium tracking-wide uppercase'>
              Snapshot File
            </label>
            <input
              type='file'
              accept='.json,application/json'
              onChange={handleFileSelect}
              className='w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-purple-100 file:px-2 file:py-1 file:text-xs file:text-purple-700 hover:file:bg-purple-200'
            />
          </div>

          <div className='min-h-0 flex-1'>
            <label className='text-2xs text-muted-foreground mb-1 block font-medium tracking-wide uppercase'>
              Or paste snapshot JSON
            </label>
            <textarea
              className='border-border bg-muted h-[calc(100%-1.25rem)] w-full resize-none rounded border p-2 font-mono text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none'
              placeholder='Paste an exported workspace snapshot here...'
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
            />
          </div>

          {jsonUserIds.length > 0 && (
            <div className='flex flex-col gap-2'>
              <label className='text-2xs text-muted-foreground font-medium tracking-wide uppercase'>
                Map Users (optional, unmapped ids pass through)
              </label>
              {jsonUserIds.map(snapshotUserId => (
                <UserSearchField
                  key={snapshotUserId}
                  label={templateUserLabel(snapshotUserId)}
                  selectedUserId={jsonAssignments[snapshotUserId] || null}
                  currentUser={currentUser}
                  excludeUserIds={Object.entries(jsonAssignments)
                    .filter(([k]) => k !== snapshotUserId)
                    .map(([, v]) => v)}
                  onSelect={userId =>
                    setJsonAssignments(prev => ({ ...prev, [snapshotUserId]: userId }))
                  }
                  onClear={() =>
                    setJsonAssignments(prev => {
                      const next = { ...prev };
                      delete next[snapshotUserId];
                      return next;
                    })
                  }
                  disabled={isCreating}
                />
              ))}
            </div>
          )}

          <Button
            size='sm'
            className='bg-purple-600 text-white hover:bg-purple-700'
            onClick={handleCreateFromJson}
            disabled={!canCreateFromJson || isCreating}
          >
            {isCreating ?
              <Spinner size='sm' variant='white' />
            : <UploadIcon />}
            {isCreating ? 'Creating...' : 'Create & Import Project'}
          </Button>
        </>
      )}

      {result && (
        <Alert
          variant={result.success ? 'success' : 'destructive'}
          className='items-center gap-2 px-2 py-2'
        >
          {result.success ?
            <CheckIcon />
          : <AlertCircleIcon />}
          <AlertDescription className='text-xs'>{result.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// -- Inline user search field --

interface UserSearchFieldProps {
  label: string;
  selectedUserId: string | null;
  currentUser: { id: string; name?: string; email: string; image?: string | null } | null;
  excludeUserIds: string[];
  onSelect: (_userId: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

function UserSearchField({
  label,
  selectedUserId,
  currentUser,
  excludeUserIds,
  onSelect,
  onClear,
  disabled,
}: UserSearchFieldProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setSearching(true);
      try {
        const data = await searchUsers({ data: { q: debouncedQuery } });
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
  }, [debouncedQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const excludeSet = new Set(excludeUserIds);

  // Current user as an option when query is short
  const options: SearchResult[] = [];
  if (currentUser && debouncedQuery.length < 2 && !excludeSet.has(currentUser.id)) {
    options.push({ id: currentUser.id, name: currentUser.name || null, email: currentUser.email });
  }
  for (const r of results) {
    if (!excludeSet.has(r.id) && !options.some(o => o.id === r.id)) {
      options.push(r);
    }
  }

  const handleSelect = (user: SearchResult) => {
    setSelectedUser(user);
    onSelect(user.id);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedUser(null);
    onClear();
    setQuery('');
  };

  const getUserLabel = (user: SearchResult) => {
    const name = user.name || user.email;
    if (currentUser && user.id === currentUser.id) return `${name} (me)`;
    return name;
  };

  if (selectedUserId && selectedUser) {
    return (
      <div className='border-border bg-muted flex items-center gap-2 rounded border p-2'>
        <span className='text-muted-foreground text-2xs shrink-0 font-medium'>{label}</span>
        <div className='flex min-w-0 flex-1 items-center gap-1.5'>
          <UserIcon size={12} className='shrink-0 text-purple-500' />
          <span className='text-foreground truncate text-xs font-medium'>
            {getUserLabel(selectedUser)}
          </span>
          {!disabled && (
            <Button variant='ghost' size='icon-xs' className='ml-auto size-5' onClick={handleClear}>
              <XIcon className='size-2.5' />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='border-border bg-muted rounded border p-2' ref={containerRef}>
      <div className='mb-1'>
        <span className='text-muted-foreground text-2xs font-medium'>{label}</span>
      </div>
      <div className='relative'>
        <SearchIcon
          size={10}
          className='text-muted-foreground absolute top-1/2 left-1.5 -translate-y-1/2'
        />
        <Input
          type='text'
          className='h-7 pr-2 pl-5 text-xs'
          placeholder='Search user...'
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
        />
        {searching && (
          <Spinner
            size='sm'
            variant='gray'
            className='absolute top-1/2 right-1.5 size-3 -translate-y-1/2 border'
          />
        )}
      </div>

      {isOpen && options.length > 0 && (
        <div className='border-border bg-card mt-1 max-h-32 overflow-y-auto rounded border shadow-lg'>
          {options.map(user => (
            <button
              key={user.id}
              type='button'
              className='flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-purple-50'
              onClick={() => handleSelect(user)}
            >
              <UserIcon size={10} className='text-muted-foreground shrink-0' />
              <span className='text-foreground truncate font-medium'>{user.name || 'Unknown'}</span>
              <span className='text-muted-foreground truncate'>{user.email}</span>
              {currentUser && user.id === currentUser.id && (
                <span className='text-2xs rounded bg-purple-100 px-1 text-purple-600'>(me)</span>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && debouncedQuery.length >= 2 && !searching && options.length === 0 && (
        <div className='text-muted-foreground mt-1 rounded p-2 text-xs'>No users found</div>
      )}
    </div>
  );
}
