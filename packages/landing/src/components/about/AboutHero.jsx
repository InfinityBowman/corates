import { BsLightbulb } from 'solid-icons/bs';
import { FiUsers, FiCode } from 'solid-icons/fi';

export default function AboutHero() {
  return (
    <section class='relative overflow-hidden'>
      <div class='mx-auto max-w-4xl px-6 py-20 text-center md:py-28'>
        {/* Icon cluster */}
        <div class='mb-8 flex items-center justify-center gap-4'>
          <div class='flex h-14 w-14 -rotate-6 transform items-center justify-center rounded-xl bg-blue-100'>
            <BsLightbulb class='h-7 w-7 text-blue-600' />
          </div>
          <div class='flex h-16 w-16 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-blue-700 shadow-lg'>
            <FiUsers class='h-8 w-8 text-white' />
          </div>
          <div class='flex h-14 w-14 rotate-6 transform items-center justify-center rounded-xl bg-blue-100'>
            <FiCode class='h-7 w-7 text-blue-600' />
          </div>
        </div>

        <h1 class='mb-6 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl'>
          About <span class='text-blue-600'>CoRATES</span>
        </h1>
        <p class='mx-auto max-w-3xl text-lg leading-relaxed text-gray-600 md:text-xl'>
          Developed by a research synthesis expert and a software engineer and data scientist,
          CoRATES combines methodological expertise with modern software engineering to support
          rigorous evidence appraisal.
        </p>

        {/* Decorative line */}
        <div class='mt-10 flex items-center justify-center gap-2'>
          <div class='h-1 w-12 rounded-full bg-blue-200' />
          <div class='h-3 w-3 rounded-full bg-blue-400' />
          <div class='h-1 w-12 rounded-full bg-blue-200' />
        </div>
      </div>

      {/* Background blur */}
      <div class='absolute top-0 left-1/2 -z-10 h-200 w-200 -translate-x-1/2 rounded-full bg-linear-to-b from-blue-50/50 to-transparent blur-3xl' />
    </section>
  );
}
