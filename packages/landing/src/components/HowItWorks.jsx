import { For } from 'solid-js';
import { AiOutlineFolderAdd, AiOutlineFileAdd, AiOutlineTeam } from 'solid-icons/ai';

export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      icon: <AiOutlineFolderAdd class='w-6 h-6' />,
      title: 'Create a Project',
      description: 'Set up a review project and invite your team members to collaborate.',
    },
    {
      number: 2,
      icon: <AiOutlineFileAdd class='w-6 h-6' />,
      title: 'Add Studies',
      description: 'Upload PDFs and create appraisal checklists for each study.',
    },
    {
      number: 3,
      icon: <AiOutlineTeam class='w-6 h-6' />,
      title: 'Appraise Together',
      description:
        'Complete assessments collaboratively with automatic scoring and summaries.',
    },
  ];

  return (
    <section class='max-w-6xl mx-auto px-6 py-16 md:py-24'>
      <div class='text-center mb-12'>
        <h2 class='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
          Simple workflow, powerful results
        </h2>
        <p class='text-lg text-gray-600'>Get started in minutes, not hours.</p>
      </div>

      <div class='grid md:grid-cols-3 gap-8'>
        <For each={steps}>
          {(step, index) => (
            <div class='relative text-center'>
              {/* Connector line */}
              {index() < steps.length - 1 && (
                <div class='hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gray-200' />
              )}

              <div class='relative'>
                <div class='w-16 h-16 bg-blue-700 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-700/20'>
                  {step.icon}
                </div>
                <div class='absolute -top-2 -right-2 w-6 h-6 bg-blue-700/10 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold md:hidden'>
                  {step.number}
                </div>
              </div>

              <h3 class='text-xl font-semibold text-gray-900 mb-2'>{step.title}</h3>
              <p class='text-gray-600'>{step.description}</p>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}
