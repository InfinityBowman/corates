export default function AboutHero() {
  return (
    <section class='relative overflow-hidden'>
      <div class='max-w-4xl mx-auto px-6 py-20 md:py-28 text-center'>
        <h1 class='text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight'>
          About <span class='text-blue-700'>CoRATES</span>
        </h1>
        <p class='text-lg md:text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto'>
          Developed by a research synthesis expert and a software engineer and data scientist,
          CoRATES combines methodological expertise with modern software engineering to support
          rigorous evidence appraisal.
        </p>
      </div>

      {/* Background blur */}
      <div class='absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-linear-to-b from-blue-700/5 to-transparent rounded-full blur-3xl -z-10' />
    </section>
  );
}
