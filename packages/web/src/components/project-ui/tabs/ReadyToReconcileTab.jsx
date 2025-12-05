import { CgArrowsExchange } from 'solid-icons/cg';

export default function ReadyToReconcileTab() {
  return (
    <div class='text-center py-16'>
      <CgArrowsExchange class='w-12 h-12 text-gray-300 mx-auto mb-4' />
      <h3 class='text-lg font-medium text-gray-900 mb-2'>Ready to Reconcile</h3>
      <p class='text-gray-500 max-w-md mx-auto'>
        Studies where both reviewers have completed their checklists will appear here, ready for
        reconciliation.
      </p>
    </div>
  );
}
