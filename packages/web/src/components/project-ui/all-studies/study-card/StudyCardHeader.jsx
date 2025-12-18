/**
 * StudyCardHeader - Collapsed header view for a study card
 *
 * Displays:
 * - Expand/collapse toggle (chevron)
 * - Study name (display name or "Author (Year)")
 * - Citation info (author, year, journal)
 * - Reviewer badges
 * - Actions menu
 */

import { Show, For } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { FiSettings, FiUsers, FiTrash2, FiMoreVertical } from 'solid-icons/fi';
import { Menu } from '@corates/ui';

export default function StudyCardHeader(props) {
  // props.study: Study object
  // props.expanded: boolean
  // props.onToggle: () => void
  // props.onEditMetadata: () => void
  // props.onAssignReviewers: () => void
  // props.onDelete: () => void
  // props.getAssigneeName: (userId) => string

  const study = () => props.study;

  // Get assigned reviewers
  const assignedReviewers = () => {
    const reviewers = [];
    if (study().reviewer1) reviewers.push(props.getAssigneeName(study().reviewer1));
    if (study().reviewer2) reviewers.push(props.getAssigneeName(study().reviewer2));
    return reviewers;
  };

  const hasReviewers = () => study().reviewer1 || study().reviewer2;

  // Display name: use study.name or fall back to "Author (Year)"
  const displayName = () => {
    if (study().name) return study().name;
    if (study().firstAuthor && study().publicationYear) {
      return `${study().firstAuthor} (${study().publicationYear})`;
    }
    if (study().firstAuthor) return study().firstAuthor;
    return 'Untitled Study';
  };

  // Citation line: author, year, journal
  const citationLine = () => {
    const parts = [];
    if (study().firstAuthor) parts.push(study().firstAuthor);
    if (study().publicationYear) parts.push(`(${study().publicationYear})`);
    if (study().journal) parts.push(`- ${study().journal}`);
    return parts.join(' ');
  };

  const menuItems = [
    {
      value: 'edit-metadata',
      label: 'Edit Metadata',
      icon: <FiSettings class='w-4 h-4' />,
    },
    {
      value: 'assign-reviewers',
      label: 'Assign Reviewers',
      icon: <FiUsers class='w-4 h-4' />,
    },
    { separator: true },
    {
      value: 'delete',
      label: 'Delete Study',
      icon: <FiTrash2 class='w-4 h-4' />,
      destructive: true,
    },
  ];

  const handleMenuSelect = details => {
    switch (details.value) {
      case 'edit-metadata':
        props.onEditMetadata?.();
        break;
      case 'assign-reviewers':
        props.onAssignReviewers?.();
        break;
      case 'delete':
        props.onDelete?.();
        break;
    }
  };

  return (
    <div class='flex items-center gap-3 px-4 py-3'>
      {/* Clickable area for expand/collapse */}
      <button
        type='button'
        onClick={() => props.onToggle?.()}
        class='flex items-center gap-3 flex-1 min-w-0 text-left'
      >
        {/* Expand/collapse chevron */}
        <BiRegularChevronRight
          class={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${props.expanded ? 'rotate-90' : ''}`}
        />

        {/* Study info */}
        <div class='min-w-0'>
          <p class='text-gray-900 font-medium truncate'>{displayName()}</p>
          <Show when={citationLine()}>
            <p class='text-xs text-gray-500 truncate'>{citationLine()}</p>
          </Show>
        </div>
      </button>

      {/* Reviewer badges */}
      <Show when={hasReviewers()}>
        <div class='flex flex-wrap gap-1 shrink-0'>
          <For each={assignedReviewers()}>
            {name => (
              <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                {name}
              </span>
            )}
          </For>
        </div>
      </Show>
      <Show when={!hasReviewers()}>
        <span class='text-xs text-gray-400 italic shrink-0'>No reviewers</span>
      </Show>

      {/* Actions menu - using Menu component with custom trigger (no indicator) */}
      <Menu
        trigger={<FiMoreVertical class='w-4 h-4' />}
        items={menuItems}
        onSelect={handleMenuSelect}
        placement='bottom-end'
        hideIndicator
      />
    </div>
  );
}
