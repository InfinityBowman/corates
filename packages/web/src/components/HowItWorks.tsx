import { ReactNode } from 'react';
import { FolderPlusIcon, FilePlusIcon, PencilIcon, UsersIcon } from 'lucide-react';

interface Step {
  number: number;
  icon: ReactNode;
  title: string;
  description: string;
}

export default function HowItWorks() {
  const steps: Step[] = [
    {
      number: 1,
      icon: <FolderPlusIcon className='size-6' />,
      title: 'Create a Project',
      description: 'Name your review, invite your team, and give everyone the same workspace.',
    },
    {
      number: 2,
      icon: <FilePlusIcon className='size-6' />,
      title: 'Add Studies',
      description:
        'Bring in PDFs by upload, DOI, Google Drive, or reference import, then assign reviewers.',
    },
    {
      number: 3,
      icon: <PencilIcon className='size-6' />,
      title: 'Appraise Independently',
      description: 'Each reviewer works the guided appraisal with the study PDF open beside it.',
    },
    {
      number: 4,
      icon: <UsersIcon className='size-6' />,
      title: 'Resolve Together',
      description:
        'Compare ratings side by side, settle disagreements, and watch scores and figures update.',
    },
  ];

  return (
    <section className='mx-auto max-w-6xl px-6 py-16 md:py-24'>
      <div className='mb-12 text-center'>
        <h2 className='mb-4 text-3xl font-bold text-gray-900 md:text-4xl'>
          Four steps from PDF to finished appraisal
        </h2>
        <p className='text-lg text-gray-600'>
          The process your team already follows, with the file juggling taken out.
        </p>
      </div>

      <div className='grid gap-8 md:grid-cols-4'>
        {steps.map((step, index) => (
          <div key={index} className='relative text-center'>
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className='absolute top-8 left-1/2 hidden h-0.5 w-full bg-gray-200 md:block' />
            )}

            <div className='relative'>
              <div className='mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20'>
                {step.icon}
              </div>
              <div className='absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-blue-700/10 text-sm font-bold text-blue-700 md:hidden'>
                {step.number}
              </div>
            </div>

            <h3 className='mb-2 text-xl font-semibold text-gray-900'>{step.title}</h3>
            <p className='text-gray-600'>{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
