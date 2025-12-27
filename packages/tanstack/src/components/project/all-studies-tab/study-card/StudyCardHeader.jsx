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
 * Uses projectActionsStore directly for mutations.
 */

import { Show, For } from 'solid-js'
import { BiRegularChevronRight } from 'solid-icons/bi'
import { FiUsers, FiTrash2, FiMoreVertical } from 'solid-icons/fi'
import { Menu, Editable } from '@corates/ui'
import projectActionsStore from '@/stores/projectActionsStore'

export default function StudyCardHeader(props) {
  // props.study: Study object with pdfs array
  // props.expanded: boolean
  // props.onToggle: () => void
  // props.onAssignReviewers: () => void - needs to open modal at parent level
  // props.getAssigneeName: (userId) => string

  const study = () => props.study

  // Get primary PDF metadata (or first PDF if no primary)
  const primaryPdf = () => {
    const pdfs = study().pdfs || []
    return pdfs.find((p) => p.tag === 'primary') || pdfs[0]
  }

  // Get assigned reviewers
  const assignedReviewers = () => {
    const reviewers = []
    if (study().reviewer1)
      reviewers.push(props.getAssigneeName(study().reviewer1))
    if (study().reviewer2)
      reviewers.push(props.getAssigneeName(study().reviewer2))
    return reviewers
  }

  const hasReviewers = () => study().reviewer1 || study().reviewer2

  // Study name - directly use study.name (editable by user)
  const studyName = () => study().name || 'Untitled Study'

  // Handle study name update - use store directly
  const handleNameChange = (newName) => {
    if (newName && newName.trim() && newName !== study().name) {
      projectActionsStore.study.update(study().id, { name: newName.trim() })
    }
  }

  // Handle delete - use store directly
  const handleDelete = () => {
    projectActionsStore.study.delete(study().id)
  }

  // Citation line: author, year, journal from primary PDF
  const citationLine = () => {
    const pdf = primaryPdf()
    const parts = []
    // Prefer PDF-level metadata
    const author = pdf?.firstAuthor || study().firstAuthor
    const year = pdf?.publicationYear || study().publicationYear
    const journal = pdf?.journal || study().journal
    if (author) parts.push(author)
    if (year) parts.push(`(${year})`)
    if (journal) parts.push(`- ${journal}`)
    return parts.join(' ')
  }

  const menuItems = [
    {
      value: 'assign-reviewers',
      label: 'Assign Reviewers',
      icon: <FiUsers class="h-4 w-4" />,
    },
    { separator: true },
    {
      value: 'delete',
      label: 'Delete Study',
      icon: <FiTrash2 class="h-4 w-4" />,
      destructive: true,
    },
  ]

  const handleMenuSelect = (details) => {
    switch (details.value) {
      case 'assign-reviewers':
        props.onAssignReviewers?.()
        break
      case 'delete':
        handleDelete()
        break
    }
  }

  // Handle header click - toggle unless clicking on interactive elements or selectable text
  const handleHeaderClick = (e) => {
    // Don't toggle if clicking on interactive elements or selectable text areas
    const target = e.target
    const interactive = target.closest(
      'button, [role="button"], [role="menuitem"], input, textarea, [data-editable], [data-scope="menu"], [data-scope="editable"], [data-selectable]',
    )
    if (interactive) return

    props.onToggle?.()
  }

  return (
    <div
      class="flex cursor-pointer items-center gap-3 px-4 py-3 select-none"
      onClick={handleHeaderClick}
    >
      {/* Expand/collapse chevron */}
      <div class="-ml-1 shrink-0 p-1">
        <BiRegularChevronRight
          class={`h-5 w-5 text-gray-400 transition-transform duration-200 ${props.expanded ? 'rotate-90' : ''}`}
        />
      </div>

      {/* Study info - editable name */}
      <div class="min-w-0 flex-1">
        <Editable
          activationMode="click"
          value={studyName()}
          onSubmit={handleNameChange}
          showEditIcon={true}
          class="-ml-2 font-medium text-gray-900"
        />
        <Show when={citationLine()}>
          <p
            class="w-fit cursor-text truncate text-xs text-gray-500 select-text"
            data-selectable
          >
            {citationLine()}
          </p>
        </Show>
      </div>
      {/* Reviewer badges */}
      <Show when={hasReviewers()}>
        <div
          class="flex shrink-0 cursor-default flex-wrap gap-1"
          data-selectable
        >
          <For each={assignedReviewers()}>
            {(name) => (
              <span class="inline-flex cursor-text items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 select-text">
                {name}
              </span>
            )}
          </For>
        </div>
      </Show>
      <Show when={!hasReviewers()}>
        <span class="shrink-0 text-xs text-gray-400 italic">No reviewers</span>
      </Show>

      {/* Actions menu - using Menu component with custom trigger (no indicator) */}
      <Menu
        trigger={<FiMoreVertical class="h-4 w-4" />}
        items={menuItems}
        onSelect={handleMenuSelect}
        placement="bottom-end"
        hideIndicator
      />
    </div>
  )
}
