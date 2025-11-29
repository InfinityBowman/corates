import { For } from 'solid-js';
import { AiOutlineUsergroupAdd, AiOutlineBarChart, AiOutlineFolderOpen } from 'solid-icons/ai';
import { BiRegularCheckShield } from 'solid-icons/bi';
import { BsClockHistory, BsPieChart } from 'solid-icons/bs';
import { HiOutlineClipboardDocumentCheck } from 'solid-icons/hi';

function ReasonCard(props) {
  return (
    <div class='flex gap-4'>
      <div class='shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center'>
        {props.icon}
      </div>
      <div>
        <h3 class='font-semibold text-gray-900 mb-1'>{props.title}</h3>
        <p class='text-gray-600 text-sm leading-relaxed'>{props.description}</p>
      </div>
    </div>
  );
}

export default function WhyChoose() {
  const reasons = [
    {
      icon: <AiOutlineUsergroupAdd class='w-5 h-5 text-blue-600' />,
      title: 'Enhances team collaboration',
      description:
        'Shared access, synchronized progress, and transparent reviewer inputs make collaborative appraisal straightforward.',
    },
    {
      icon: <BiRegularCheckShield class='w-5 h-5 text-blue-600' />,
      title: 'Supports double coding and real-time consensus',
      description:
        'Enable independent ratings, calculate inter-rater reliability, compare results instantly, and resolve discrepancies efficiently.',
    },
    {
      icon: <AiOutlineBarChart class='w-5 h-5 text-blue-600' />,
      title: 'Automates scoring and documentation',
      description:
        'CoRATES applies scoring rules automatically and records your inputs without the need for spreadsheets or manual data entry, eliminating calculation errors.',
    },
    {
      icon: <AiOutlineFolderOpen class='w-5 h-5 text-blue-600' />,
      title: 'Centralizes PDFs, annotations, and notes',
      description:
        'Upload studies, annotate documents, and keep all appraisal materials organized in a single, unified workspace.',
    },
    {
      icon: <BsPieChart class='w-5 h-5 text-blue-600' />,
      title: 'Generates visual summaries automatically',
      description:
        'Instantly produce study-level and across-study visuals for intuitive interpretation and publication-ready graphics.',
    },
    {
      icon: <BsClockHistory class='w-5 h-5 text-blue-600' />,
      title: 'Creates an audit trail for every appraisal',
      description:
        'Track decisions, revisions, and reviewer inputs to support transparency, reproducibility, and methodological rigor.',
    },
    {
      icon: <HiOutlineClipboardDocumentCheck class='w-5 h-5 text-blue-600' />,
      title: 'Scales easily from one study to hundreds',
      description:
        'Adaptable for quick, one-off appraisals, classroom use, or large-scale evidence synthesis projects.',
    },
  ];

  return (
    <section class='bg-gray-50 border-y border-gray-100'>
      <div class='max-w-6xl mx-auto px-6 py-16'>
        <div class='text-center mb-12'>
          <h2 class='text-2xl md:text-3xl font-bold text-gray-900 mb-4'>Why Choose CoRATES</h2>
          <p class='text-gray-600 max-w-2xl mx-auto'>
            Built by researchers, for researchers. CoRATES addresses the practical challenges of
            study appraisal with features designed for real-world workflows.
          </p>
        </div>

        <div class='grid md:grid-cols-2 gap-8'>
          <For each={reasons}>{reason => <ReasonCard {...reason} />}</For>
        </div>
      </div>
    </section>
  );
}
