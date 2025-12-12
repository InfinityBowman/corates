import { For } from 'solid-js';
import { HiOutlineClipboardDocumentCheck } from 'solid-icons/hi';
import {
  AiOutlineUsergroupAdd,
  AiOutlineBarChart,
  AiOutlineFolderOpen,
} from 'solid-icons/ai';
import { BsClockHistory } from 'solid-icons/bs';
import { BiRegularExpand } from 'solid-icons/bi';

function FeatureCard(props) {
  return (
    <div class='bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200'>
      <div class='w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4'>
        {props.icon}
      </div>
      <h3 class='text-lg font-semibold text-gray-900 mb-2'>{props.title}</h3>
      <p class='text-gray-600 text-sm leading-relaxed'>{props.description}</p>
    </div>
  );
}

export default function Features() {
  const features = [
    {
      icon: <HiOutlineClipboardDocumentCheck class='w-6 h-6 text-blue-600' />,
      title: 'Appraisal Checklists',
      description:
        'Guided implementations of leading quality and risk-of-bias appraisal tools, including all items and supporting guidance.',
    },
    {
      icon: <AiOutlineUsergroupAdd class='w-6 h-6 text-blue-600' />,
      title: 'Real-time Collaboration',
      description:
        'Enable independent ratings, calculate inter-rater reliability, compare results instantly, and resolve discrepancies efficiently.',
    },
    {
      icon: <AiOutlineBarChart class='w-6 h-6 text-blue-600' />,
      title: 'Automatic Scoring',
      description:
        'Generate study-level appraisal scores automatically, reducing manual work and eliminating calculation errors by applying scoring rules correctly every time.',
    },
    {
      icon: <AiOutlineFolderOpen class='w-6 h-6 text-blue-600' />,
      title: 'Centralized Workspace',
      description:
        'Upload studies, annotate documents, and keep all appraisal materials organized in a single, unified workspace.',
    },
    {
      icon: <BsClockHistory class='w-6 h-6 text-blue-600' />,
      title: 'Audit Trail',
      description:
        'Track decisions, revisions, and reviewer inputs to support transparency, reproducibility, and methodological rigor.',
    },
    {
      icon: <BiRegularExpand class='w-6 h-6 text-blue-600' />,
      title: 'Scales With You',
      description:
        'Adaptable for quick, one-off appraisals, classroom use, or large-scale evidence synthesis projects.',
    },
  ];

  return (
    <section class='max-w-6xl mx-auto px-6 py-16'>
      <div class='text-center mb-12'>
        <h2 class='text-2xl md:text-3xl font-bold text-gray-900 mb-4'>
          Everything you need to support rigorous study appraisal
        </h2>
        <p class='text-gray-600 max-w-2xl mx-auto'>
          Built specifically for researchers who need to appraise study quality and risk
          of bias in evidence reviews.
        </p>
      </div>

      <div class='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
        <For each={features}>{feature => <FeatureCard {...feature} />}</For>
      </div>
    </section>
  );
}
