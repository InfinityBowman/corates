/**
 * StudyCard - Expandable study card with header and PDF section
 *
 * Combines:
 * - StudyCardHeader (always visible, clickable to toggle)
 * - StudyPdfSection (visible when expanded)
 *
 * Uses projectActionsStore internally for all mutations.
 * Only needs study data and minimal control props.
 */

import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import StudyCardHeader from './StudyCardHeader.jsx';
import StudyPdfSection from './StudyPdfSection.jsx';

export default function StudyCard(props) {
  // props.study: Study object
  // props.expanded: boolean - controlled expanded state
  // props.onToggleExpanded: () => void - toggle callback
  // props.getMember: (userId) => member object (for avatar display)
  // props.onAssignReviewers: (study) => void - opens modal (needs parent state)
  // props.onOpenGoogleDrive: (studyId) => void - opens picker (needs parent state)
  // props.readOnly: boolean

  return (
    <div class='border-border bg-card hover:border-border-strong rounded-lg border transition-colors'>
      <Collapsible open={props.expanded}>
        <StudyCardHeader
          study={props.study}
          expanded={props.expanded}
          onToggle={() => props.onToggleExpanded?.()}
          onAssignReviewers={() => props.onAssignReviewers?.(props.study)}
          getMember={props.getMember}
        />
        <CollapsibleContent>
          <div class='border-border-subtle border-t'>
            <StudyPdfSection
              study={props.study}
              onOpenGoogleDrive={props.onOpenGoogleDrive}
              readOnly={props.readOnly}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
