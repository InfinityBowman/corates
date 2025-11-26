import { createSignal, createEffect, For, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { useUserProjects } from './UserYjsProvider.jsx';
import { useBetterAuth } from '../api/better-auth-store.js';

const API_BASE = import.meta.env.VITE_WORKER_API_URL || 'http://localhost:8787';

export default function ProjectView() {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useBetterAuth();
  const userProjects = useUserProjects();

  const [project, setProject] = createSignal(null);
  const [projectDoc, setProjectDoc] = createSignal(null);
  const [members, setMembers] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);

  // Review form state
  const [showReviewForm, setShowReviewForm] = createSignal(false);
  const [newReviewName, setNewReviewName] = createSignal('');
  const [newReviewDescription, setNewReviewDescription] = createSignal('');
  const [creatingReview, setCreatingReview] = createSignal(false);

  // Checklist form state
  const [showChecklistForm, setShowChecklistForm] = createSignal(null); // reviewId or null
  const [newChecklistTitle, setNewChecklistTitle] = createSignal('');
  const [newChecklistAssignee, setNewChecklistAssignee] = createSignal('');
  const [creatingChecklist, setCreatingChecklist] = createSignal(false);

  // Fetch project details from D1
  createEffect(async () => {
    if (!params.projectId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch project metadata from D1
      const projectRes = await fetch(`${API_BASE}/api/projects/${params.projectId}`, {
        credentials: 'include',
      });

      if (!projectRes.ok) {
        throw new Error('Failed to fetch project');
      }

      const projectData = await projectRes.json();
      setProject(projectData);

      // Fetch project members
      const membersRes = await fetch(`${API_BASE}/api/projects/${params.projectId}/members`, {
        credentials: 'include',
      });

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData);
      }

      // Fetch project doc (Y.Doc data) from Durable Object
      const docRes = await fetch(`${API_BASE}/api/project/${params.projectId}`, {
        credentials: 'include',
      });

      if (docRes.ok) {
        const docData = await docRes.json();
        setProjectDoc(docData);
      }
    } catch (err) {
      console.error('Error loading project:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  });

  // Create a new review
  const createReview = async () => {
    if (!newReviewName().trim()) return;

    setCreatingReview(true);
    try {
      // For now, we'll use the Y.Doc WebSocket connection to create reviews
      // This would be done via the UserYjsProvider's updateChecklist method
      // For initial implementation, we can make an HTTP request

      const reviewId = crypto.randomUUID();
      const now = Date.now();

      // TODO: Implement via Yjs update through WebSocket
      // For now, show the concept
      console.log('Creating review:', {
        id: reviewId,
        name: newReviewName().trim(),
        description: newReviewDescription().trim(),
        createdAt: now,
      });

      // Update local state optimistically
      setProjectDoc(prev => ({
        ...prev,
        reviews: [
          ...(prev?.reviews || []),
          {
            id: reviewId,
            name: newReviewName().trim(),
            description: newReviewDescription().trim(),
            createdAt: now,
            updatedAt: now,
            checklists: [],
          },
        ],
      }));

      // Reset form
      setNewReviewName('');
      setNewReviewDescription('');
      setShowReviewForm(false);
    } catch (err) {
      console.error('Error creating review:', err);
      alert('Failed to create review');
    } finally {
      setCreatingReview(false);
    }
  };

  // Create a new checklist in a review
  const createChecklist = async reviewId => {
    if (!newChecklistTitle().trim()) return;

    setCreatingChecklist(true);
    try {
      const checklistId = crypto.randomUUID();
      const now = Date.now();

      console.log('Creating checklist:', {
        id: checklistId,
        reviewId,
        title: newChecklistTitle().trim(),
        assignedTo: newChecklistAssignee() || null,
        status: 'pending',
        createdAt: now,
      });

      // Update local state optimistically
      setProjectDoc(prev => ({
        ...prev,
        reviews: prev?.reviews?.map(review =>
          review.id === reviewId ?
            {
              ...review,
              checklists: [
                ...(review.checklists || []),
                {
                  id: checklistId,
                  title: newChecklistTitle().trim(),
                  assignedTo: newChecklistAssignee() || null,
                  status: 'pending',
                  createdAt: now,
                  updatedAt: now,
                  answers: {},
                },
              ],
            }
          : review,
        ),
      }));

      // Reset form
      setNewChecklistTitle('');
      setNewChecklistAssignee('');
      setShowChecklistForm(null);
    } catch (err) {
      console.error('Error creating checklist:', err);
      alert('Failed to create checklist');
    } finally {
      setCreatingChecklist(false);
    }
  };

  // Open checklist for editing
  const openChecklist = (reviewId, checklistId) => {
    navigate(`/projects/${params.projectId}/reviews/${reviewId}/checklists/${checklistId}`);
  };

  // Get status badge color
  const getStatusColor = status => {
    switch (status) {
      case 'completed':
        return 'bg-green-600';
      case 'in-progress':
        return 'bg-yellow-600';
      default:
        return 'bg-gray-600';
    }
  };

  // Get assignee name
  const getAssigneeName = userId => {
    if (!userId) return 'Unassigned';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  };

  return (
    <div class='p-6 max-w-6xl mx-auto'>
      <Show when={loading()}>
        <div class='flex items-center justify-center py-12'>
          <div class='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400'></div>
          <span class='ml-3 text-gray-400'>Loading project...</span>
        </div>
      </Show>

      <Show when={error()}>
        <div class='bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300'>
          Error: {error()}
        </div>
      </Show>

      <Show when={!loading() && !error() && project()}>
        {/* Project Header */}
        <div class='mb-8'>
          <div class='flex items-center gap-4 mb-2'>
            <button
              onClick={() => navigate('/dashboard')}
              class='text-gray-400 hover:text-white transition-colors'
            >
              <svg class='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M15 19l-7-7 7-7'
                />
              </svg>
            </button>
            <h1 class='text-2xl font-bold text-white'>{project().name}</h1>
            <span class='bg-gray-700 text-gray-300 px-2 py-1 rounded text-sm capitalize'>
              {project().role}
            </span>
          </div>
          <Show when={project().description}>
            <p class='text-gray-400 ml-10'>{project().description}</p>
          </Show>
        </div>

        {/* Reviews Section */}
        <div class='space-y-6'>
          <div class='flex items-center justify-between'>
            <h2 class='text-xl font-semibold text-white'>Reviews</h2>
            <button
              onClick={() => setShowReviewForm(true)}
              class='bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M12 4v16m8-8H4'
                />
              </svg>
              New Review
            </button>
          </div>

          {/* Create Review Form */}
          <Show when={showReviewForm()}>
            <div class='bg-gray-800 border border-gray-700 rounded-lg p-6'>
              <h3 class='text-lg font-semibold text-white mb-4'>Create New Review</h3>
              <div class='space-y-4'>
                <div>
                  <label class='block text-sm font-medium text-gray-300 mb-2'>Review Name</label>
                  <input
                    type='text'
                    placeholder='e.g., Sleep Interventions Systematic Review'
                    value={newReviewName()}
                    onInput={e => setNewReviewName(e.target.value)}
                    class='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500'
                  />
                </div>
                <div>
                  <label class='block text-sm font-medium text-gray-300 mb-2'>
                    Description (Optional)
                  </label>
                  <textarea
                    placeholder='Brief description of this review...'
                    value={newReviewDescription()}
                    onInput={e => setNewReviewDescription(e.target.value)}
                    rows='2'
                    class='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500'
                  />
                </div>
              </div>
              <div class='flex gap-3 mt-4'>
                <button
                  onClick={createReview}
                  disabled={creatingReview() || !newReviewName().trim()}
                  class='bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors'
                >
                  {creatingReview() ? 'Creating...' : 'Create Review'}
                </button>
                <button
                  onClick={() => setShowReviewForm(false)}
                  class='bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors'
                >
                  Cancel
                </button>
              </div>
            </div>
          </Show>

          {/* Reviews List */}
          <Show
            when={projectDoc()?.reviews?.length > 0}
            fallback={
              <div class='text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700'>
                <p class='text-gray-400 mb-4'>No reviews yet</p>
                <button
                  onClick={() => setShowReviewForm(true)}
                  class='text-blue-400 hover:text-blue-300 underline'
                >
                  Create your first review
                </button>
              </div>
            }
          >
            <div class='space-y-4'>
              <For each={projectDoc()?.reviews || []}>
                {review => (
                  <div class='bg-gray-800 border border-gray-700 rounded-lg overflow-hidden'>
                    {/* Review Header */}
                    <div class='p-4 border-b border-gray-700'>
                      <div class='flex items-center justify-between'>
                        <div>
                          <h3 class='text-lg font-semibold text-white'>{review.name}</h3>
                          <Show when={review.description}>
                            <p class='text-gray-400 text-sm mt-1'>{review.description}</p>
                          </Show>
                        </div>
                        <button
                          onClick={() => setShowChecklistForm(review.id)}
                          class='bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 text-sm'
                        >
                          <svg
                            class='w-4 h-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              stroke-linecap='round'
                              stroke-linejoin='round'
                              stroke-width='2'
                              d='M12 4v16m8-8H4'
                            />
                          </svg>
                          Add Checklist
                        </button>
                      </div>
                    </div>

                    {/* Add Checklist Form */}
                    <Show when={showChecklistForm() === review.id}>
                      <div class='p-4 bg-gray-750 border-b border-gray-700'>
                        <h4 class='text-sm font-semibold text-white mb-3'>Add AMSTAR2 Checklist</h4>
                        <div class='grid grid-cols-1 md:grid-cols-2 gap-4'>
                          <div>
                            <label class='block text-xs font-medium text-gray-400 mb-1'>
                              Checklist Title
                            </label>
                            <input
                              type='text'
                              placeholder='e.g., Study 1 - Smith et al. 2023'
                              value={newChecklistTitle()}
                              onInput={e => setNewChecklistTitle(e.target.value)}
                              class='w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500'
                            />
                          </div>
                          <div>
                            <label class='block text-xs font-medium text-gray-400 mb-1'>
                              Assign To
                            </label>
                            <select
                              value={newChecklistAssignee()}
                              onChange={e => setNewChecklistAssignee(e.target.value)}
                              class='w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500'
                            >
                              <option value=''>Unassigned</option>
                              <For each={members()}>
                                {member => (
                                  <option value={member.userId}>
                                    {member.displayName || member.name || member.email}
                                  </option>
                                )}
                              </For>
                            </select>
                          </div>
                        </div>
                        <div class='flex gap-2 mt-3'>
                          <button
                            onClick={() => createChecklist(review.id)}
                            disabled={creatingChecklist() || !newChecklistTitle().trim()}
                            class='bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-sm transition-colors'
                          >
                            {creatingChecklist() ? 'Adding...' : 'Add Checklist'}
                          </button>
                          <button
                            onClick={() => setShowChecklistForm(null)}
                            class='bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-sm transition-colors'
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </Show>

                    {/* Checklists Table */}
                    <Show
                      when={review.checklists?.length > 0}
                      fallback={
                        <div class='p-4 text-center text-gray-500 text-sm'>
                          No checklists in this review yet
                        </div>
                      }
                    >
                      <div class='divide-y divide-gray-700'>
                        <For each={review.checklists}>
                          {checklist => (
                            <div class='p-4 hover:bg-gray-750 transition-colors flex items-center justify-between'>
                              <div class='flex-1'>
                                <div class='flex items-center gap-3'>
                                  <h4 class='text-white font-medium'>{checklist.title}</h4>
                                  <span
                                    class={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(checklist.status)}`}
                                  >
                                    {checklist.status || 'pending'}
                                  </span>
                                </div>
                                <p class='text-gray-400 text-sm mt-1'>
                                  Assigned to: {getAssigneeName(checklist.assignedTo)}
                                </p>
                              </div>
                              <button
                                onClick={() => openChecklist(review.id, checklist.id)}
                                class='bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors'
                              >
                                Open
                              </button>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Members Section */}
        <div class='mt-8'>
          <h2 class='text-xl font-semibold text-white mb-4'>Project Members</h2>
          <div class='bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700'>
            <For each={members()}>
              {member => (
                <div class='p-4 flex items-center justify-between'>
                  <div class='flex items-center gap-3'>
                    <div class='w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium'>
                      {(member.displayName || member.name || member.email || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p class='text-white font-medium'>
                        {member.displayName || member.name || 'Unknown'}
                      </p>
                      <p class='text-gray-400 text-sm'>{member.email}</p>
                    </div>
                  </div>
                  <span class='bg-gray-700 text-gray-300 px-2 py-1 rounded text-sm capitalize'>
                    {member.role}
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
