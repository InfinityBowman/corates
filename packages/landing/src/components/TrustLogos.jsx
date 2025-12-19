import { For } from 'solid-js';

export default function TrustLogos() {
  const institutions = [
    { name: 'Saint Louis University', abbr: 'SLU' },
    { name: 'To Be Determined', abbr: 'TBD' },
    { name: 'To Be Determined', abbr: 'TBD' },
    { name: 'To Be Determined', abbr: 'TBD' },
  ];

  return (
    <section class='border-y border-gray-100 bg-gray-50/50'>
      <div class='mx-auto max-w-6xl px-6 py-10'>
        <p class='mb-6 text-center text-sm text-gray-500'>
          Trusted by researchers at leading institutions
        </p>
        <div class='flex flex-wrap items-center justify-center gap-8 md:gap-12'>
          <For each={institutions}>
            {inst => (
              <div class='flex items-center gap-2 text-gray-400 transition-colors hover:text-gray-500'>
                <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-gray-200'>
                  <span class='text-xs font-bold text-gray-500'>{inst.abbr}</span>
                </div>
                <span class='hidden text-sm font-medium sm:inline'>{inst.name}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
