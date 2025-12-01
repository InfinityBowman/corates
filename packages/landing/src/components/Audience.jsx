import { For } from 'solid-js';
import { FaSolidGraduationCap } from 'solid-icons/fa';
import { BiRegularPlusMedical } from 'solid-icons/bi';
import { BsBook } from 'solid-icons/bs';

export default function Audience() {
  const audiences = [
    {
      icon: <FaSolidGraduationCap class='w-6 h-6 text-blue-600' />,
      title: 'Graduate Students',
      description: 'Learning how to appraise study quality',
    },
    {
      icon: <BiRegularPlusMedical class='w-6 h-6 text-blue-600' />,
      title: 'Clinicians & Practitioners',
      description: 'Needing quick, one-off appraisals',
    },
    {
      icon: <BsBook class='w-6 h-6 text-blue-600' />,
      title: 'Faculty & Educators',
      description: 'Teaching appraisal or methodology courses',
    },
  ];

  return (
    <section class='max-w-6xl mx-auto px-6 py-16'>
      <div class='bg-white rounded-2xl border border-gray-200 p-8 md:p-12'>
        <div class='text-center mb-10'>
          <h2 class='text-xl md:text-2xl font-bold text-gray-900 mb-3'>Also great for</h2>
          <p class='text-gray-600 max-w-2xl mx-auto'>
            While CoRATES is designed for research teams appraising studies for evidence reviews,
            its guided checklists and automatic scoring also make it valuable for:
          </p>
        </div>

        <div class='grid md:grid-cols-3 gap-6 mb-10'>
          <For each={audiences}>
            {audience => (
              <div class='text-center p-4'>
                <div class='w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-3'>
                  {audience.icon}
                </div>
                <h3 class='font-semibold text-gray-900 mb-1'>{audience.title}</h3>
                <p class='text-gray-600 text-sm'>{audience.description}</p>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
