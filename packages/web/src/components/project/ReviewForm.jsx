/**
 * ReviewForm component - Form to create a new review
 */

import { createSignal } from 'solid-js';

export default function ReviewForm(props) {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');

  const handleSubmit = () => {
    if (!name().trim()) return;
    props.onSubmit(name().trim(), description().trim());
    setName('');
    setDescription('');
  };

  return (
    <div class='bg-gray-800 border border-gray-700 rounded-lg p-6'>
      <h3 class='text-lg font-semibold text-white mb-4'>Create New Review</h3>
      <div class='space-y-4'>
        <div>
          <label class='block text-sm font-medium text-gray-300 mb-2'>Review Name</label>
          <input
            type='text'
            placeholder='e.g., Sleep Interventions Systematic Review'
            value={name()}
            onInput={e => setName(e.target.value)}
            class='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500'
          />
        </div>
        <div>
          <label class='block text-sm font-medium text-gray-300 mb-2'>Description (Optional)</label>
          <textarea
            placeholder='Brief description of this review...'
            value={description()}
            onInput={e => setDescription(e.target.value)}
            rows='2'
            class='w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500'
          />
        </div>
      </div>
      <div class='flex gap-3 mt-4'>
        <button
          onClick={handleSubmit}
          disabled={props.loading || !name().trim()}
          class='bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors'
        >
          {props.loading ? 'Creating...' : 'Create Review'}
        </button>
        <button
          onClick={() => props.onCancel()}
          class='bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
