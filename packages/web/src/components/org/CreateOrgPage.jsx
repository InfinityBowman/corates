/**
 * CreateOrgPage - Page for creating a new organization
 *
 * Shown when user has no organizations or navigates to /orgs/new
 */

import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { authClient } from '@api/auth-client.js';
import { useQueryClient } from '@tanstack/solid-query';
import { queryKeys } from '@lib/queryKeys.js';
import { showToast } from '@/components/ui/toast';
import { setLastOrgSlug } from '@primitives/useOrgContext.js';

export default function CreateOrgPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = createSignal('');
  const [slug, setSlug] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal(null);

  // Auto-generate slug from name
  const handleNameChange = e => {
    const newName = e.target.value;
    setName(newName);

    // Generate slug from name (lowercase, replace spaces with hyphens, remove special chars)
    const generatedSlug = newName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);

    const orgName = name().trim();
    const orgSlug = slug().trim();

    if (!orgName) {
      setError('Organization name is required');
      return;
    }

    if (!orgSlug) {
      setError('Organization slug is required');
      return;
    }

    // Validate slug format
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

      // Invalidate orgs query to refetch
      await queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list });

      // Save as last org
      setLastOrgSlug(orgSlug);

      showToast.success('Organization Created', `${orgName} is ready to use`);

      // Navigate to the new org
      navigate(`/orgs/${orgSlug}`, { replace: true });
    } catch (err) {
      console.error('Create org error:', err);
      setError(err.message || 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class='flex min-h-[70vh] items-center justify-center p-6'>
      <div class='w-full max-w-md'>
        <div class='rounded-lg border border-gray-200 bg-white p-8 shadow-sm'>
          <div class='mb-6 text-center'>
            <h1 class='text-2xl font-bold text-gray-900'>Create Your Workspace</h1>
            <p class='mt-2 text-gray-500'>
              Organizations help you collaborate with your team on research projects.
            </p>
          </div>

          <form onSubmit={handleSubmit} class='space-y-4'>
            {/* Error message */}
            <Show when={error()}>
              <div class='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
                {error()}
              </div>
            </Show>

            {/* Organization name */}
            <div>
              <label for='org-name' class='block text-sm font-medium text-gray-700'>
                Organization Name
              </label>
              <input
                id='org-name'
                type='text'
                value={name()}
                onInput={handleNameChange}
                placeholder='My Research Lab'
                class='mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
                disabled={isSubmitting()}
              />
            </div>

            {/* Organization slug */}
            <div>
              <label for='org-slug' class='block text-sm font-medium text-gray-700'>
                URL Slug
              </label>
              <div class='mt-1 flex rounded-lg border border-gray-300 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500'>
                <span class='inline-flex items-center rounded-l-lg border-r border-gray-300 bg-gray-50 px-3 text-sm text-gray-500'>
                  /orgs/
                </span>
                <input
                  id='org-slug'
                  type='text'
                  value={slug()}
                  onInput={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder='my-research-lab'
                  class='block w-full rounded-r-lg border-0 px-3 py-2 focus:outline-none'
                  disabled={isSubmitting()}
                />
              </div>
              <p class='mt-1 text-xs text-gray-500'>Lowercase letters, numbers, and hyphens only</p>
            </div>

            {/* Submit button */}
            <button
              type='submit'
              disabled={isSubmitting() || !name().trim() || !slug().trim()}
              class='w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
            >
              {isSubmitting() ? 'Creating...' : 'Create Organization'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
