/**
 * StudyCard - Expandable study card with header and PDF section
 */

import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { type ProjectMember } from '@/components/project/ProjectContext';
import { StudyCardHeader } from './StudyCardHeader';
import { StudyPdfSection } from './StudyPdfSection';

/* eslint-disable no-unused-vars */
interface StudyCardProps {
  study: any;
  expanded: boolean;
  onToggleExpanded: () => void;
  getMember?: (userId: string) => ProjectMember | null;
  onAssignReviewers?: (study: any) => void;
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
    <div className="border-border bg-card rounded-lg border transition-colors hover:border-border">
      <Collapsible open={expanded} onOpenChange={onToggleExpanded}>
        <StudyCardHeader
          study={study}
          expanded={expanded}
          onToggle={onToggleExpanded}
          onAssignReviewers={() => onAssignReviewers?.(study)}
          getMember={getMember}
        />
        <CollapsibleContent>
          <div className="border-border border-t">
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
