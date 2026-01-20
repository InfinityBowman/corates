import { Show, createMemo } from 'solid-js';
import { FiArrowLeft, FiEdit2 } from 'solid-icons/fi';
import { useProjectContext } from './ProjectContext.jsx';
import {
  SimpleEditable,
  Editable,
  EditableArea,
  EditableTextarea,
  EditablePreview,
  EditableEditTrigger,
  EditableContext,
} from '@/components/ui/editable';
import { handleError } from '@/lib/error-utils.js';

export default function ProjectHeader(props) {
  const { userRole } = useProjectContext();

  const name = () => (typeof props.name === 'function' ? props.name() : props.name);
  const description = () =>
    typeof props.description === 'function' ? props.description() : props.description;

  const canEdit = createMemo(() => {
    const role = userRole();
    return role === 'owner' || role === 'collaborator';
  });

  const handleNameChange = async newName => {
    if (newName && newName.trim() && newName !== name()) {
      try {
        await props.onRename?.(newName.trim());
      } catch (error) {
        await handleError(error, {
          toastTitle: 'Failed to rename project',
        });
      }
    }
  };

  const handleDescriptionChange = async details => {
    const newDesc = details.value.trim();
    const currentDesc = description() || '';
    if (newDesc !== currentDesc) {
      try {
        await props.onUpdateDescription?.(newDesc);
      } catch (error) {
        await handleError(error, {
          toastTitle: 'Failed to update description',
        });
      }
    }
  };

  return (
    <div class='flex items-center justify-between py-4'>
      <div class='flex items-center gap-4'>
        <button
          onClick={() => props.onBack()}
          class='border-border text-muted-foreground hover:border-border-strong hover:text-secondary-foreground flex h-9 w-9 items-center justify-center rounded-lg border transition-colors'
        >
          <FiArrowLeft class='h-4 w-4' />
        </button>
        <div class='min-w-0'>
          {/* Project Name - SimpleEditable */}
          <div class='flex items-center gap-2'>
            <SimpleEditable
              activationMode='click'
              value={name()}
              onSubmit={handleNameChange}
              showEditIcon={canEdit()}
              readOnly={!canEdit()}
              class='text-foreground text-lg font-semibold'
              variant='heading'
            />
            <Show when={userRole()}>
              <span class='inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize'>
                {userRole()}
              </span>
            </Show>
          </div>

          {/* Project Description - Composable Editable with textarea */}
          <Editable
            defaultValue={description() || ''}
            onValueCommit={handleDescriptionChange}
            activationMode='click'
            submitMode='both'
            autoResize
            disabled={!canEdit()}
            placeholder='Add a project description...'
            class='group mt-0.5 w-full max-w-2xl'
          >
            <div class='flex items-center gap-1'>
              <EditableArea class='hover:bg-muted w-full rounded px-1 py-0.5 transition-colors'>
                <EditableTextarea class='text-muted-foreground min-h-6 w-full text-sm' rows={1} />
                <EditablePreview class='text-muted-foreground cursor-text text-sm' />
              </EditableArea>
              <Show when={canEdit()}>
                <EditableContext>
                  {api => (
                    <Show when={!api().editing}>
                      <EditableEditTrigger class='text-muted-foreground/60 hover:text-muted-foreground self-start rounded p-1 opacity-0 transition-colors group-hover:opacity-100'>
                        <FiEdit2 class='h-3 w-3' />
                      </EditableEditTrigger>
                    </Show>
                  )}
                </EditableContext>
              </Show>
            </div>
          </Editable>
        </div>
      </div>
    </div>
  );
}
