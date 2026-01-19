import { Show, createMemo } from 'solid-js';
import { FaSolidCircleInfo } from 'solid-icons/fa';
import {
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
} from '@/components/ui/tooltip';
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
  return 'bg-secondary text-muted-foreground';
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
 * @param {boolean} [props.showRatingOnly] - Whether to only show the rating text and info icon
 */
export default function ScoreTag(props) {
  const showRatingOnly = () => props.showRatingOnly ?? false;
  const checklistType = () => props.checklistType || DEFAULT_CHECKLIST_TYPE;

  const styleClass = createMemo(() => getScoreStyle(props.currentScore, checklistType()));
  return (
    <Show when={props.currentScore}>
      <span
        class={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${styleClass()}`}
      >
        <Show when={!showRatingOnly()} fallback={<span>{props.currentScore}</span>}>
          <span>Rating: {props.currentScore}</span>
          <ScoreTooltip checklistType={checklistType()} />
        </Show>
      </span>
    </Show>
  );
}

export function ScoreTooltip(props) {
  const infoUrl = createMemo(() => getInfoUrl(props.checklistType));
  const tooltipContent = createMemo(() => getTooltipContent(props.checklistType));

  return (
    <Tooltip openDelay={200} positioning={{ placement: 'bottom' }}>
      <TooltipTrigger>
        <a
          href={infoUrl()}
          target='_blank'
          rel='noreferrer noopener'
          class='focus:ring-primary mt-0.5 inline-flex items-center justify-center rounded-full p-0.5 opacity-70 hover:opacity-100 focus:opacity-100 focus:ring-2 focus:outline-none'
          aria-label={`Open ${getChecklistMetadata(props.checklistType).name} guidance in a new tab`}
        >
          <FaSolidCircleInfo size={12} />
        </a>
      </TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent>{tooltipContent()}</TooltipContent>
      </TooltipPositioner>
    </Tooltip>
  );
}
