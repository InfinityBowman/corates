import { AiOutlineCheckCircle } from 'solid-icons/ai'
import { HiOutlineDocumentText } from 'solid-icons/hi'
import { BsGraphUp } from 'solid-icons/bs'
import { FiUsers } from 'solid-icons/fi'

// Ecosystem illustration showing multiple tools unified
function EcosystemIllustration() {
  return (
    <div class="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50 to-indigo-50 p-6 md:p-8">
      <div class="relative">
        {/* Central hub */}
        <div class="flex items-center justify-center">
          <div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-blue-700 shadow-lg">
            <span class="text-lg font-bold text-white">Co</span>
          </div>
        </div>

        {/* Orbiting elements */}
        <div class="absolute top-0 left-1/4 -translate-x-1/2 -translate-y-2">
          <div class="rounded-lg border border-gray-200 bg-white p-2.5 shadow-md">
            <HiOutlineDocumentText class="h-5 w-5 text-rose-500" />
          </div>
        </div>

        <div class="absolute top-0 right-1/4 translate-x-1/2 -translate-y-2">
          <div class="rounded-lg border border-gray-200 bg-white p-2.5 shadow-md">
            <BsGraphUp class="h-5 w-5 text-violet-500" />
          </div>
        </div>

        <div class="absolute bottom-0 left-1/4 -translate-x-1/2 translate-y-2">
          <div class="rounded-lg border border-gray-200 bg-white p-2.5 shadow-md">
            <FiUsers class="h-5 w-5 text-emerald-500" />
          </div>
        </div>

        <div class="absolute right-1/4 bottom-0 translate-x-1/2 translate-y-2">
          <div class="rounded-lg border border-gray-200 bg-white p-2.5 shadow-md">
            <AiOutlineCheckCircle class="h-5 w-5 text-amber-500" />
          </div>
        </div>

        {/* Connection lines (decorative) */}
        <svg
          class="pointer-events-none absolute inset-0 h-full w-full"
          style={{ 'z-index': -1 }}
        >
          <circle
            cx="50%"
            cy="50%"
            r="45"
            fill="none"
            stroke="#93c5fd"
            stroke-width="1"
            stroke-dasharray="4 4"
          />
        </svg>
      </div>

      {/* Labels */}
      <div class="mt-8 flex flex-wrap justify-center gap-2">
        <span class="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600">
          Checklists
        </span>
        <span class="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600">
          PDFs
        </span>
        <span class="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600">
          Scoring
        </span>
        <span class="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600">
          Collaboration
        </span>
      </div>
    </div>
  )
}

export default function WhatIsCoRATES() {
  return (
    <section class="border-y border-gray-100 bg-linear-to-b from-gray-50 to-white">
      <div class="mx-auto max-w-5xl px-6 py-20">
        <div class="grid items-start gap-10 md:grid-cols-5">
          {/* Content */}
          <div class="md:col-span-3">
            <h2 class="mb-8 text-2xl font-bold text-gray-900 md:text-3xl">
              What is CoRATES?
            </h2>
            <div class="space-y-5 leading-relaxed text-gray-600">
              <p>
                CoRATES is more than a checklist platform. It is an ecosystem
                built to support high-quality and efficient study appraisal by
                bringing every part of the process into one organized,
                interactive workspace. Instead of manually managing PDF or Word
                checklists, tracking decisions across spreadsheets, emailing
                files back and forth, and creating visualizations in statistical
                software, CoRATES automates these steps within a single,
                integrated platform.
              </p>
              <p>
                Beyond streamlining and automating the study appraisal process,
                CoRATES is intentionally designed to strengthen rigor by
                embedding the practices that support high-quality appraisal,
                including double coding, consensus processes, transparent
                documentation, and consistent rule-based scoring.
              </p>
            </div>
          </div>

          {/* Illustration */}
          <div class="md:col-span-2">
            <EcosystemIllustration />
          </div>
        </div>

        <p class="mt-8 max-w-3xl leading-relaxed text-gray-600">
          CoRATES was not built to replace established appraisal tools; but to
          provide the infrastructure that supports the rigorous processes
          involved in applying those tools and synthesizing results across
          studies, ultimately improving the rigor of research synthesis.
        </p>
      </div>
    </section>
  )
}
