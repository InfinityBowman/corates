import { Show } from 'solid-js'
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js'
import { isReconciledChecklist } from '@/lib/checklist-domain.js'

/**
 * ReconcileStatusTag - Shows "Waiting for {Reviewer}" or "Ready" status
 *
 * @param {Object} props
 * @param {Object} props.study - The study object with checklists, reviewer1, reviewer2
 * @param {Function} props.getAssigneeName - Function to get reviewer name from ID
 */
export default function ReconcileStatusTag(props) {
  const awaitingReconcileChecklists = () =>
    (props.study.checklists || []).filter(
      (c) =>
        !isReconciledChecklist(c) &&
        c.status === CHECKLIST_STATUS.AWAITING_RECONCILE,
    )

  const isReady = () => awaitingReconcileChecklists().length === 2

  const waitingForReviewer = () => {
    if (isReady()) return null

    const awaiting = awaitingReconcileChecklists()
    if (awaiting.length !== 1) return null

    const awaitingReviewerId = awaiting[0].assignedTo
    // Find the other reviewer
    const waitingReviewerId =
      awaitingReviewerId === props.study.reviewer1
        ? props.study.reviewer2
        : props.study.reviewer1

    return props.getAssigneeName(waitingReviewerId)
  }

  return (
    <Show
      when={isReady()}
      fallback={
        <span class="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">
          Waiting for {waitingForReviewer()}
        </span>
      }
    >
      <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
        Ready
      </span>
    </Show>
  )
}
