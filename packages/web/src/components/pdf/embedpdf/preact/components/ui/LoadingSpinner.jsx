/**
 * LoadingSpinner - Loading indicator with optional message
 */

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div class='flex items-center gap-2 text-gray-500'>
      <div class='h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600' />
      <span class='text-sm'>{message}</span>
    </div>
  );
}
