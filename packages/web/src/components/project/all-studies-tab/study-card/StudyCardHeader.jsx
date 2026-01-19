/**
 * StudyCardHeader - Collapsed header view for a study card
 *
 * Displays:
 * - Expand/collapse toggle (chevron)
 * - Study name (editable)
 * - Citation info (author, year, journal from primary PDF)
 * - Reviewer avatars with hover tooltips
 * - Actions menu
 *
 * Clicking anywhere on the header (except interactive elements) toggles expand/collapse.
 * Uses projectActionsStore directly for mutations.
 */

import { Show, For } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { FiUsers, FiTrash2, FiMoreVertical } from 'solid-icons/fi';
import { SimpleEditable } from '@/components/ui/editable';
import {
  Menu,
  MenuTrigger,
  MenuPositioner,
  MenuContent,
  MenuItem,
  MenuSeparator,
} from '@/components/ui/menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import projectActionsStore from '@/stores/projectActionsStore';
import { API_BASE } from '@config/api.js';

// Avatar color palette for reviewer identification
const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
];

const getAvatarColorClasses = name => {
  const index = name ? name.charCodeAt(0) % AVATAR_COLORS.length : 0;
  return AVATAR_COLORS[index];
};

export default function StudyCardHeader(props) {
  // props.study: Study object with pdfs array
  // props.expanded: boolean
  // props.onToggle: () => void
  // props.onAssignReviewers: () => void - needs to open modal at parent level
  // props.getMember: (userId) => member object (for avatar display)

  const study = () => props.study;

  // Get primary PDF metadata (or first PDF if no primary)
  const primaryPdf = () => {
    const pdfs = study().pdfs || [];
    return pdfs.find(p => p.tag === 'primary') || pdfs[0];
  };

  // Get assigned reviewers as full member objects for avatar display
  const assignedReviewers = () => {
    const reviewers = [];
    if (study().reviewer1) {
      const member = props.getMember?.(study().reviewer1);
      // Use member if found, otherwise create minimal fallback object
      reviewers.push(member || { userId: study().reviewer1 });
    }
    if (study().reviewer2) {
      const member = props.getMember?.(study().reviewer2);
      reviewers.push(member || { userId: study().reviewer2 });
    }
    return reviewers;
  };

  // Get member display name
  const getMemberDisplayName = member => member?.name || member?.email || 'Unknown';

  // Get avatar image source - only return URL if image exists, otherwise undefined for fallback
  const getAvatarSrc = member => {
    if (member?.image) {
      return member.image.startsWith('/') ? `${API_BASE}${member.image}` : member.image;
    }
    return undefined;
  };

  const hasReviewers = () => study().reviewer1 || study().reviewer2;

  // Study name - directly use study.name (editable by user)
  const studyName = () => study().name || 'Untitled Study';

  // Handle study name update - use store directly
  const handleNameChange = newName => {
    if (newName && newName.trim() && newName !== study().name) {
      projectActionsStore.study.update(study().id, { name: newName.trim() });
    }
  };

  // Handle delete - use store directly
  const handleDelete = () => {
    projectActionsStore.study.delete(study().id);
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

  const handleMenuSelect = details => {
    switch (details.value) {
      case 'assign-reviewers':
        props.onAssignReviewers?.();
        break;
      case 'delete':
        handleDelete();
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
      class='flex cursor-pointer items-center gap-3 px-4 py-3 select-none'
      onClick={handleHeaderClick}
    >
      {/* Expand/collapse chevron */}
      <div class='-ml-1 shrink-0 p-1'>
        <BiRegularChevronRight
          class={`text-muted-foreground/70 h-5 w-5 transition-transform duration-200 ${props.expanded ? 'rotate-90' : ''}`}
        />
      </div>

      {/* Study info - editable name */}
      <div class='min-w-0 flex-1'>
        <SimpleEditable
          activationMode='click'
          value={studyName()}
          onSubmit={handleNameChange}
          showEditIcon={true}
          class='text-foreground -ml-2 font-medium'
        />
        <Show when={citationLine()}>
          <p
            class='text-muted-foreground w-fit cursor-text truncate text-xs select-text'
            data-selectable
          >
            {citationLine()}
          </p>
        </Show>
      </div>
      {/* Reviewer avatars with tooltips */}
      <Show when={hasReviewers()}>
        <div class='flex shrink-0 -space-x-1.5' data-selectable>
          <For each={assignedReviewers()}>
            {member => {
              const displayName = getMemberDisplayName(member);
              const colorClasses = getAvatarColorClasses(displayName);
              return (
                <Tooltip openDelay={200}>
                  <TooltipTrigger>
                    <Avatar class='h-7 w-7 border-2 border-white text-xs'>
                      <AvatarImage src={getAvatarSrc(member)} alt={displayName} />
                      <AvatarFallback class={`${colorClasses.bg} ${colorClasses.text}`}>
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipPositioner>
                    <TooltipContent>{displayName}</TooltipContent>
                  </TooltipPositioner>
                </Tooltip>
              );
            }}
          </For>
        </div>
      </Show>
      <Show when={!hasReviewers()}>
        <span class='text-muted-foreground/70 shrink-0 text-xs italic'>No reviewers</span>
      </Show>

      {/* Actions menu */}
      <Menu onSelect={handleMenuSelect} positioning={{ placement: 'bottom-end' }}>
        <MenuTrigger class='text-muted-foreground/70 hover:bg-secondary hover:text-secondary-foreground rounded-md p-1.5 transition-colors'>
          <FiMoreVertical class='h-4 w-4' />
        </MenuTrigger>
        <MenuPositioner>
          <MenuContent>
            <MenuItem value='assign-reviewers'>
              <FiUsers class='h-4 w-4' />
              Assign Reviewers
            </MenuItem>
            <MenuSeparator />
            <MenuItem value='delete' destructive>
              <FiTrash2 class='h-4 w-4' />
              Delete Study
            </MenuItem>
          </MenuContent>
        </MenuPositioner>
      </Menu>
    </div>
  );
}
