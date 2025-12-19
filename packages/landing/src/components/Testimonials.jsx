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
    <section class='border-y border-gray-100 bg-gray-50'>
      <div class='mx-auto max-w-6xl px-6 py-16 md:py-24'>
        <div class='mb-12 text-center'>
          <h2 class='mb-4 text-3xl font-bold text-gray-900 md:text-4xl'>
            What researchers are saying
          </h2>
          <p class='text-lg text-gray-600'>
            Join a growing community of researchers streamlining their evidence appraisal.
          </p>
        </div>

        <div class='grid gap-8 md:grid-cols-3'>
          <For each={testimonials}>
            {testimonial => (
              <div class='rounded-xl border border-gray-100 bg-white p-6 shadow-sm'>
                <svg class='mb-4 h-8 w-8 text-blue-200' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z' />
                </svg>
                <p class='mb-6 leading-relaxed text-gray-700'>{testimonial.quote}</p>
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
