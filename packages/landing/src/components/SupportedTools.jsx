import { For } from 'solid-js';
import { getAllTools } from '~/lib/tool-content';

export default function SupportedTools() {
  const tools = getAllTools().map(tool => ({
    name: tool.name,
    status: 'available',
    description: tool.bestUsedFor,
    href: `/resources/${tool.slug}`,
  }));

  return (
    <section class='mx-auto max-w-6xl px-6 py-16'>
      <div class='mb-10 text-center'>
        <h2 class='mb-4 text-2xl font-bold text-gray-900 md:text-3xl'>Supported Appraisal tools</h2>
        <p class='mx-auto max-w-xl text-gray-600'>
          Get started with AMSTAR 2, ROBINS-I, or RoB 2 today.
        </p>
      </div>

      <div class='grid grid-cols-2 gap-4 md:grid-cols-3'>
        <For each={tools}>
          {tool => {
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
                <p class={`mb-1 font-semibold ${isAvailable ? 'text-blue-600' : 'text-gray-500'}`}>
                  {tool.name}
                </p>
                <p class='mb-2 text-xs text-gray-500'>{tool.description}</p>
                <span
                  class={`inline-block rounded-full px-2 py-0.5 text-xs ${
                    isAvailable ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {isAvailable ? 'Available' : 'Coming Soon'}
                </span>
              </>
            );

            return isAvailable ?
                <a href={tool.href} rel='external' class={`${baseClasses} ${interactiveClasses}`}>
                  {content}
                </a>
              : <div class={baseClasses}>{content}</div>;
          }}
        </For>
      </div>
    </section>
  );
}
