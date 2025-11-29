import { For } from 'solid-js';

export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: 'Create a Project',
      description:
        'Set up a project for your systematic review and invite team members to collaborate.',
    },
    {
      number: 2,
      title: 'Add Studies',
      description: 'Upload PDFs and create checklists for each study you need to assess.',
    },
    {
      number: 3,
      title: 'Assess Together',
      description: 'Complete appraisals collaboratively with real-time updates and PDF annotation.',
    },
  ];

  return (
    <section class='bg-gray-50 border-y border-gray-100'>
      <div class='max-w-6xl mx-auto px-6 py-16'>
        <h2 class='text-2xl md:text-3xl font-bold text-gray-900 mb-12 text-center'>
          Simple workflow, powerful results
        </h2>

        <div class='grid md:grid-cols-3 gap-8'>
          <For each={steps}>
            {step => (
              <div class='text-center'>
                <div class='w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4 hover:scale-110 transition-transform'>
                  {step.number}
                </div>
                <h3 class='font-semibold text-gray-900 mb-2'>{step.title}</h3>
                <p class='text-gray-600 text-sm'>{step.description}</p>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
