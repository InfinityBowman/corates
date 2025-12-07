import { For } from 'solid-js';

export default function Stats() {
  const stats = [
    { value: '500+', label: 'Appraisals Completed' },
    { value: '50+', label: 'Research Teams' },
    { value: '90%', label: 'Time Saved on Scoring' },
    { value: '99%', label: 'Scoring Accuracy' },
  ];

  return (
    <section class='max-w-6xl mx-auto px-6 py-16'>
      <div class='grid grid-cols-2 md:grid-cols-4 gap-8'>
        <For each={stats}>
          {stat => (
            <div class='text-center'>
              <div class='text-3xl md:text-4xl font-bold text-blue-700 mb-1'>{stat.value}</div>
              <div class='text-sm text-gray-600'>{stat.label}</div>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}
