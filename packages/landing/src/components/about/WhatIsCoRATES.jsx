import { AiOutlineCheckCircle } from 'solid-icons/ai';
import { HiOutlineDocumentText } from 'solid-icons/hi';
import { BsGraphUp } from 'solid-icons/bs';
import { FiUsers } from 'solid-icons/fi';

// Ecosystem illustration showing multiple tools unified
function EcosystemIllustration() {
  return (
    <div class='bg-linear-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 md:p-8'>
      <div class='relative'>
        {/* Central hub */}
        <div class='flex items-center justify-center'>
          <div class='w-20 h-20 bg-linear-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg'>
            <span class='text-white font-bold text-lg'>Co</span>
          </div>
        </div>

        {/* Orbiting elements */}
        <div class='absolute top-0 left-1/4 -translate-x-1/2 -translate-y-2'>
          <div class='bg-white rounded-lg shadow-md p-2.5 border border-gray-200'>
            <HiOutlineDocumentText class='w-5 h-5 text-rose-500' />
          </div>
        </div>

        <div class='absolute top-0 right-1/4 translate-x-1/2 -translate-y-2'>
          <div class='bg-white rounded-lg shadow-md p-2.5 border border-gray-200'>
            <BsGraphUp class='w-5 h-5 text-violet-500' />
          </div>
        </div>

        <div class='absolute bottom-0 left-1/4 -translate-x-1/2 translate-y-2'>
          <div class='bg-white rounded-lg shadow-md p-2.5 border border-gray-200'>
            <FiUsers class='w-5 h-5 text-emerald-500' />
          </div>
        </div>

        <div class='absolute bottom-0 right-1/4 translate-x-1/2 translate-y-2'>
          <div class='bg-white rounded-lg shadow-md p-2.5 border border-gray-200'>
            <AiOutlineCheckCircle class='w-5 h-5 text-amber-500' />
          </div>
        </div>

        {/* Connection lines (decorative) */}
        <svg class='absolute inset-0 w-full h-full pointer-events-none' style={{ 'z-index': -1 }}>
          <circle
            cx='50%'
            cy='50%'
            r='45'
            fill='none'
            stroke='#93c5fd'
            stroke-width='1'
            stroke-dasharray='4 4'
          />
        </svg>
      </div>

      {/* Labels */}
      <div class='flex flex-wrap justify-center gap-2 mt-8'>
        <span class='text-xs bg-white px-2.5 py-1 rounded-full border border-gray-200 text-gray-600'>
          Checklists
        </span>
        <span class='text-xs bg-white px-2.5 py-1 rounded-full border border-gray-200 text-gray-600'>
          PDFs
        </span>
        <span class='text-xs bg-white px-2.5 py-1 rounded-full border border-gray-200 text-gray-600'>
          Scoring
        </span>
        <span class='text-xs bg-white px-2.5 py-1 rounded-full border border-gray-200 text-gray-600'>
          Collaboration
        </span>
      </div>
    </div>
  );
}

export default function WhatIsCoRATES() {
  return (
    <section class='bg-linear-to-b from-gray-50 to-white border-y border-gray-100'>
      <div class='max-w-5xl mx-auto px-6 py-20'>
        <div class='grid md:grid-cols-5 gap-10 items-start'>
          {/* Content */}
          <div class='md:col-span-3'>
            <h2 class='text-2xl md:text-3xl font-bold text-gray-900 mb-8'>What is CoRATES?</h2>
            <div class='space-y-5 text-gray-600 leading-relaxed'>
              <p>
                CoRATES is more than a checklist platform. It is an ecosystem built to support
                high-quality and efficient study appraisal by bringing every part of the process
                into one organized, interactive workspace. Instead of manually managing PDF or Word
                checklists, tracking decisions across spreadsheets, emailing files back and forth,
                and creating visualizations in statistical software, CoRATES automates these steps
                within a single, integrated platform.
              </p>
              <p>
                Beyond streamlining and automating the study appraisal process, CoRATES is
                intentionally designed to strengthen rigor by embedding the practices that support
                high-quality appraisal, including double coding, consensus processes, transparent
                documentation, and consistent rule-based scoring.
              </p>
            </div>
          </div>

          {/* Illustration */}
          <div class='md:col-span-2'>
            <EcosystemIllustration />
          </div>
        </div>

        <p class='text-gray-600 leading-relaxed mt-8 max-w-3xl'>
          CoRATES was not built to replace established appraisal tools; but to provide the
          infrastructure that supports the rigorous processes involved in applying those tools and
          synthesizing results across studies, ultimately improving the rigor of research synthesis.
        </p>
      </div>
    </section>
  );
}
