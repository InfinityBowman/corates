import { Link } from '@tanstack/react-router';
import { getAllTools } from '../lib/tool-content';

export default function SupportedTools() {
  const tools = getAllTools().map(tool => ({
    name: tool.name,
    status: 'available' as const,
    description: tool.bestUsedFor,
    href: `/resources/${tool.slug}`,
  }));

  return (
    <section className='mx-auto max-w-6xl px-6 py-16'>
      <div className='mb-10 text-center'>
        <h2 className='mb-4 text-2xl font-bold text-gray-900 md:text-3xl'>
          Supported Appraisal tools
        </h2>
        <p className='mx-auto max-w-xl text-gray-600'>
          Get started with AMSTAR 2, ROBINS-I, or RoB 2 today.
        </p>
      </div>

      <div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
        {tools.map((tool, index) => {
          const isAvailable = tool.status === 'available';
          const baseClasses = `rounded-xl border p-5 text-center ${
            isAvailable ? 'border-blue-700/20 bg-blue-600/10' : 'border-gray-200 bg-gray-50'
          }`;
          const interactiveClasses =
            isAvailable ?
              'cursor-pointer transition-all hover:border-blue-700/40 hover:bg-blue-600/20 hover:shadow-md active:scale-[0.98]'
            : '';

          const content = (
            <>
              <p
                className={`mb-1 font-semibold ${isAvailable ? 'text-blue-600' : 'text-gray-500'}`}
              >
                {tool.name}
              </p>
              <p className='mb-2 text-xs text-gray-500'>{tool.description}</p>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                  isAvailable ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}
              >
                {isAvailable ? 'Available' : 'Coming Soon'}
              </span>
            </>
          );

          return isAvailable ?
              <Link key={index} to={tool.href} className={`${baseClasses} ${interactiveClasses}`}>
                {content}
              </Link>
            : <div key={index} className={baseClasses}>
                {content}
              </div>;
        })}
      </div>

      <p className='mt-6 text-center text-xs text-gray-500'>
        These appraisal frameworks are the intellectual property of their original authors. CoRATES
        provides workflow and collaboration features to support their use. See each tool's{' '}
        <Link to='/resources' className='text-blue-600 underline hover:text-blue-700'>
          resource page
        </Link>{' '}
        for official references.
      </p>
    </section>
  );
}
