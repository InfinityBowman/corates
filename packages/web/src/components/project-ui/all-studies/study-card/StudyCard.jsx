/**
 * StudyCard - Expandable study card with header and PDF section
 *
 * Combines:
 * - StudyCardHeader (always visible)
 * - StudyPdfSection (visible when expanded)
 */

import { Collapsible } from '@corates/ui';
import StudyCardHeader from './StudyCardHeader.jsx';
import StudyPdfSection from './StudyPdfSection.jsx';

export default function StudyCard(props) {
  // props.study: Study object
  // props.expanded: boolean - controlled expanded state
  // props.onToggleExpanded: () => void - toggle callback
  // props.getAssigneeName: (userId) => string
  // props.onEditMetadata: (study) => void
  // props.onAssignReviewers: (study) => void
  // props.onDeleteStudy: (studyId) => void
  // props.onViewPdf: (studyId, pdf) => void
  // props.onDownloadPdf: (studyId, pdf) => void
  // props.onUploadPdf: (studyId, file) => Promise<void>
  // props.onDeletePdf: (studyId, pdf) => void
  // props.onTagChange: (studyId, pdfId, newTag) => void
  // props.onEditPdfMetadata: (studyId, pdf) => void
  // props.onOpenGoogleDrive: (studyId) => void
  // props.readOnly: boolean

  const study = () => props.study;
  const expanded = () => props.expanded;

  return (
    <div class='bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-colors'>
      <Collapsible
        open={expanded()}
        onOpenChange={open => {
          if (open !== expanded()) {
            props.onToggleExpanded?.();
          }
        }}
        trigger={api => (
          <StudyCardHeader
            study={study()}
            expanded={api.open}
            onToggle={() => props.onToggleExpanded?.()}
            onAssignReviewers={() => props.onAssignReviewers?.(study())}
            onDelete={() => props.onDeleteStudy?.(study().id)}
            getAssigneeName={props.getAssigneeName}
          />
        )}
      >
        <div class='border-t border-gray-100'>
          <StudyPdfSection
            study={study()}
            onViewPdf={props.onViewPdf}
            onDownloadPdf={props.onDownloadPdf}
            onUploadPdf={props.onUploadPdf}
            onDeletePdf={props.onDeletePdf}
            onTagChange={props.onTagChange}
            onEditPdfMetadata={props.onEditPdfMetadata}
            onOpenGoogleDrive={props.onOpenGoogleDrive}
            readOnly={props.readOnly}
          />
        </div>
      </Collapsible>
    </div>
  );
}
