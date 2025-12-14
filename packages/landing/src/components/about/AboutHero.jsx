import { BsLightbulb } from 'solid-icons/bs';
import { FiUsers, FiCode } from 'solid-icons/fi';

export default function AboutHero() {
  return (
    <section class='relative overflow-hidden'>
      <div class='max-w-4xl mx-auto px-6 py-20 md:py-28 text-center'>
        {/* Icon cluster */}
        <div class='flex items-center justify-center gap-4 mb-8'>
          <div class='w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center transform -rotate-6'>
            <BsLightbulb class='w-7 h-7 text-blue-600' />
          </div>
          <div class='w-16 h-16 bg-linear-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg'>
            <FiUsers class='w-8 h-8 text-white' />
          </div>
          <div class='w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center transform rotate-6'>
            <FiCode class='w-7 h-7 text-blue-600' />
          </div>
        </div>

        <h1 class='text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight'>
          About <span class='text-blue-600'>CoRATES</span>
        </h1>
        <p class='text-lg md:text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto'>
          Developed by a research synthesis expert and a software engineer and data scientist,
          CoRATES combines methodological expertise with modern software engineering to support
          rigorous evidence appraisal.
        </p>

        {/* Decorative line */}
        <div class='flex items-center justify-center gap-2 mt-10'>
          <div class='w-12 h-1 bg-blue-200 rounded-full' />
          <div class='w-3 h-3 bg-blue-400 rounded-full' />
          <div class='w-12 h-1 bg-blue-200 rounded-full' />
        </div>
      </div>

      {/* Background blur */}
      <div class='absolute top-0 left-1/2 -translate-x-1/2 w-200 h-200 bg-linear-to-b from-blue-50/50 to-transparent rounded-full blur-3xl -z-10' />
    </section>
  );
}
