import { For } from 'solid-js'
import { HiOutlineClipboardDocumentCheck } from 'solid-icons/hi'
import {
  AiOutlineUsergroupAdd,
  AiOutlineBarChart,
  AiOutlineFolderOpen,
} from 'solid-icons/ai'
import { BsClockHistory } from 'solid-icons/bs'
import { BiRegularExpand } from 'solid-icons/bi'

function FeatureCard(props) {
  return (
    <div class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
        {props.icon}
      </div>
      <h3 class="mb-2 text-lg font-semibold text-gray-900">{props.title}</h3>
      <p class="text-sm leading-relaxed text-gray-600">{props.description}</p>
    </div>
  )
}

export default function Features() {
  const features = [
    {
      icon: <HiOutlineClipboardDocumentCheck class="h-6 w-6 text-blue-600" />,
      title: 'Appraisal Checklists',
      description:
        'Guided implementations of leading quality and risk-of-bias appraisal tools, including all items and supporting guidance.',
    },
    {
      icon: <AiOutlineUsergroupAdd class="h-6 w-6 text-blue-600" />,
      title: 'Real-time Collaboration',
      description:
        'Enable independent ratings, calculate inter-rater reliability, compare results instantly, and resolve discrepancies efficiently.',
    },
    {
      icon: <AiOutlineBarChart class="h-6 w-6 text-blue-600" />,
      title: 'Automatic Scoring',
      description:
        'Generate study-level appraisal scores automatically, reducing manual work and eliminating calculation errors by applying scoring rules correctly every time.',
    },
    {
      icon: <AiOutlineFolderOpen class="h-6 w-6 text-blue-600" />,
      title: 'Centralized Workspace',
      description:
        'Upload studies, annotate documents, and keep all appraisal materials organized in a single, unified workspace.',
    },
    {
      icon: <BsClockHistory class="h-6 w-6 text-blue-600" />,
      title: 'Audit Trail',
      description:
        'Track decisions, revisions, and reviewer inputs to support transparency, reproducibility, and methodological rigor.',
    },
    {
      icon: <BiRegularExpand class="h-6 w-6 text-blue-600" />,
      title: 'Scales With You',
      description:
        'Adaptable for quick, one-off appraisals, classroom use, or large-scale evidence synthesis projects.',
    },
  ]

  return (
    <section class="mx-auto max-w-6xl px-6 py-16">
      <div class="mb-12 text-center">
        <h2 class="mb-4 text-2xl font-bold text-gray-900 md:text-3xl">
          Everything you need to support rigorous study appraisal
        </h2>
        <p class="mx-auto max-w-2xl text-gray-600">
          Built specifically for researchers who need to appraise study quality
          and risk of bias in evidence reviews.
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <For each={features}>{(feature) => <FeatureCard {...feature} />}</For>
      </div>
    </section>
  )
}
