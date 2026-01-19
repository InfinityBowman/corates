/**
 * GoogleDriveSection - Google Drive file picker for AddStudiesForm (Google Picker)
 * Allows selecting multiple PDFs from Google Drive to create studies
 * Selected files shown in unified StagedStudiesSection
 */

import GoogleDrivePickerLauncher from '../google-drive/GoogleDrivePickerLauncher.jsx';

export default function GoogleDriveSection(props) {
  const studies = () => props.studies;
  const onSaveFormState = () => props.onSaveFormState;

  const isFileSelected = fileId => {
    return studies()
      .selectedDriveFiles()
      .some(f => f.id === fileId);
  };

  return (
    <div class='space-y-3'>
      <p class='text-muted-foreground text-sm'>
        Import PDFs from your Google Drive. Each selected file will create a new study.
      </p>

      <GoogleDrivePickerLauncher
        active={true}
        multiselect={true}
        formType={props.formType}
        projectId={props.projectId}
        onSaveFormState={onSaveFormState()}
        onPick={picked => {
          for (const file of picked) {
            if (!isFileSelected(file.id)) {
              studies().toggleDriveFile({ id: file.id, name: file.name });
            }
          }
        }}
      />
    </div>
  );
}
