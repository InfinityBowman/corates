import { createStore } from 'solid-js/store';
import { ROBINSIChecklist } from '@/components/checklist-ui/ROBINSIChecklist';
import { createChecklist, scoreChecklist } from '@/ROBINS-I/checklist.js';

/**
 * Demo page for the ROBINS-I V2 Checklist
 */
export default function ROBINSIDemo() {
  // Create a demo checklist with initial state
  const [checklist, setChecklist] = createStore(
    createChecklist({
      name: 'Demo Study Assessment',
      id: 'robins-demo-1',
      reviewerName: 'Demo Reviewer',
    }),
  );

  // Handler to update nested checklist state
  function handleUpdate(key, value) {
    setChecklist(key, value);
  }

  // Get current score
  const currentScore = () => scoreChecklist(checklist);

  return (
    <div class='min-h-screen bg-gray-100'>
      {/* Header */}
      <div class='bg-white shadow-sm border-b border-gray-200'>
        <div class='max-w-5xl mx-auto px-4 py-4'>
          <div class='flex items-center justify-between'>
            <div>
              <h1 class='text-2xl font-bold text-gray-900'>ROBINS-I V2 Checklist Demo</h1>
              <p class='text-sm text-gray-500 mt-1'>
                Risk Of Bias In Non-randomized Studies - of Interventions
              </p>
            </div>
            <div class='text-right'>
              <div class='text-sm text-gray-500'>Current Score</div>
              <div
                class={`text-lg font-semibold ${
                  currentScore() === 'Low' ? 'text-green-600'
                  : currentScore() === 'Moderate' ? 'text-yellow-600'
                  : currentScore() === 'Serious' ? 'text-orange-600'
                  : currentScore() === 'Critical' ? 'text-red-600'
                  : 'text-gray-500'
                }`}
              >
                {currentScore()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div class='max-w-5xl mx-auto px-4 py-6'>
        <ROBINSIChecklist
          checklistState={checklist}
          onUpdate={handleUpdate}
          showComments={true}
          showLegend={true}
        />

        {/* Debug panel */}
        <details class='mt-8 bg-white rounded-lg shadow-md'>
          <summary class='px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50'>
            Debug: View Checklist State (JSON)
          </summary>
          <pre class='px-4 py-3 text-xs bg-gray-900 text-green-400 overflow-auto max-h-96 rounded-b-lg'>
            {JSON.stringify(checklist, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
