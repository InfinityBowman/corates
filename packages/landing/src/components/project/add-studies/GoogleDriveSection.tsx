/**
 * GoogleDriveSection - Google Drive file picker for AddStudiesForm
 * Allows selecting multiple PDFs from Google Drive to create studies.
 * Selected files shown in unified StagedStudiesSection.
 */

import { useCallback } from 'react';
import { GoogleDrivePickerLauncher } from '../google-drive/GoogleDrivePickerLauncher';

interface GoogleDriveSectionProps {
  studies: any;
  formType?: 'createProject' | 'addStudies';
  projectId?: string;
  onSaveFormState?: () => Promise<void>;
}

export function GoogleDriveSection({
  studies,
  formType,
  projectId,
  onSaveFormState,
}: GoogleDriveSectionProps) {
  const handlePick = useCallback(
    (picked: Array<{ id: string; name: string }>) => {
      for (const file of picked) {
        const alreadySelected = studies.selectedDriveFiles.some((f: any) => f.id === file.id);
        if (!alreadySelected) {
          studies.toggleDriveFile({ id: file.id, name: file.name });
        }
      }
    },
    [studies],
  );

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-muted-foreground text-sm'>
        Import PDFs from your Google Drive. Each selected file will create a new study.
      </p>

      <GoogleDrivePickerLauncher
        active={true}
        multiselect={true}
        formType={formType}
        projectId={projectId}
        onSaveFormState={onSaveFormState}
        onPick={handlePick}
      />
    </div>
  );
}
