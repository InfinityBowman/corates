import { createSignal, createEffect, createMemo, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import AMSTAR2Checklist from './AMSTAR2Checklist.jsx';
import useProject from '../hooks/useProject.js';

export default function ChecklistYjsWrapper() {
  const params = useParams();
  const navigate = useNavigate();

  const { reviews, connected, connecting, error, updateChecklistAnswer, getChecklistData } =
    useProject(params.projectId);

  // Find the current review and checklist from the Y.js data
  const currentReview = createMemo(() => {
    return reviews().find(r => r.id === params.reviewId);
  });

  const currentChecklist = createMemo(() => {
    const review = currentReview();
    if (!review) return null;
    return review.checklists?.find(c => c.id === params.checklistId);
  });

  // Build the checklist object in the format AMSTAR2Checklist expects
  const checklistForUI = createMemo(() => {
    const checklist = currentChecklist();
    const review = currentReview();
    if (!checklist) return null;

    // The answers are stored in Y.js, merge with checklist metadata
    const data = getChecklistData(params.reviewId, params.checklistId);
    if (!data) return null;

    return {
      id: checklist.id,
      name: review?.name || 'Checklist',
      reviewerName: '',
      createdAt: checklist.createdAt,
      ...data.answers, // Spread the q1, q2, etc. answer data
    };
  });

  // Handle partial updates from AMSTAR2Checklist
  function handlePartialUpdate(patch) {
    // Filter to only update answer keys (q1, q2, etc.)
    Object.entries(patch).forEach(([key, value]) => {
      if (/^q\d+[a-z]*$/i.test(key)) {
        updateChecklistAnswer(params.reviewId, params.checklistId, key, value);
      }
    });
  }

  return (
    <div class='p-4'>
      {/* Header with navigation */}
      <div class='mb-4 flex items-center gap-4'>
        <button
          onClick={() => navigate(`/projects/${params.projectId}`)}
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
        <div class='text-sm text-gray-300'>
          <Show when={currentReview()}>
            <span>{currentReview().name}</span>
            <span class='mx-2'>/</span>
          </Show>
          <span class='text-white'>{currentChecklist()?.type || 'AMSTAR2'} Checklist</span>
        </div>
        <Show when={connected()}>
          <span class='ml-auto flex items-center gap-1 text-green-400 text-sm'>
            <div class='w-2 h-2 bg-green-400 rounded-full'></div>
            Synced
          </span>
        </Show>
        <Show when={connecting()}>
          <span class='ml-auto flex items-center gap-1 text-yellow-400 text-sm'>
            <div class='w-2 h-2 bg-yellow-400 rounded-full animate-pulse'></div>
            Connecting...
          </span>
        </Show>
      </div>

      <Show when={error()}>
        <div class='bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300 mb-4'>
          Error: {error()}
        </div>
      </Show>

      <Show
        when={checklistForUI()}
        fallback={
          <div class='text-center py-12 text-gray-400'>
            <Show when={connecting()} fallback='Checklist not found'>
              Loading checklist...
            </Show>
          </div>
        }
      >
        <AMSTAR2Checklist
          externalChecklist={checklistForUI()}
          onExternalUpdate={handlePartialUpdate}
        />
      </Show>
    </div>
  );
}
