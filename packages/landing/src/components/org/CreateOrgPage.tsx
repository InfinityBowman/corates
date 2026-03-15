/**
 * CreateOrgPage - Page for creating a new organization
 */

import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/api/auth-client';
import { queryKeys } from '@/lib/queryKeys.js';
import { showToast } from '@/components/ui/toast';
import { setLastOrgSlug } from '@/hooks/useOrgContext';

export function CreateOrgPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    const generatedSlug = newName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const orgName = name.trim();
      const orgSlug = slug.trim();

      if (!orgName) {
        setError('Organization name is required');
        return;
      }
      if (!orgSlug) {
        setError('Organization slug is required');
        return;
      }
      if (!/^[a-z0-9-]+$/.test(orgSlug)) {
        setError('Slug can only contain lowercase letters, numbers, and hyphens');
        return;
      }

      setIsSubmitting(true);
      try {
        const { error: createError } = await authClient.organization.create({
          name: orgName,
          slug: orgSlug,
        });

        if (createError) {
          throw new Error(createError.message || 'Failed to create organization');
        }

        await queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list });
        setLastOrgSlug(orgSlug);
        showToast.success('Organization Created', `${orgName} is ready to use`);
        navigate({ to: '/dashboard', replace: true });
      } catch (err: any) {
        console.error('Create org error:', err);
        setError(err.message || 'Failed to create organization');
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, slug, queryClient, navigate],
  );

  return (
    <div className='flex min-h-[70vh] items-center justify-center p-6'>
      <div className='w-full max-w-md'>
        <div className='border-border bg-card rounded-lg border p-8 shadow-sm'>
          <div className='mb-6 text-center'>
            <h1 className='text-foreground text-2xl font-bold'>Create Your Workspace</h1>
            <p className='text-muted-foreground mt-2'>
              Organizations help you collaborate with your team on research projects.
            </p>
          </div>

          <form onSubmit={handleSubmit} className='space-y-4'>
            {error && (
              <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
                {error}
              </div>
            )}

            <div>
              <label htmlFor='org-name' className='text-foreground block text-sm font-medium'>
                Organization Name
              </label>
              <input
                id='org-name'
                type='text'
                value={name}
                onChange={handleNameChange}
                placeholder='My Research Lab'
                className='border-border bg-card focus:border-primary focus:ring-primary mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none'
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor='org-slug' className='text-foreground block text-sm font-medium'>
                URL Slug
              </label>
              <div className='border-border focus-within:border-primary focus-within:ring-primary mt-1 flex rounded-lg border shadow-sm focus-within:ring-1'>
                <span className='border-border bg-muted text-muted-foreground inline-flex items-center rounded-l-lg border-r px-3 text-sm'>
                  /orgs/
                </span>
                <input
                  id='org-slug'
                  type='text'
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder='my-research-lab'
                  className='block w-full rounded-r-lg border-0 px-3 py-2 focus:outline-none'
                  disabled={isSubmitting}
                />
              </div>
              <p className='text-muted-foreground mt-1 text-xs'>
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <button
              type='submit'
              disabled={isSubmitting || !name.trim() || !slug.trim()}
              className='bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-2 font-medium transition focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
            >
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
