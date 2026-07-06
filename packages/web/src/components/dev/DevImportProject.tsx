/**
 * DevImportProject - Create dev projects from templates or JSON
 *
 * Two creation modes:
 * 1. From Template - pick template, assign real users to roles, creates project
 * 2. From JSON - paste/upload exported JSON, creates project
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
import { createProject, addMemberToProject } from '@/server/functions/org-projects.functions';
import { importState, applyTemplate } from '@/server/functions/dev-tools.functions';
import { searchUsers } from '@/server/functions/users.functions';
import { fetchReferenceByIdentifier } from '@/lib/referenceLookup';
import { uploadPdf } from '@/api/pdf-api';
import { loadDevPdfPool, takeDevPdf } from '@/lib/devPdfPool';
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

interface StudyIdentifier {
  id: string;
  doi: string | null;
}

type CreationMode = 'template' | 'json';

const TEMPLATES = [
  { name: 'empty', description: 'Empty project with no studies' },
  { name: 'studies-only', description: 'Studies but no checklists' },
  { name: 'amstar2-complete', description: 'Completed AMSTAR2 checklist' },
  { name: 'robins-i-progress', description: 'Partially completed ROBINS-I' },
  { name: 'reconciliation-ready', description: 'Two AMSTAR2 checklists ready for reconciliation' },
  {
    name: 'reconciliation-ready-rob2',
    description: 'Two ROB2 checklists ready for reconciliation',
  },
  {
    name: 'reconciliation-ready-robins-i',
    description: 'Two ROBINS-I checklists ready for reconciliation',
  },
  { name: 'full-workflow', description: 'Studies in various workflow states' },
] as const;

interface TemplateRole {
  id: string;
  label: string;
}

const TEMPLATE_ROLES: Record<string, TemplateRole[]> = {
  empty: [],
  'studies-only': [],
  'amstar2-complete': [{ id: 'user_reviewer1', label: 'Reviewer' }],
  'robins-i-progress': [{ id: 'user_reviewer1', label: 'Reviewer' }],
  'reconciliation-ready': [
    { id: 'user_reviewer1', label: 'Reviewer 1' },
    { id: 'user_reviewer2', label: 'Reviewer 2' },
  ],
  'reconciliation-ready-rob2': [
    { id: 'user_reviewer1', label: 'Reviewer 1' },
    { id: 'user_reviewer2', label: 'Reviewer 2' },
  ],
  'reconciliation-ready-robins-i': [
    { id: 'user_reviewer1', label: 'Reviewer 1' },
    { id: 'user_reviewer2', label: 'Reviewer 2' },
  ],
  'full-workflow': [
    { id: 'user_reviewer1', label: 'Reviewer 1' },
    { id: 'user_reviewer2', label: 'Reviewer 2' },
  ],
};

interface SearchResult {
  id: string;
  name: string | null;
  email: string;
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
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [projectName, setProjectName] = useState('');
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});

  // JSON state
  const [jsonText, setJsonText] = useState('');

  useEffect(() => {
    if (orgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  const resolvedOrgId = orgs.length === 1 ? orgs[0].id : selectedOrgId;

  const roles = TEMPLATE_ROLES[selectedTemplate] || [];

  // Pre-fill project name when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const tmpl = TEMPLATES.find(t => t.name === selectedTemplate);
      if (tmpl) setProjectName(tmpl.description);
    }
  }, [selectedTemplate]);

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
    selectedTemplate &&
    projectName.trim() &&
    roles.every(r => roleAssignments[r.id]);

  const canCreateFromJson = resolvedOrgId && jsonText.trim();

  const handleCreateFromTemplate = async () => {
    if (!resolvedOrgId || !selectedTemplate || !projectName.trim()) return;

    setIsCreating(true);
    setResult(null);

    try {
      const newProject = (await createProject({
        data: { orgId: resolvedOrgId, name: projectName.trim() },
      })) as { id: string };

      const userMapping = Object.keys(roleAssignments).length > 0 ? roleAssignments : undefined;

      const templateResult = (await applyTemplate({
        data: {
          orgId: resolvedOrgId,
          projectId: newProject.id,
          template: selectedTemplate,
          mode: 'replace',
          userMapping,
        },
      })) as { success: boolean; studies?: StudyIdentifier[] };

      // Add assigned users as project members (skip creator, they're already a member)
      const assignedUserIds = [...new Set(Object.values(roleAssignments))];
      for (const userId of assignedUserIds) {
        if (currentUser && userId === currentUser.id) continue;
        try {
          await addMemberToProject({
            data: { orgId: resolvedOrgId, projectId: newProject.id, userId, role: 'member' },
          });
        } catch {
          // Non-fatal -- user may already be a member or not in org
        }
      }

      // Fetch real metadata + PDFs for studies with identifiers
      const studies = templateResult.studies || [];
      const studiesWithIds = studies.filter(s => s.doi);

      if (studiesWithIds.length > 0) {
        setResult({
          success: true,
          message: `Fetching references (0/${studiesWithIds.length})...`,
        });

        let fetched = 0;
        let pdfCount = 0;

        // Publisher PDFs block automated fetches, so attach from the local dev
        // pool (populated by `pnpm --filter web dev:pdfs`) round-robin instead.
        const pdfPool = await loadDevPdfPool();
        let pdfIndex = 0;

        for (const study of studiesWithIds) {
          const identifier = study.doi!;
          try {
            const ref = await fetchReferenceByIdentifier(identifier);
            fetched++;
            setResult({
              success: true,
              message: `Fetching references (${fetched}/${studiesWithIds.length})...`,
            });

            // Build study metadata merge payload
            const studyUpdate: Record<string, unknown> = {
              id: study.id,
              originalTitle: ref.title,
              firstAuthor: ref.firstAuthor,
              publicationYear: ref.publicationYear ? String(ref.publicationYear) : undefined,
              authors: ref.authors,
              journal: ref.journal,
              doi: ref.doi,
              abstract: ref.abstract,
              pdfUrl: ref.pdfUrl,
              pdfSource: ref.pdfSource,
              pdfAccessible: ref.pdfAccessible,
            };

            // Generate a readable study name
            if (ref.firstAuthor && ref.publicationYear) {
              studyUpdate.name = `${ref.firstAuthor} et al. ${ref.publicationYear}`;
            } else if (ref.title) {
              studyUpdate.name = ref.title.length > 60 ? ref.title.slice(0, 57) + '...' : ref.title;
            }

            const pdfs: Array<Record<string, unknown>> = [];

            // Attach a PDF from the local dev pool (skips silently if not downloaded)
            const poolPdf = await takeDevPdf(pdfPool, pdfIndex);
            if (poolPdf) {
              pdfIndex++;
              try {
                const uploadResult = await uploadPdf(
                  resolvedOrgId,
                  newProject.id,
                  study.id,
                  poolPdf.data,
                  poolPdf.fileName,
                );

                pdfs.push({
                  fileName: uploadResult.fileName,
                  key: uploadResult.key,
                  size: uploadResult.size,
                  uploadedBy: currentUser?.id || '',
                  uploadedAt: new Date().toISOString(),
                });
                pdfCount++;
              } catch (pdfErr) {
                console.warn('Failed to attach dev-pool PDF for', identifier, pdfErr);
              }
            }

            // Merge real metadata + PDF info back into Y.Doc
            await importState({
              data: {
                orgId: resolvedOrgId,
                projectId: newProject.id,
                data: {
                  studies: [{ ...studyUpdate, pdfs }],
                },
                mode: 'merge',
              },
            });
          } catch (err) {
            console.warn('Failed to look up', identifier, err);
            fetched++;
          }
        }

        const pdfMsg =
          pdfCount > 0 ? `, ${pdfCount} PDF${pdfCount > 1 ? 's' : ''} attached`
          : pdfPool.length === 0 ? ' (no PDFs - run `pnpm --filter web dev:pdfs`)'
          : '';
        setResult({
          success: true,
          message: `Project created${pdfMsg}`,
        });
      } else {
        setResult({ success: true, message: 'Project created from template' });
      }

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
    if (!resolvedOrgId || !jsonText.trim()) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setResult({ success: false, message: 'Invalid JSON' });
      return;
    }

    setIsCreating(true);
    setResult(null);

    try {
      const name = (parsed.meta as Record<string, unknown>)?.name || 'Imported Project';
      const description =
        ((parsed.meta as Record<string, unknown>)?.description as string) || undefined;

      const newProject = (await createProject({
        data: { orgId: resolvedOrgId, name: name as string, description },
      })) as { id: string };

      await importState({
        data: {
          orgId: resolvedOrgId,
          projectId: newProject.id,
          data: parsed,
          mode: 'replace',
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
              disabled={isCreating}
            >
              <SelectTrigger size='sm' className='w-full text-xs'>
                <SelectValue placeholder='Select a template...' />
              </SelectTrigger>
              <SelectContent className='z-10000'>
                {TEMPLATES.map(t => (
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

              {roles.length > 0 && (
                <div className='flex flex-col gap-2'>
                  <label className='text-2xs text-muted-foreground font-medium tracking-wide uppercase'>
                    Assign Users
                  </label>
                  {roles.map(role => (
                    <UserSearchField
                      key={role.id}
                      label={role.label}
                      selectedUserId={roleAssignments[role.id] || null}
                      currentUser={currentUser}
                      excludeUserIds={Object.entries(roleAssignments)
                        .filter(([k]) => k !== role.id)
                        .map(([, v]) => v)}
                      onSelect={userId => handleAssignRole(role.id, userId)}
                      onClear={() => handleClearRole(role.id)}
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
              JSON File
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
              Or paste JSON
            </label>
            <textarea
              className='border-border bg-muted h-[calc(100%-1.25rem)] w-full resize-none rounded border p-2 font-mono text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none'
              placeholder='Paste exported project JSON here...'
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
            />
          </div>

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
