import { Show, createMemo } from 'solid-js';
import { FaSolidCircleInfo } from 'solid-icons/fa';
import { Tooltip } from '@corates/ui';
import { getChecklistMetadata, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';

/**
 * Get the style classes for a score based on checklist type
 * @param {string} score - The score value
 * @param {string} checklistType - The checklist type
 * @returns {string} Tailwind classes for styling
 */
function getScoreStyle(score, checklistType) {
  const metadata = getChecklistMetadata(checklistType);
  const colorConfig = metadata.scoreColors?.[score];

  if (colorConfig) {
    return `${colorConfig.bg} ${colorConfig.text}`;
  }

  // Fallback for unknown scores
  return 'bg-gray-100 text-gray-600';
}

/**
 * Get the info URL for a checklist type
 * @param {string} checklistType - The checklist type
 * @returns {string} URL to the checklist guidance
 */
function getInfoUrl(checklistType) {
  const metadata = getChecklistMetadata(checklistType);
  return metadata.url;
}

/**
 * Get the tooltip content for the info button
 * @param {string} checklistType - The checklist type
 * @returns {string} Tooltip content
 */
function getTooltipContent(checklistType) {
  const metadata = getChecklistMetadata(checklistType);
  return `See ${metadata.shortName || metadata.name} resources`;
}

/**
 * ScoreTag - Displays the current score for a checklist with type-aware styling
 *
 * @param {Object} props
 * @param {string} props.currentScore - The current score value
 * @param {string} [props.checklistType] - The checklist type (defaults to AMSTAR2)
 */
export default function ScoreTag(props) {
  const checklistType = () => props.checklistType || DEFAULT_CHECKLIST_TYPE;

  const styleClass = createMemo(() => getScoreStyle(props.currentScore, checklistType()));
  const infoUrl = createMemo(() => getInfoUrl(checklistType()));
  const tooltipContent = createMemo(() => getTooltipContent(checklistType()));

  return (
    <Show when={props.currentScore}>
      <span
        class={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${styleClass()}`}
      >
        <span>Score: {props.currentScore}</span>
        <Tooltip content={tooltipContent()} placement='bottom' openDelay={200}>
          <a
            href={infoUrl()}
            target='_blank'
            rel='noreferrer'
            class='mt-0.5 inline-flex items-center justify-center rounded-full p-0.5 opacity-70 hover:opacity-100 focus:opacity-100 focus:ring-2 focus:ring-blue-500 focus:outline-none'
            aria-label={`Open ${getChecklistMetadata(checklistType()).name} guidance in a new tab`}
          >
            <FaSolidCircleInfo size={12} />
          </a>
        </Tooltip>
      </span>
    </Show>
  );
}
