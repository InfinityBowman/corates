/**
 * Grant Dialog component
 * Dialog for creating grants
 */

import { Dialog } from '@corates/ui';

export default function GrantDialog(props) {
  const open = () => props.open;
  const onOpenChange = () => props.onOpenChange;
  const loading = () => props.loading;
  const type = () => props.type;
  const startsAt = () => props.startsAt;
  const expiresAt = () => props.expiresAt;
  const onTypeChange = () => props.onTypeChange;
  const onStartsAtChange = () => props.onStartsAtChange;
  const onExpiresAtChange = () => props.onExpiresAtChange;
  const onSubmit = () => props.onSubmit;

  return (
    <Dialog open={open()} onOpenChange={onOpenChange()} title='Create Grant'>
      <div class='space-y-4'>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>Type</label>
          <select
            value={type()}
            onInput={e => onTypeChange()(e.target.value)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          >
            <option value='trial'>Trial</option>
            <option value='single_project'>Single Project</option>
          </select>
        </div>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>Starts At</label>
          <input
            type='datetime-local'
            value={startsAt()}
            onInput={e => onStartsAtChange()(e.target.value)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>Expires At</label>
          <input
            type='datetime-local'
            value={expiresAt()}
            onInput={e => onExpiresAtChange()(e.target.value)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>
        <div class='flex justify-end space-x-3'>
          <button
            onClick={() => onOpenChange()(false)}
            class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200'
          >
            Cancel
          </button>
          <button
            onClick={onSubmit()}
            disabled={loading()}
            class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
          >
            {loading() ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
