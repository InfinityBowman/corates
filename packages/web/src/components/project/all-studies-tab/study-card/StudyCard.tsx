/**
 * StudyCard - Expandable study card with header and PDF section
 */

import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { type ProjectMember } from '@/components/project/ProjectContext';
import type { StudyInfo } from '@/stores/projectStore';
import { StudyCardHeader } from './StudyCardHeader';
import { StudyPdfSection } from './StudyPdfSection';

interface StudyCardProps {
  study: StudyInfo;
  expanded: boolean;
  onToggleExpanded: () => void;
  getMember?: (userId: string) => ProjectMember | null;
  onAssignReviewers?: (study: StudyInfo) => void;
  onOpenGoogleDrive?: (studyId: string) => void;
  readOnly?: boolean;
}

export function StudyCard({
  study,
  expanded,
  onToggleExpanded,
  getMember,
  onAssignReviewers,
  onOpenGoogleDrive,
  readOnly,
}: StudyCardProps) {
  return (
    <div className='border-border bg-card hover:border-border rounded-lg border transition-colors'>
      <Collapsible open={expanded} onOpenChange={onToggleExpanded}>
        <StudyCardHeader
          study={study}
          expanded={expanded}
          onToggle={onToggleExpanded}
          onAssignReviewers={() => onAssignReviewers?.(study)}
          getMember={getMember}
        />
        <CollapsibleContent>
          <div className='border-border border-t'>
            <StudyPdfSection
              study={study}
              onOpenGoogleDrive={onOpenGoogleDrive}
              readOnly={readOnly}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
