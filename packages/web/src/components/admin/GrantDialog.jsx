/**
 * Grant Dialog component
 * Dialog for creating grants
 */

import { Dialog } from '@corates/ui';

/**
 * Grant Dialog component
 * Dialog for creating grants
 * @param {object} props - Component props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {function(boolean): void} props.onOpenChange - Function to open or close the dialog
 * @param {string} props.type - The type of grant
 * @param {string} props.startsAt - The start date and time of the grant (datetime-local format)
 * @param {string} props.expiresAt - The expiration date and time of the grant (datetime-local format)
 * @param {function(string): void} props.onTypeChange - Function to change the type of grant
 * @param {function(string): void} props.onStartsAtChange - Function to change the start date and time of the grant
 * @param {function(string): void} props.onExpiresAtChange - Function to change the expiration date and time of the grant
 * @param {function(): void} props.onSubmit - Function to submit the grant
 * @param {boolean} props.loading - Whether the grant is being created
 * @returns {JSX.Element} - The GrantDialog component
 */
export default function GrantDialog(props) {
  const open = () => props.open;
  const loading = () => props.loading;
  const type = () => props.type;
  const startsAt = () => props.startsAt;
  const expiresAt = () => props.expiresAt;

  return (
    <Dialog open={open()} onOpenChange={props.onOpenChange} title='Create Grant'>
      <div class='space-y-4'>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>Type</label>
          <select
            value={type()}
            onInput={e => props.onTypeChange?.(e.target.value)}
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
            onInput={e => props.onStartsAtChange?.(e.target.value)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>Expires At</label>
          <input
            type='datetime-local'
            value={expiresAt()}
            onInput={e => props.onExpiresAtChange?.(e.target.value)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>
        <div class='flex justify-end space-x-3'>
          <button
            onClick={() => props.onOpenChange?.(false)}
            class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200'
          >
            Cancel
          </button>
          <button
            onClick={() => props.onSubmit?.()}
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
