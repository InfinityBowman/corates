import { HiOutlineDocumentCheck } from 'solid-icons/hi';
import { BiRegularTrash } from 'solid-icons/bi';
import { useNavigate } from '@solidjs/router';

/**
 * Local checklist item
 */
export default function LocalChecklistItem(props) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (props.checklist?.id) {
      navigate(`/checklist/${props.checklist.id}`);
    }
  };

  const formatDate = timestamp => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div
      class={`group flex items-center rounded-lg transition-colors ${props.isSelected ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'} `}
    >
      <button
        onClick={handleClick}
        class='flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left focus:outline-none'
      >
        <HiOutlineDocumentCheck class='h-4 w-4 shrink-0 text-gray-500' />
        <div class='min-w-0 flex-1'>
          <div class='truncate text-sm font-medium'>
            {props.checklist?.name || 'Untitled Checklist'}
          </div>
          <div class='text-2xs mt-0.5 text-gray-500'>
            {formatDate(props.checklist?.updatedAt || props.checklist?.createdAt)}
          </div>
        </div>
      </button>
      <button
        onClick={e => props.onDelete(e, props.checklist?.id)}
        class='mr-1 rounded p-1.5 text-gray-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:ring-2 focus:ring-blue-500 focus:outline-none'
        aria-label='Delete checklist'
      >
        <BiRegularTrash class='h-4 w-4' />
      </button>
    </div>
  );
}
