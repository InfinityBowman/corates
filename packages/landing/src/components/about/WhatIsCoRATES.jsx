import { For } from 'solid-js';
import { AiOutlineCheckCircle } from 'solid-icons/ai';

export default function WhatIsCoRATES() {
  const features = [
    'Complete validated appraisal tools using dynamic, guided checklist interfaces',
    'Automatically apply scoring rules with real-time calculation of item- and study-level scores',
    'Upload, store, and annotate PDFs directly within the platform',
    'Conduct double coding, compare assessments, and reach consensus using built-in features',
    'Generate inter-rater reliability statistics',
    'Produce publication-ready visual summaries of appraisal results',
    'Maintain a transparent audit trail of decisions and notes',
  ];

  return (
    <section class='bg-linear-to-b from-gray-50 to-white border-y border-gray-100'>
      <div class='max-w-4xl mx-auto px-6 py-20'>
        <h2 class='text-2xl md:text-3xl font-bold text-gray-900 mb-8'>What is CoRATES?</h2>
        <div class='space-y-5 text-gray-600 leading-relaxed'>
          <p>
            CoRATES is more than a checklist platform. It is an ecosystem built to support
            high-quality and efficient study appraisal by bringing every part of the process into
            one organized, interactive workspace. Instead of manually managing PDF or Word
            checklists, tracking decisions across spreadsheets, emailing files back and forth, and
            creating visualizations in statistical software, CoRATES automates these steps within a
            single, integrated platform. What typically requires multiple tools and extensive manual
            effort is handled seamlessly within CoRATES.
          </p>
          <p>
            Beyond streamlining and automating the study appraisal process, CoRATES is intentionally
            designed to strengthen rigor by embedding the practices that support high-quality
            appraisal, including double coding, consensus processes, transparent documentation, and
            consistent rule-based scoring.
          </p>

          <div class='bg-white rounded-xl p-6 md:p-8 shadow-sm border border-gray-100 mt-8'>
            <p class='font-semibold text-gray-900 mb-5 text-lg'>With CoRATES, reviewers can:</p>
            <ul class='space-y-3'>
              <For each={features}>
                {feature => (
                  <li class='flex items-start gap-3'>
                    <AiOutlineCheckCircle class='w-5 h-5 text-blue-700 mt-0.5 shrink-0' />
                    <span>{feature}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>

          <p class='pt-4'>
            CoRATES was not built to replace established appraisal tools; but to provide the
            infrastructure that supports the rigorous processes involved in applying those tools and
            synthesizing results across studies, ultimately improving the rigor of research
            synthesis.
          </p>
        </div>
      </div>
    </section>
  );
}
