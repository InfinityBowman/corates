import { createSignal, createEffect, createMemo, For, Show, onCleanup } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import useProject from '@primitives/useProject.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import ReviewCard from './ReviewCard.jsx';
import ReviewForm from './ReviewForm.jsx';
import AddMemberModal from './AddMemberModal.jsx';

export default function ProjectView() {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useBetterAuth();

  const [error, setError] = createSignal(null);

  // Review form state
  const [showReviewForm, setShowReviewForm] = createSignal(false);
  const [creatingReview, setCreatingReview] = createSignal(false);

  // Checklist form state
  const [showChecklistForm, setShowChecklistForm] = createSignal(null); // reviewId or null
  const [creatingChecklist, setCreatingChecklist] = createSignal(false);

  // Add member modal state
  const [showAddMemberModal, setShowAddMemberModal] = createSignal(false);

  // Use Y.js hook for real-time data (meta, members, reviews all come from here)
  const {
    reviews,
    members,
    meta,
    connected,
    error: yjsError,
    createReview,
    createChecklist,
    connect,
    disconnect,
  } = useProject(params.projectId);

  // Derive current user's role from the members list
  const userRole = createMemo(() => {
    const currentUser = user();
    if (!currentUser) return null;
    const member = members().find(m => m.userId === currentUser.id);
    return member?.role || null;
  });

  // Connect to Y.js on mount
  createEffect(() => {
    if (params.projectId) {
      connect();
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    disconnect();
  });

  // Create a new review via Y.js
  const handleCreateReview = async (name, description, pdfData = null, pdfFileName = null) => {
    setCreatingReview(true);
    try {
      const reviewId = createReview(name, description);

      // If PDF data was provided, store it for the review
      // TODO: Store PDF data in the review's Y.Doc or elsewhere
      if (pdfData && reviewId) {
        // For now, store in sessionStorage for the checklist to pick up
        sessionStorage.setItem(
          `review-${reviewId}-pdf`,
          JSON.stringify({
            fileName: pdfFileName,
            data: Array.from(new Uint8Array(pdfData)),
          }),
        );
      }

      setShowReviewForm(false);
    } catch (err) {
      console.error('Error creating review:', err);
      alert('Failed to create review');
    } finally {
      setCreatingReview(false);
    }
  };

  // Create a new checklist in a review via Y.js
  const handleCreateChecklist = async (reviewId, type, assigneeId) => {
    setCreatingChecklist(true);
    try {
      createChecklist(reviewId, type, assigneeId);
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

  // Get assignee name from members list
  const getAssigneeName = userId => {
    if (!userId) return 'Unassigned';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  };

  // Check if current user is owner
  const isOwner = () => userRole() === 'owner';

  return (
    <div class='min-h-screen bg-blue-50'>
      <div class='p-6 max-w-4xl mx-auto'>
        <Show when={error() || yjsError()}>
          <div class='bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4'>
            Error: {error() || yjsError()}
          </div>
        </Show>

        {/* Project Header */}
        <div class='mb-8'>
          <div class='flex items-center gap-4 mb-2'>
            <button
              onClick={() => navigate('/dashboard')}
              class='text-gray-400 hover:text-gray-700 transition-colors'
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
            <Show when={meta()?.name}>
              <h1 class='text-2xl font-bold text-gray-900'>{meta().name}</h1>
            </Show>
            <Show when={userRole()}>
              <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize'>
                {userRole()}
              </span>
            </Show>
            <Show when={connected()}>
              <span class='flex items-center gap-1 text-green-600 text-sm'>
                <div class='w-2 h-2 bg-green-500 rounded-full' />
                Synced
              </span>
            </Show>
          </div>
          <Show when={meta()?.description}>
            <p class='text-gray-500 ml-10'>{meta().description}</p>
          </Show>
        </div>

        {/* Reviews Section */}
        <div class='space-y-6'>
          <div class='flex items-center justify-between'>
            <h2 class='text-xl font-bold text-gray-900'>Reviews</h2>
            <button
              onClick={() => setShowReviewForm(true)}
              class='inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg gap-2'
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
            <ReviewForm
              onSubmit={handleCreateReview}
              onCancel={() => setShowReviewForm(false)}
              loading={creatingReview()}
            />
          </Show>

          {/* Reviews List */}
          <Show
            when={reviews().length > 0}
            fallback={
              <div class='text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300'>
                <p class='text-gray-500 mb-4'>No reviews yet</p>
                <button
                  onClick={() => setShowReviewForm(true)}
                  class='text-blue-600 hover:text-blue-700 font-medium'
                >
                  Create your first review
                </button>
              </div>
            }
          >
            <div class='space-y-4'>
              <For each={reviews()}>
                {review => (
                  <ReviewCard
                    review={review}
                    members={members()}
                    projectId={params.projectId}
                    showChecklistForm={showChecklistForm() === review.id}
                    onToggleChecklistForm={() =>
                      setShowChecklistForm(prev => (prev === review.id ? null : review.id))
                    }
                    onAddChecklist={(type, assigneeId) =>
                      handleCreateChecklist(review.id, type, assigneeId)
                    }
                    onOpenChecklist={checklistId => openChecklist(review.id, checklistId)}
                    getAssigneeName={getAssigneeName}
                    creatingChecklist={creatingChecklist()}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Members Section */}
        <div class='mt-8'>
          <div class='flex items-center justify-between mb-4'>
            <h2 class='text-xl font-bold text-gray-900'>Project Members</h2>
            <Show when={isOwner()}>
              <button
                onClick={() => setShowAddMemberModal(true)}
                class='inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors gap-1.5'
              >
                <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    stroke-linecap='round'
                    stroke-linejoin='round'
                    stroke-width='2'
                    d='M12 4v16m8-8H4'
                  />
                </svg>
                Add Member
              </button>
            </Show>
          </div>
          <Show when={members().length > 0}>
            <div class='bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200'>
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
                        <p class='text-gray-900 font-medium'>
                          {member.displayName || member.name || 'Unknown'}
                        </p>
                        <p class='text-gray-500 text-sm'>{member.email}</p>
                      </div>
                    </div>
                    <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize'>
                      {member.role}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Add Member Modal */}
        <AddMemberModal
          isOpen={showAddMemberModal()}
          onClose={() => setShowAddMemberModal(false)}
          projectId={params.projectId}
        />
      </div>
    </div>
  );
}
