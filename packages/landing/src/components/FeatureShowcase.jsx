import { For } from 'solid-js';
import { AiOutlineUsergroupAdd, AiOutlineBarChart } from 'solid-icons/ai';
import { HiOutlineDocumentText } from 'solid-icons/hi';

function FeaturePlaceholder(props) {
  return (
    <div class='bg-linear-to-br from-gray-100 to-gray-50 rounded-xl border border-gray-200 overflow-hidden'>
      <div class='aspect-4/3 flex items-center justify-center p-6'>
        <div class='text-center'>
          <div class='w-12 h-12 bg-blue-700/10 rounded-lg flex items-center justify-center mx-auto mb-3'>
            {props.icon}
          </div>
          <p class='text-gray-400 text-sm'>{props.placeholder}</p>
        </div>
      </div>
    </div>
  );
}

function FeatureSection(props) {
  return (
    <div
      class={`grid md:grid-cols-2 gap-8 md:gap-12 items-center ${props.reversed ? 'md:flex-row-reverse' : ''}`}
    >
      <div class={props.reversed ? 'md:order-2' : ''}>
        <FeaturePlaceholder icon={props.feature.icon} placeholder={props.feature.placeholder} />
      </div>
      <div class={props.reversed ? 'md:order-1' : ''}>
        <h3 class='text-2xl md:text-3xl font-bold text-gray-900 mb-4'>{props.feature.title}</h3>
        <p class='text-gray-600 text-lg mb-6 leading-relaxed'>{props.feature.description}</p>
        <ul class='space-y-3'>
          <For each={props.feature.bullets}>
            {bullet => (
              <li class='flex items-start gap-3'>
                <svg
                  class='w-5 h-5 text-blue-700 mt-0.5 shrink-0'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    stroke-linecap='round'
                    stroke-linejoin='round'
                    stroke-width='2'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
                <span class='text-gray-700'>{bullet}</span>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  );
}

export default function FeatureShowcase() {
  const features = [
    {
      title: 'Real-time Collaboration',
      description:
        'Work together with your team seamlessly. See updates instantly as reviewers complete their assessments.',
      placeholder: 'Collaboration screenshot',
      icon: <AiOutlineUsergroupAdd class='w-6 h-6 text-blue-700' />,
      bullets: [
        'Independent ratings with blinded mode',
        'Automatic inter-rater reliability calculation',
        'Built-in conflict resolution workflow',
      ],
    },
    {
      title: 'Automatic Scoring',
      description:
        'Eliminate manual calculation errors. Scores are computed instantly as you complete each checklist item.',
      placeholder: 'Scoring results screenshot',
      icon: <AiOutlineBarChart class='w-6 h-6 text-blue-700' />,
      bullets: ['AMSTAR-2 scoring built in', 'Visual summary charts', 'Export-ready reports'],
    },
    {
      title: 'PDF Annotation',
      description:
        'Annotate study PDFs directly alongside your checklist. Keep all evidence linked and organized.',
      placeholder: 'PDF annotation screenshot',
      icon: <HiOutlineDocumentText class='w-6 h-6 text-blue-700' />,
      bullets: [
        'Highlight and comment on PDFs',
        'Link annotations to checklist items',
        'Centralized document storage',
      ],
    },
  ];

  return (
    <section class='max-w-6xl mx-auto px-6 py-16 md:py-24'>
      <div class='text-center mb-16'>
        <h2 class='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
          Everything you need for rigorous study appraisal
        </h2>
        <p class='text-lg text-gray-600 max-w-2xl mx-auto'>
          Built specifically for researchers conducting systematic reviews and evidence synthesis.
        </p>
      </div>

      <div class='space-y-16 md:space-y-24'>
        <For each={features}>
          {(feature, index) => <FeatureSection feature={feature} reversed={index() % 2 === 1} />}
        </For>
      </div>
    </section>
  );
}
