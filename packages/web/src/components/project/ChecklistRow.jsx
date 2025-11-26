/**
 * ChecklistRow component - Displays a single checklist in a review
 */

export default function ChecklistRow(props) {
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

  return (
    <div class='p-4 hover:bg-gray-750 transition-colors flex items-center justify-between'>
      <div class='flex-1'>
        <div class='flex items-center gap-3'>
          <h4 class='text-white font-medium'>{props.checklist.type || 'AMSTAR2'} Checklist</h4>
          <span
            class={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(props.checklist.status)}`}
          >
            {props.checklist.status || 'pending'}
          </span>
        </div>
        <p class='text-gray-400 text-sm mt-1'>
          Assigned to:{' '}
          {props.getAssigneeName ? props.getAssigneeName(props.checklist.assignedTo) : 'Unassigned'}
        </p>
      </div>
      <button
        onClick={() => props.onOpen()}
        class='bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors'
      >
        Open
      </button>
    </div>
  );
}
