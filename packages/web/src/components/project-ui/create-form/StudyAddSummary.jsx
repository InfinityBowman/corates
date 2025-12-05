import { Show } from 'solid-js';

/**
 * Summary display for studies to be added during project creation
 * @param {Object} props
 * @param {Function} props.pdfCount - Getter for number of PDFs to add
 * @param {Function} props.refCount - Getter for number of file-imported refs
 * @param {Function} props.lookupCount - Getter for number of DOI/PMID refs
 */
export default function StudyAddSummary(props) {
  const totalCount = () => props.pdfCount() + props.refCount() + props.lookupCount();

  const sourceCounts = () => [props.pdfCount(), props.refCount(), props.lookupCount()];
  const hasMultipleSources = () => sourceCounts().filter(n => n > 0).length > 1;

  const breakdown = () =>
    [
      props.pdfCount() > 0 && `${props.pdfCount()} from PDFs`,
      props.refCount() > 0 && `${props.refCount()} from file import`,
      props.lookupCount() > 0 && `${props.lookupCount()} from DOI/PMID`,
    ]
      .filter(Boolean)
      .join(', ');

  return (
    <Show when={totalCount() > 0}>
      <div class='bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700'>
        <span class='font-medium'>{totalCount()}</span> {totalCount() === 1 ? 'study' : 'studies'}{' '}
        will be added to this project
        <Show when={hasMultipleSources()}>
          <span class='text-blue-500'> ({breakdown()})</span>
        </Show>
      </div>
    </Show>
  );
}
