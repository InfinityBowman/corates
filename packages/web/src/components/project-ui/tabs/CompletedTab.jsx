import { AiFillCheckCircle } from 'solid-icons/ai';

export default function CompletedTab() {
  return (
    <div class='text-center py-16'>
      <AiFillCheckCircle class='w-12 h-12 text-gray-300 mx-auto mb-4' />
      <h3 class='text-lg font-medium text-gray-900 mb-2'>Completed</h3>
      <p class='text-gray-500 max-w-md mx-auto'>
        Studies that have completed reconciliation will appear here.
      </p>
    </div>
  );
}
