import { useState } from 'react';
import { CopyIcon } from 'lucide-react';
import { isCarryOverKey, type ChecklistType } from '@corates/shared/sync';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useWorkspaceProjectId } from '@/project/workspace-data';
import { copyAnswersFrom, joinNames, useQuestionSources } from './useCopySources';

interface QuestionSourcesPopoverProps {
  studyId: string;
  checklistId: string;
  checklistType: ChecklistType;
  questionKey: string;
  /** The question's display number, e.g. "1.2". */
  questionNumber?: string;
  responseLabels: Record<string, string>;
  disabled?: boolean;
}

/**
 * The copy icon beside a signalling question: the reviewer's answers to the
 * same question on their other outcomes, each with its comment and a button
 * to take it. Present on every editable question whenever a sibling
 * appraisal exists, so the feature is discoverable from the first checklist a
 * reviewer fills in, and absent entirely when there is nothing to pull from.
 */
export function QuestionSourcesPopover({
  studyId,
  checklistId,
  checklistType,
  questionKey,
  questionNumber,
  responseLabels,
  disabled,
}: QuestionSourcesPopoverProps) {
  const projectId = useWorkspaceProjectId();
  const { sources } = useQuestionSources(projectId, studyId, checklistId, questionKey);
  const [open, setOpen] = useState(false);
  if (disabled || sources.length === 0) return null;

  const answered = sources.filter(source => source.answer !== null);
  const label = questionNumber ? `${questionNumber}` : 'this question';
  const perOutcome = !isCarryOverKey(checklistType, questionKey);

  const handleUse = (fromChecklistId: string) => {
    copyAnswersFrom(projectId, fromChecklistId, checklistId, {
      keys: [questionKey, `${questionKey}.comment`],
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label={`Your answers to ${label} on other outcomes`}
          title={`Your answers to ${label} on other outcomes`}
          data-testid='question-sources-trigger'
          className={`shrink-0 rounded border px-1.5 py-1 transition-colors ${
            answered.length > 0 ?
              'border-blue-200 text-blue-700 hover:bg-blue-50'
            : 'border-border text-muted-foreground/50 hover:bg-secondary'
          }`}
        >
          <CopyIcon className='size-3.5' />
        </button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-96'>
        <PopoverHeader>
          <PopoverTitle>Your answers to {label} on this study</PopoverTitle>
          {perOutcome && (
            <PopoverDescription>
              This question is assessed per outcome, so the answers are expected to differ.
            </PopoverDescription>
          )}
        </PopoverHeader>

        {answered.length === 0 ?
          <PopoverDescription>
            No answers to {label} on your other outcomes yet:{' '}
            {joinNames(sources.map(source => source.outcomeName))}.
          </PopoverDescription>
        : <ul className='divide-border -mx-2.5 -mb-2.5 divide-y'>
            {sources.map(source => (
              <li
                key={source.checklist.id}
                className='flex flex-col gap-1.5 px-2.5 py-2'
                data-testid='question-source'
              >
                <div className='flex items-center gap-2'>
                  <span className='min-w-0 flex-1 truncate'>{source.outcomeName}</span>
                  {source.answer ?
                    <span
                      className='rounded border border-blue-400 bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800'
                      title={responseLabels[source.answer]}
                    >
                      {source.answer}
                    </span>
                  : <span className='text-muted-foreground/70 text-xs'>Unanswered</span>}
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={source.answer === null}
                    onClick={() => handleUse(source.checklist.id)}
                  >
                    Use this
                  </Button>
                </div>
                {source.comment && (
                  <p className='text-muted-foreground border-border border-l-2 pl-2 text-xs whitespace-pre-wrap'>
                    {source.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        }
      </PopoverContent>
    </Popover>
  );
}
