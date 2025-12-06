/**
 * ProjectSettings - Project settings section for OverviewTab
 * Allows configuring project-level preferences like study naming conventions
 */

import { For, Show, createSignal } from 'solid-js';
import { FiSettings, FiChevronDown, FiChevronUp, FiCheck, FiRefreshCw } from 'solid-icons/fi';
import { NAMING_CONVENTIONS, getDefaultNamingConvention } from '@/lib/studyNaming.js';

/**
 * @param {Object} props
 * @param {Function} props.meta - Signal getter for project meta
 * @param {Function} props.studies - Signal getter for studies array
 * @param {Function} props.onUpdateSettings - Handler for updating project settings
 * @param {Function} props.onApplyNamingToAll - Handler for applying naming convention to all studies
 * @param {boolean} props.isOwner - Whether current user is project owner
 */
export default function ProjectSettings(props) {
  const [expanded, setExpanded] = createSignal(false);
  const [applying, setApplying] = createSignal(false);

  const currentConvention = () =>
    props.meta()?.studyNamingConvention || getDefaultNamingConvention();

  const handleConventionChange = conventionId => {
    props.onUpdateSettings?.({ studyNamingConvention: conventionId });
  };

  const toggleExpanded = () => {
    setExpanded(prev => !prev);
  };

  const handleApplyToAll = async () => {
    if (!props.onApplyNamingToAll) return;
    setApplying(true);
    try {
      await props.onApplyNamingToAll(currentConvention());
    } finally {
      setApplying(false);
    }
  };

  const studyCount = () => props.studies?.()?.length || 0;

  return (
    <div class='bg-white border border-gray-200 rounded-lg'>
      <button
        type='button'
        onClick={toggleExpanded}
        class='w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors'
      >
        <div class='flex items-center gap-2'>
          <FiSettings class='w-5 h-5 text-gray-500' />
          <span class='font-medium text-gray-900'>Project Settings</span>
        </div>
        <Show when={expanded()} fallback={<FiChevronDown class='w-5 h-5 text-gray-400' />}>
          <FiChevronUp class='w-5 h-5 text-gray-400' />
        </Show>
      </button>

      <Show when={expanded()}>
        <div class='px-4 pb-4 border-t border-gray-100'>
          {/* Study Naming Convention */}
          <div class='mt-4'>
            <label class='block text-sm font-medium text-gray-700 mb-2'>
              Study Naming Convention
            </label>
            <p class='text-xs text-gray-500 mb-3'>
              Choose how new studies should be named when imported via DOI/PMID or reference files.
            </p>

            <Show
              when={props.isOwner}
              fallback={
                <div class='bg-gray-50 rounded-lg p-3'>
                  <p class='text-sm text-gray-600'>
                    Current:{' '}
                    <span class='font-medium'>
                      {NAMING_CONVENTIONS.find(c => c.id === currentConvention())?.label ||
                        'Study Title'}
                    </span>
                  </p>
                  <p class='text-xs text-gray-400 mt-1'>
                    Only project owners can change this setting.
                  </p>
                </div>
              }
            >
              <div class='space-y-2'>
                <For each={NAMING_CONVENTIONS}>
                  {convention => {
                    const isSelected = () => currentConvention() === convention.id;
                    return (
                      <div
                        onClick={() => handleConventionChange(convention.id)}
                        class={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected() ?
                            'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          class={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected() ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}
                        >
                          <Show when={isSelected()}>
                            <FiCheck class='w-3 h-3 text-white' />
                          </Show>
                        </div>
                        <div class='flex-1 min-w-0'>
                          <p class='text-sm font-medium text-gray-900'>{convention.label}</p>
                          <p class='text-xs text-gray-500 mt-0.5'>{convention.description}</p>
                          <p class='text-xs text-gray-400 mt-1 font-mono'>
                            Example: {convention.example}
                          </p>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>

              {/* Apply to all studies button */}
              <Show when={studyCount() > 0}>
                <div class='mt-4 pt-4 border-t border-gray-200'>
                  <button
                    type='button'
                    onClick={handleApplyToAll}
                    disabled={applying()}
                    class='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    <FiRefreshCw class={`w-4 h-4 ${applying() ? 'animate-spin' : ''}`} />
                    {applying() ?
                      'Applying...'
                    : `Apply to all ${studyCount()} ${studyCount() === 1 ? 'study' : 'studies'}`}
                  </button>
                  <p class='text-xs text-gray-500 mt-2'>
                    Rename all existing studies using the selected naming convention.
                  </p>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
