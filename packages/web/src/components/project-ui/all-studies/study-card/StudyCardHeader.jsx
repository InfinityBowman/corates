/**
 * StudyCardHeader - Collapsed header view for a study card
 *
 * Displays:
 * - Expand/collapse toggle (chevron)
 * - Study name (editable)
 * - Citation info (author, year, journal from primary PDF)
 * - Reviewer badges
 * - Actions menu
 *
 * Clicking anywhere on the header (except interactive elements) toggles expand/collapse.
 */

import { Show, For } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { FiUsers, FiTrash2, FiMoreVertical } from 'solid-icons/fi';
import { Menu, Editable } from '@corates/ui';

export default function StudyCardHeader(props) {
  // props.study: Study object with pdfs array
  // props.expanded: boolean
  // props.onToggle: () => void
  // props.onAssignReviewers: () => void
  // props.onDelete: () => void
  // props.onUpdateStudy: (studyId, updates) => void
  // props.getAssigneeName: (userId) => string

  const study = () => props.study;

  // Get primary PDF metadata (or first PDF if no primary)
  const primaryPdf = () => {
    const pdfs = study().pdfs || [];
    return pdfs.find(p => p.tag === 'primary') || pdfs[0];
  };

  // Get assigned reviewers
  const assignedReviewers = () => {
    const reviewers = [];
    if (study().reviewer1) reviewers.push(props.getAssigneeName(study().reviewer1));
    if (study().reviewer2) reviewers.push(props.getAssigneeName(study().reviewer2));
    return reviewers;
  };

  const hasReviewers = () => study().reviewer1 || study().reviewer2;

  // Study name - directly use study.name (editable by user)
  const studyName = () => study().name || 'Untitled Study';

  // Handle study name update
  const handleNameChange = newName => {
    if (newName && newName.trim() && newName !== study().name) {
      props.onUpdateStudy?.(study().id, { name: newName.trim() });
    }
  };

  // Citation line: author, year, journal from primary PDF
  const citationLine = () => {
    const pdf = primaryPdf();
    const parts = [];
    // Prefer PDF-level metadata
    const author = pdf?.firstAuthor || study().firstAuthor;
    const year = pdf?.publicationYear || study().publicationYear;
    const journal = pdf?.journal || study().journal;
    if (author) parts.push(author);
    if (year) parts.push(`(${year})`);
    if (journal) parts.push(`- ${journal}`);
    return parts.join(' ');
  };

  const menuItems = [
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
      case 'assign-reviewers':
        props.onAssignReviewers?.();
        break;
      case 'delete':
        props.onDelete?.();
        break;
    }
  };

  // Handle header click - toggle unless clicking on interactive elements or selectable text
  const handleHeaderClick = e => {
    // Don't toggle if clicking on interactive elements or selectable text areas
    const target = e.target;
    const interactive = target.closest(
      'button, [role="button"], [role="menuitem"], input, textarea, [data-editable], [data-scope="menu"], [data-scope="editable"], [data-selectable]',
    );
    if (interactive) return;

    props.onToggle?.();
  };

  return (
    <div
      class='flex items-center gap-3 px-4 py-3 cursor-pointer select-none'
      onClick={handleHeaderClick}
    >
      {/* Expand/collapse chevron */}
      <div class='shrink-0 p-1 -ml-1'>
        <BiRegularChevronRight
          class={`w-5 h-5 text-gray-400 transition-transform duration-200 ${props.expanded ? 'rotate-90' : ''}`}
        />
      </div>

      {/* Study info - editable name */}
      <div class='min-w-0 flex-1'>
        <Editable
          activationMode='click'
          value={studyName()}
          onSubmit={handleNameChange}
          showEditIcon={true}
          class='text-gray-900 font-medium'
        />
        <Show when={citationLine()}>
          <p class='text-xs text-gray-500 truncate select-text cursor-text w-fit' data-selectable>
            {citationLine()}
          </p>
        </Show>
      </div>
      {/* Reviewer badges */}
      <Show when={hasReviewers()}>
        <div class='flex flex-wrap gap-1 shrink-0 cursor-default' data-selectable>
          <For each={assignedReviewers()}>
            {name => (
              <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 select-text cursor-text'>
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
