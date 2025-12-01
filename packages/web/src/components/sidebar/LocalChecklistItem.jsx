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
      class={`
        flex items-center group rounded-lg transition-colors
        ${props.isSelected ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
      `}
    >
      <button
        onClick={handleClick}
        class='flex-1 flex items-center gap-2 px-3 py-2 text-left focus:outline-none min-w-0'
      >
        <HiOutlineDocumentCheck class='w-4 h-4 shrink-0 text-gray-500' />
        <div class='flex-1 min-w-0'>
          <div class='text-sm font-medium truncate'>
            {props.checklist?.name || 'Untitled Checklist'}
          </div>
          <div class='text-2xs text-gray-500 mt-0.5'>
            {formatDate(props.checklist?.updatedAt || props.checklist?.createdAt)}
          </div>
        </div>
      </button>
      <button
        onClick={e => props.onDelete(e, props.checklist?.id)}
        class='p-1.5 mr-1 rounded transition-colors text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100'
        aria-label='Delete checklist'
      >
        <BiRegularTrash class='w-4 h-4' />
      </button>
    </div>
  );
}
