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
  // props.getAssigneeName: (userId) => string
  // props.onAssignReviewers: (study) => void - opens modal (needs parent state)
  // props.onOpenGoogleDrive: (studyId) => void - opens picker (needs parent state)
  // props.readOnly: boolean

  return (
    <div class='rounded-lg border border-gray-200 bg-white shadow-sm transition-colors hover:border-gray-300'>
      <Collapsible open={props.expanded}>
        <StudyCardHeader
          study={props.study}
          expanded={props.expanded}
          onToggle={() => props.onToggleExpanded?.()}
          onAssignReviewers={() => props.onAssignReviewers?.(props.study)}
          getAssigneeName={props.getAssigneeName}
        />
        <CollapsibleContent>
          <div class='border-t border-gray-100'>
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
