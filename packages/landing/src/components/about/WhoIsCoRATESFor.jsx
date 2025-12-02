import { For } from 'solid-js';
import { AiOutlineUsergroupAdd } from 'solid-icons/ai';
import { IoSchoolOutline } from 'solid-icons/io';
import { FaSolidSchool, FaSolidBriefcaseMedical, FaSolidFileLines } from 'solid-icons/fa';

export default function WhoIsCoRATESFor() {
  const audiences = [
    {
      icon: <AiOutlineUsergroupAdd class='w-6 h-6 text-blue-600' />,
      title: 'Systematic review and evidence synthesis teams',
      description:
        'Appraise multiple studies in a structured, consistent way that supports rigorous, transparent, and well-documented review processes.',
    },
    {
      icon: <IoSchoolOutline class='w-6 h-6 text-blue-600' />,
      title: 'Students learning to appraise research',
      description:
        'Learn study appraisal by using validated tools in a guided interface, with free single-study assessments for easy practice.',
    },
    {
      icon: <FaSolidSchool class='w-6 h-6 text-blue-600' />,
      title: 'Faculty teaching research methods or appraisal',
      description:
        'Use structured appraisal activities to help students understand what makes different research designs rigorous by examining real published studies.',
    },
    {
      icon: <FaSolidBriefcaseMedical class='w-6 h-6 text-blue-600' />,
      title: 'Clinicians and practitioners',
      description:
        'Evaluate the quality of individual studies when deciding whether evidence should inform practice, policy, or program decisions.',
    },
    {
      icon: <FaSolidFileLines class='w-6 h-6 text-blue-600' />,
      title: 'Anyone needing to appraise a single study',
      description:
        'CoRATES makes it easy to complete a one-off appraisal for free, including automatic study-level scoring.',
    },
  ];

  return (
    <section class='max-w-5xl mx-auto px-6 py-20'>
      <div class='text-center mb-12'>
        <h2 class='text-2xl md:text-3xl font-bold text-gray-900 mb-4'>Who is CoRATES For?</h2>
        <p class='text-gray-600 leading-relaxed max-w-3xl mx-auto'>
          Although CoRATES was designed with evidence synthesis teams in mind, it supports a wide
          range of users who need to appraise study quality. Whether you are part of a systematic
          review team, teaching evidence synthesis or research methods, needing to assess a single
          study, or learning the fundamentals of study appraisal, CoRATES helps you complete
          rigorous, transparent assessments quickly.
        </p>
      </div>

      <div class='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
        <For each={audiences}>
          {audience => (
            <div class='bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200'>
              <div class='w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4'>
                {audience.icon}
              </div>
              <h3 class='font-semibold text-gray-900 mb-2'>{audience.title}</h3>
              <p class='text-sm text-gray-600 leading-relaxed'>{audience.description}</p>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}
