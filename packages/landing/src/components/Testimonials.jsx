import { For } from 'solid-js';

export default function Testimonials() {
  const testimonials = [
    {
      quote:
        'CoRATES has transformed how our team conducts systematic reviews. The collaboration features alone save us hours every week.',
      name: 'Dr. Sarah Chen',
      title: 'Associate Professor, Health Sciences',
      institution: 'University Research Center',
    },
    {
      quote:
        'The automatic scoring eliminates so much tedious work. I can focus on the actual appraisal instead of wrestling with spreadsheets.',
      name: 'Dr. Michael Torres',
      title: 'Research Scientist',
      institution: 'Medical Evidence Institute',
    },
    {
      quote:
        'Finally, a tool designed specifically for evidence appraisal. The AMSTAR-2 implementation is exactly what we needed.',
      name: 'Dr. Emily Watson',
      title: 'Systematic Review Methodologist',
      institution: 'Health Sciences Academy',
    },
  ];

  return (
    <section class='bg-gray-50 border-y border-gray-100'>
      <div class='max-w-6xl mx-auto px-6 py-16 md:py-24'>
        <div class='text-center mb-12'>
          <h2 class='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
            What researchers are saying
          </h2>
          <p class='text-lg text-gray-600'>
            Join a growing community of researchers streamlining their evidence appraisal.
          </p>
        </div>

        <div class='grid md:grid-cols-3 gap-8'>
          <For each={testimonials}>
            {testimonial => (
              <div class='bg-white rounded-xl p-6 shadow-sm border border-gray-100'>
                <svg class='w-8 h-8 text-blue-200 mb-4' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z' />
                </svg>
                <p class='text-gray-700 mb-6 leading-relaxed'>{testimonial.quote}</p>
                <div>
                  <p class='font-semibold text-gray-900'>{testimonial.name}</p>
                  <p class='text-sm text-gray-500'>{testimonial.title}</p>
                  <p class='text-sm text-gray-400'>{testimonial.institution}</p>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
