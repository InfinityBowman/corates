import { ReactNode } from 'react'
import {
  AiOutlineFolderAdd,
  AiOutlineFileAdd,
  AiOutlineEdit,
  AiOutlineTeam,
} from 'react-icons/ai'

interface Step {
  number: number
  icon: ReactNode
  title: string
  description: string
}

export default function HowItWorks() {
  const steps: Step[] = [
    {
      number: 1,
      icon: <AiOutlineFolderAdd className="h-6 w-6" />,
      title: 'Create a Project',
      description: 'Set up a review project and invite your team members to collaborate.',
    },
    {
      number: 2,
      icon: <AiOutlineFileAdd className="h-6 w-6" />,
      title: 'Add Studies',
      description: 'Upload PDFs and easily assign reviewers.',
    },
    {
      number: 3,
      icon: <AiOutlineEdit className="h-6 w-6" />,
      title: 'Appraise Independently',
      description:
        'Complete assessments independently with guided checklists and PDF annotations.',
    },
    {
      number: 4,
      icon: <AiOutlineTeam className="h-6 w-6" />,
      title: 'Resolve Collaboratively',
      description: 'Resolve discrepancies together with automatic scoring and summaries.',
    },
  ]

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div className="mb-12 text-center">
        <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
          Simple workflow, powerful results
        </h2>
        <p className="text-lg text-gray-600">Get started in minutes, not hours.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={index} className="relative text-center">
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="absolute top-8 left-1/2 hidden h-0.5 w-full bg-gray-200 md:block" />
            )}

            <div className="relative">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
                {step.icon}
              </div>
              <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-700/10 text-sm font-bold text-blue-700 md:hidden">
                {step.number}
              </div>
            </div>

            <h3 className="mb-2 text-xl font-semibold text-gray-900">{step.title}</h3>
            <p className="text-gray-600">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
