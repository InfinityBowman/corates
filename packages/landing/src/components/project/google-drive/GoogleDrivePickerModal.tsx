/**
 * GoogleDrivePickerModal - Stub for Google Drive file picker
 * TODO(agent): Migrate Google Drive picker SDK integration
 */

/* eslint-disable no-unused-vars */
interface GoogleDrivePickerModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  studyId?: string | null;
  onImportSuccess?: (file: any, studyId: string) => void;
}

export function GoogleDrivePickerModal({ open }: GoogleDrivePickerModalProps) {
  if (!open) return null;
  return null;
}
