import { For } from 'solid-js'

export default function Stats() {
  const stats = [
    { value: '500+', label: 'Appraisals Completed' },
    { value: '50+', label: 'Research Teams' },
    { value: '90%', label: 'Time Saved on Scoring' },
    { value: '99%', label: 'Scoring Accuracy' },
  ]

  return (
    <section class="mx-auto max-w-6xl px-6 py-16">
      <div class="grid grid-cols-2 gap-8 md:grid-cols-4">
        <For each={stats}>
          {(stat) => (
            <div class="text-center">
              <div class="mb-1 text-3xl font-bold text-blue-700 md:text-4xl">
                {stat.value}
              </div>
              <div class="text-sm text-gray-600">{stat.label}</div>
            </div>
          )}
        </For>
      </div>
    </section>
  )
}
