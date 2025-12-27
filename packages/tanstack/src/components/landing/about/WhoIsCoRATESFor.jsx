import { For } from 'solid-js'
import { AiOutlineUsergroupAdd } from 'solid-icons/ai'
import { IoSchoolOutline } from 'solid-icons/io'
import {
  FaSolidSchool,
  FaSolidBriefcaseMedical,
  FaSolidFileLines,
} from 'solid-icons/fa'

export default function WhoIsCoRATESFor() {
  const audiences = [
    {
      icon: <AiOutlineUsergroupAdd class="h-6 w-6" />,
      title: 'Systematic review and evidence synthesis teams',
      description:
        'Appraise multiple studies in a structured, consistent way that supports rigorous, transparent, and well-documented review processes.',
      color: 'blue',
    },
    {
      icon: <IoSchoolOutline class="h-6 w-6" />,
      title: 'Students learning to appraise research',
      description:
        'Learn study appraisal by using validated tools in a guided interface, with free single-study assessments for easy practice.',
      color: 'emerald',
    },
    {
      icon: <FaSolidSchool class="h-6 w-6" />,
      title: 'Faculty teaching research methods or appraisal',
      description:
        'Use structured appraisal activities to help students understand what makes different research designs rigorous by examining real published studies.',
      color: 'violet',
    },
    {
      icon: <FaSolidBriefcaseMedical class="h-6 w-6" />,
      title: 'Clinicians and practitioners',
      description:
        'Evaluate the quality of individual studies when deciding whether evidence should inform practice, policy, or program decisions.',
      color: 'rose',
    },
    {
      icon: <FaSolidFileLines class="h-6 w-6" />,
      title: 'Anyone needing to appraise a single study',
      description:
        'CoRATES makes it easy to complete a one-off appraisal for free, including automatic study-level scoring.',
      color: 'amber',
    },
  ]

  const getColorClasses = (color) => ({
    bg: `bg-${color}-50`,
    icon: `text-${color}-600`,
  })

  return (
    <section class="mx-auto max-w-5xl px-6 py-20">
      <div class="mb-12 text-center">
        <h2 class="mb-4 text-2xl font-bold text-gray-900 md:text-3xl">
          Who is CoRATES For?
        </h2>
        <p class="mx-auto max-w-3xl leading-relaxed text-gray-600">
          Although CoRATES was designed with evidence synthesis teams in mind,
          it supports a wide range of users who need to appraise study quality.
          Whether you are part of a systematic review team, teaching evidence
          synthesis or research methods, needing to assess a single study, or
          learning the fundamentals of study appraisal, CoRATES helps you
          complete rigorous, transparent assessments quickly.
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <For each={audiences}>
          {(audience) => {
            const colors = getColorClasses(audience.color)
            return (
              <div class="group relative overflow-hidden rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div
                  class={`h-12 w-12 ${colors.bg} mb-4 flex items-center justify-center rounded-xl ${colors.icon}`}
                >
                  {audience.icon}
                </div>
                <h3 class="mb-2 font-semibold text-gray-900">
                  {audience.title}
                </h3>
                <p class="text-sm leading-relaxed text-gray-600">
                  {audience.description}
                </p>
              </div>
            )
          }}
        </For>
      </div>
    </section>
  )
}
