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

import { Collapsible } from '@corates/ui';
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

  const study = () => props.study;
  const expanded = () => props.expanded;

  return (
    <div class='rounded-lg border border-gray-200 bg-white shadow-sm transition-colors hover:border-gray-300'>
      <Collapsible
        open={expanded()}
        onOpenChange={open => {
          // Only toggle if the state is actually different
          if (open !== expanded()) {
            props.onToggleExpanded?.();
          }
        }}
        trigger={() => (
          <StudyCardHeader
            study={study()}
            expanded={expanded()}
            onToggle={() => props.onToggleExpanded?.()}
            onAssignReviewers={() => props.onAssignReviewers?.(study())}
            getAssigneeName={props.getAssigneeName}
          />
        )}
      >
        <div class='border-t border-gray-100'>
          <StudyPdfSection
            study={study()}
            onOpenGoogleDrive={props.onOpenGoogleDrive}
            readOnly={props.readOnly}
          />
        </div>
      </Collapsible>
    </div>
  );
}
