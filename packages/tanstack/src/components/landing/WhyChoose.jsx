import { For } from 'solid-js';
import { AiOutlineUsergroupAdd, AiOutlineBarChart, AiOutlineFolderOpen } from 'solid-icons/ai';
import { BiRegularCheckShield } from 'solid-icons/bi';
import { BsClockHistory, BsPieChart } from 'solid-icons/bs';
import { HiOutlineClipboardDocumentCheck } from 'solid-icons/hi';

function ReasonCard(props) {
  return (
    <div class='flex gap-4'>
      <div class='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50'>
        {props.icon}
      </div>
      <div>
        <h3 class='mb-1 font-semibold text-gray-900'>{props.title}</h3>
        <p class='text-sm leading-relaxed text-gray-600'>{props.description}</p>
      </div>
    </div>
  );
}

export default function WhyChoose() {
  const reasons = [
    {
      icon: <AiOutlineUsergroupAdd class='h-5 w-5 text-blue-600' />,
      title: 'Enhances team collaboration',
      description:
        'Shared access, synchronized progress, and transparent reviewer inputs make collaborative appraisal straightforward.',
    },
    {
      icon: <BiRegularCheckShield class='h-5 w-5 text-blue-600' />,
      title: 'Supports double coding and real-time consensus',
      description:
        'Enable independent ratings, calculate inter-rater reliability, compare results instantly, and resolve discrepancies efficiently.',
    },
    {
      icon: <AiOutlineBarChart class='h-5 w-5 text-blue-600' />,
      title: 'Automates scoring and documentation',
      description:
        'CoRATES applies scoring rules automatically and records your inputs without the need for spreadsheets, eliminating calculation errors.',
    },
    {
      icon: <AiOutlineFolderOpen class='h-5 w-5 text-blue-600' />,
      title: 'Centralizes PDFs, annotations, and notes',
      description:
        'Upload studies, annotate documents, and keep all appraisal materials organized in a single, unified workspace.',
    },
    {
      icon: <BsPieChart class='h-5 w-5 text-blue-600' />,
      title: 'Generates visual summaries automatically',
      description:
        'Instantly produce study-level and across-study visuals for intuitive interpretation and publication-ready graphics.',
    },
    {
      icon: <BsClockHistory class='h-5 w-5 text-blue-600' />,
      title: 'Creates an audit trail for every appraisal',
      description:
        'Track decisions, revisions, and reviewer inputs to support transparency, reproducibility, and methodological rigor.',
    },
    {
      icon: <HiOutlineClipboardDocumentCheck class='h-5 w-5 text-blue-600' />,
      title: 'Scales easily from one study to hundreds',
      description:
        'Adaptable for quick, one-off appraisals, classroom use, or large-scale evidence synthesis projects.',
    },
  ];

  return (
    <section class='border-y border-gray-100 bg-gray-50'>
      <div class='mx-auto max-w-6xl px-6 py-16'>
        <div class='mb-12 text-center'>
          <h2 class='mb-4 text-2xl font-bold text-gray-900 md:text-3xl'>Why Choose CoRATES</h2>
          <p class='mx-auto max-w-2xl text-gray-600'>
            Built by researchers, for researchers. CoRATES addresses the practical challenges of
            study appraisal with features designed for real-world workflows.
          </p>
        </div>

        <div class='grid gap-8 md:grid-cols-2'>
          <For each={reasons}>{reason => <ReasonCard {...reason} />}</For>
        </div>
      </div>
    </section>
  );
}
