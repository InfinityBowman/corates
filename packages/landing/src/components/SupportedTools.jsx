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
    <section class='mx-auto max-w-6xl px-6 py-16'>
      <div class='mb-10 text-center'>
        <h2 class='mb-4 text-2xl font-bold text-gray-900 md:text-3xl'>Supported Appraisal tools</h2>
        <p class='mx-auto max-w-xl text-gray-600'>
          Start with AMSTAR-2 today. More tools are on the way!
        </p>
      </div>

      <div class='grid grid-cols-2 gap-4 md:grid-cols-3'>
        <For each={tools}>
          {tool => {
            const isAvailable = tool.status === 'available';
            return (
              <div
                class={`rounded-xl border p-5 text-center ${
                  isAvailable ? 'border-blue-700/20 bg-blue-600/10' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <p class={`mb-1 font-semibold ${isAvailable ? 'text-blue-700' : 'text-gray-500'}`}>
                  {tool.name}
                </p>
                <p class='mb-2 text-xs text-gray-500'>{tool.description}</p>
                <span
                  class={`inline-block rounded-full px-2 py-0.5 text-xs ${
                    isAvailable ? 'bg-blue-700 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {isAvailable ? 'Available' : 'Coming Soon'}
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </section>
  );
}
