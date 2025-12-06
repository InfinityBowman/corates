export default function TrustLogos() {
  const institutions = [
    { name: 'Saint Louis University', abbr: 'SLU' },
    { name: 'University Research Center', abbr: 'URC' },
    { name: 'Medical Evidence Institute', abbr: 'MEI' },
    { name: 'Health Sciences Academy', abbr: 'HSA' },
  ];

  return (
    <section class='border-y border-gray-100 bg-gray-50/50'>
      <div class='max-w-6xl mx-auto px-6 py-10'>
        <p class='text-center text-sm text-gray-500 mb-6'>
          Trusted by researchers at leading institutions
        </p>
        <div class='flex flex-wrap justify-center items-center gap-8 md:gap-12'>
          {institutions.map(inst => (
            <div class='flex items-center gap-2 text-gray-400 hover:text-gray-500 transition-colors'>
              <div class='w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center'>
                <span class='text-xs font-bold text-gray-500'>{inst.abbr}</span>
              </div>
              <span class='text-sm font-medium hidden sm:inline'>{inst.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
