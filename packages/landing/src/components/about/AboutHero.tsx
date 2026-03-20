import { LightbulbIcon, UsersIcon, CodeIcon } from 'lucide-react';

export default function AboutHero() {
  return (
    <section className='relative overflow-hidden'>
      <div className='mx-auto max-w-4xl px-6 py-20 text-center'>
        <div className='mb-8 flex items-center justify-center gap-4'>
          <div className='flex h-14 w-14 -rotate-6 transform items-center justify-center rounded-xl bg-blue-100'>
            <LightbulbIcon className='h-7 w-7 text-blue-600' />
          </div>
          <div className='flex h-16 w-16 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-blue-700 shadow-lg'>
            <UsersIcon className='h-8 w-8 text-white' />
          </div>
          <div className='flex h-14 w-14 rotate-6 transform items-center justify-center rounded-xl bg-blue-100'>
            <CodeIcon className='h-7 w-7 text-blue-600' />
          </div>
        </div>

        <h1 className='mb-6 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl'>
          About <span className='text-blue-600'>CoRATES</span>
        </h1>
        <p className='mx-auto max-w-3xl text-lg leading-relaxed text-gray-600 md:text-xl'>
          Developed by a research synthesis expert and a software engineer and data scientist,
          CoRATES combines methodological expertise with modern software engineering to support
          rigorous evidence appraisal.
        </p>

        <div className='mt-10 flex items-center justify-center gap-2'>
          <div className='h-1 w-12 rounded-full bg-blue-200' />
          <div className='h-3 w-3 rounded-full bg-blue-400' />
          <div className='h-1 w-12 rounded-full bg-blue-200' />
        </div>
      </div>

      <div className='absolute top-0 left-1/2 -z-10 h-200 w-200 -translate-x-1/2 rounded-full bg-linear-to-b from-blue-50/50 to-transparent blur-3xl' />
    </section>
  );
}
