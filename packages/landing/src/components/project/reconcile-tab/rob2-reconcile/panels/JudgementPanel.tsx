import { JUDGEMENTS } from '@corates/shared/checklists/rob2';

/**
 * Get badge color for ROB-2 judgement
 */
function getJudgementBadgeStyle(judgement: string | null): string {
  switch (judgement) {
    case JUDGEMENTS.LOW:
    case 'Low':
      return 'bg-green-100 text-green-800 border-green-300';
    case JUDGEMENTS.SOME_CONCERNS:
    case 'Some concerns':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case JUDGEMENTS.HIGH:
    case 'High':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-secondary text-muted-foreground border-border';
  }
}

interface JudgementPanelProps {
  title: string;
  panelType: 'reviewer1' | 'reviewer2' | 'final';
  judgement: string | null;
  ruleId?: string | null;
  isComplete?: boolean;
  showRuleId?: boolean;
}

/**
 * Panel for displaying auto-calculated ROB-2 judgement
 * This is read-only - judgements are computed from signalling questions
 */
export function JudgementPanel({
  title,
  judgement,
  ruleId,
  isComplete,
  showRuleId,
}: JudgementPanelProps) {
  return (
    <div className="p-4">
      {/* Panel Header */}
      <div className="mb-4">
        <h3 className="text-foreground font-semibold">{title}</h3>
      </div>

      {/* Judgement Badge */}
      <div className="flex flex-col items-start gap-3">
        {judgement ? (
          <span
            className={`inline-flex items-center rounded-lg border-2 px-4 py-2 text-sm font-semibold ${getJudgementBadgeStyle(judgement)}`}
          >
            {judgement}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="bg-border h-4 w-4 animate-pulse rounded-full" />
            <span className="text-muted-foreground text-sm italic">
              {isComplete === false ? 'Not yet calculated' : 'Not available'}
            </span>
          </div>
        )}

        {/* Rule ID (for debugging/transparency) */}
        {showRuleId && ruleId && (
          <div className="text-muted-foreground/70 text-xs">Rule: {ruleId}</div>
        )}

        {/* Auto-calculated indicator */}
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <span>Auto-calculated</span>
        </div>
      </div>
    </div>
  );
}
