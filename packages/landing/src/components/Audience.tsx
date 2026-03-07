import { ReactNode } from 'react'
import { FaGraduationCap } from 'react-icons/fa6'
import { BiPlusMedical } from 'react-icons/bi'
import { BsBook } from 'react-icons/bs'

interface AudienceItem {
  icon: ReactNode
  title: string
  description: string
}

export default function Audience() {
  const audiences: AudienceItem[] = [
    {
      icon: <FaGraduationCap className="h-6 w-6 text-blue-600" />,
      title: 'Graduate Students',
      description: 'Learning how to appraise study quality',
    },
    {
      icon: <BiPlusMedical className="h-6 w-6 text-blue-600" />,
      title: 'Clinicians & Practitioners',
      description: 'Needing quick, one-off appraisals',
    },
    {
      icon: <BsBook className="h-6 w-6 text-blue-600" />,
      title: 'Faculty & Educators',
      description: 'Teaching appraisal or methodology courses',
    },
  ]

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 md:p-12">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-xl font-bold text-gray-900 md:text-2xl">Also great for</h2>
          <p className="mx-auto max-w-2xl text-gray-600">
            While CoRATES is designed for research teams appraising studies for evidence reviews, its
            guided checklists and automatic scoring also make it valuable for:
          </p>
        </div>

        <div className="mb-10 grid gap-6 md:grid-cols-3">
          {audiences.map((audience, index) => (
            <div key={index} className="p-4 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                {audience.icon}
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">{audience.title}</h3>
              <p className="text-sm text-gray-600">{audience.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
