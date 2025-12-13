import { For } from 'solid-js';

export default function SupportedTools() {
  const tools = [
    {
      name: 'AMSTAR-2',
      status: 'available',
      description: 'Systematic reviews of interventions',
    },
    { name: 'Cochrane RoB 2', status: 'coming', description: 'Randomized trials' },
    { name: 'ROBINS-I', status: 'coming', description: 'Non-randomized studies' },
    // { name: 'GRADE', status: 'coming', description: 'Certainty of evidence' },
  ];

  return (
    <section class='max-w-6xl mx-auto px-6 py-16'>
      <div class='text-center mb-10'>
        <h2 class='text-2xl md:text-3xl font-bold text-gray-900 mb-4'>Supported Appraisal tools</h2>
        <p class='text-gray-600 max-w-xl mx-auto'>
          Start with AMSTAR-2 today. More tools coming soon based on researcher demand.
        </p>
      </div>

      <div class='grid grid-cols-2 md:grid-cols-3 gap-4'>
        <For each={tools}>
          {tool => (
            <div
              class={`rounded-xl p-5 text-center border ${
                tool.status === 'available' ?
                  'bg-blue-600/10 border-blue-700/20'
                : 'bg-gray-50 border-gray-200'
              }`}
            >
              <p
                class={`font-semibold mb-1 ${
                  tool.status === 'available' ? 'text-blue-700' : 'text-gray-500'
                }`}
              >
                {tool.name}
              </p>
              <p class='text-xs text-gray-500 mb-2'>{tool.description}</p>
              {tool.status === 'available' ?
                <span class='inline-block text-xs bg-blue-700 text-white px-2 py-0.5 rounded-full'>
                  Available
                </span>
              : <span class='inline-block text-xs bg-gray-300 text-gray-600 px-2 py-0.5 rounded-full'>
                  Coming Soon
                </span>
              }
            </div>
          )}
        </For>
      </div>
    </section>
  );
}
