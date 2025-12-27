import { For } from 'solid-js';
import { FaSolidGraduationCap } from 'solid-icons/fa';
import { BiRegularPlusMedical } from 'solid-icons/bi';
import { BsBook } from 'solid-icons/bs';

export default function Audience() {
  const audiences = [
    {
      icon: <FaSolidGraduationCap class='h-6 w-6 text-blue-600' />,
      title: 'Graduate Students',
      description: 'Learning how to appraise study quality',
    },
    {
      icon: <BiRegularPlusMedical class='h-6 w-6 text-blue-600' />,
      title: 'Clinicians & Practitioners',
      description: 'Needing quick, one-off appraisals',
    },
    {
      icon: <BsBook class='h-6 w-6 text-blue-600' />,
      title: 'Faculty & Educators',
      description: 'Teaching appraisal or methodology courses',
    },
  ];

  return (
    <section class='mx-auto max-w-6xl px-6 py-16'>
      <div class='rounded-2xl border border-gray-200 bg-white p-8 md:p-12'>
        <div class='mb-10 text-center'>
          <h2 class='mb-3 text-xl font-bold text-gray-900 md:text-2xl'>Also great for</h2>
          <p class='mx-auto max-w-2xl text-gray-600'>
            While CoRATES is designed for research teams appraising studies for evidence reviews,
            its guided checklists and automatic scoring also make it valuable for:
          </p>
        </div>

        <div class='mb-10 grid gap-6 md:grid-cols-3'>
          <For each={audiences}>
            {audience => (
              <div class='p-4 text-center'>
                <div class='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50'>
                  {audience.icon}
                </div>
                <h3 class='mb-1 font-semibold text-gray-900'>{audience.title}</h3>
                <p class='text-sm text-gray-600'>{audience.description}</p>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
