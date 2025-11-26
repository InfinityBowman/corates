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
    <div class='bg-white border border-gray-200 rounded-lg shadow-sm p-6'>
      <h3 class='text-lg font-semibold text-gray-900 mb-4'>Create New Review</h3>
      <div class='space-y-4'>
        <div>
          <label class='block text-sm font-semibold text-gray-700 mb-2'>Review Name</label>
          <input
            type='text'
            placeholder='e.g., Sleep Interventions Systematic Review'
            value={name()}
            onInput={e => setName(e.target.value)}
            class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
          />
        </div>
        <div>
          <label class='block text-sm font-semibold text-gray-700 mb-2'>
            Description (Optional)
          </label>
          <textarea
            placeholder='Brief description of this review...'
            value={description()}
            onInput={e => setDescription(e.target.value)}
            rows='2'
            class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
          />
        </div>
      </div>
      <div class='flex gap-3 mt-4'>
        <button
          onClick={handleSubmit}
          disabled={props.loading || !name().trim()}
          class='inline-flex items-center px-4 py-2 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-md'
        >
          {props.loading ? 'Creating...' : 'Create Review'}
        </button>
        <button
          onClick={() => props.onCancel()}
          class='px-4 py-2 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:border-blue-300 hover:text-blue-600 transition-colors'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
