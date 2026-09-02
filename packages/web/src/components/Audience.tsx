import { ReactNode } from 'react';
import { GraduationCapIcon, CrossIcon, BookIcon } from 'lucide-react';

interface AudienceItem {
  icon: ReactNode;
  title: string;
  description: string;
}

export default function Audience() {
  const audiences: AudienceItem[] = [
    {
      icon: <GraduationCapIcon className='size-6 text-blue-600' />,
      title: 'Graduate Students',
      description: 'Learn an instrument by working a real study, with the scoring handled for you',
    },
    {
      icon: <CrossIcon className='size-6 text-blue-600' />,
      title: 'Clinicians & Practitioners',
      description: 'Appraise a single study before you act on it, without setting up a project',
    },
    {
      icon: <BookIcon className='size-6 text-blue-600' />,
      title: 'Faculty & Educators',
      description: 'Set structured appraisal exercises on published studies for a methods course',
    },
  ];

  return (
    <section className='mx-auto max-w-6xl px-6 py-16'>
      <div className='rounded-2xl border border-gray-200 bg-white p-8 md:p-12'>
        <div className='mb-10 text-center'>
          <h2 className='mb-3 text-xl font-bold text-gray-900 md:text-2xl'>
            Not running a full review?
          </h2>
          <p className='mx-auto max-w-2xl text-gray-600'>
            CoRATES is built for evidence synthesis teams, but the guided checklists and automatic
            scoring stand on their own for a single study.
          </p>
        </div>

        <div className='mb-10 grid gap-6 md:grid-cols-3'>
          {audiences.map((audience, index) => (
            <div key={index} className='p-4 text-center'>
              <div className='mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-blue-50'>
                {audience.icon}
              </div>
              <h3 className='mb-1 font-semibold text-gray-900'>{audience.title}</h3>
              <p className='text-sm text-gray-600'>{audience.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
