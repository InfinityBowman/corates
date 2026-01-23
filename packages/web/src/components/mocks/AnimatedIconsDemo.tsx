import type { Component } from 'solid-js';
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader,
} from '@components/ui/animated-icons';

/**
 * Demo page showcasing all animated icons and their variants
 */
const AnimatedIconsDemo: Component = () => {
  return (
    <div class='min-h-screen bg-gray-50 p-8'>
      <div class='mx-auto max-w-4xl'>
        <h1 class='mb-2 text-3xl font-bold text-gray-900'>Animated Icons</h1>
        <p class='mb-8 text-gray-600'>
          Hover over icons to see animations. Built with the motion library.
        </p>

        {/* Arrow Icons Section */}
        <section class='mb-12'>
          <h2 class='mb-4 text-xl font-semibold text-gray-800'>Arrow Icons</h2>
          <p class='mb-6 text-sm text-gray-600'>Matches animate-ui animation patterns</p>

          {/* Default Animation */}
          <div class='mb-6 rounded-lg bg-white p-6 shadow-sm'>
            <h3 class='mb-3 text-sm font-medium text-gray-500'>Default Animation</h3>
            <p class='mb-4 text-xs text-gray-400'>Moves 25% in arrow direction on hover</p>
            <div class='flex items-center gap-8'>
              <div class='flex flex-col items-center gap-2'>
                <ArrowUp class='cursor-pointer text-gray-700 transition-colors hover:text-blue-600' />
                <span class='text-xs text-gray-500'>Up</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowDown class='cursor-pointer text-gray-700 transition-colors hover:text-blue-600' />
                <span class='text-xs text-gray-500'>Down</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowLeft class='cursor-pointer text-gray-700 transition-colors hover:text-blue-600' />
                <span class='text-xs text-gray-500'>Left</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowRight class='cursor-pointer text-gray-700 transition-colors hover:text-blue-600' />
                <span class='text-xs text-gray-500'>Right</span>
              </div>
            </div>
          </div>

          {/* Pointing Animation */}
          <div class='mb-6 rounded-lg bg-white p-6 shadow-sm'>
            <h3 class='mb-3 text-sm font-medium text-gray-500'>Pointing Animation</h3>
            <p class='mb-4 text-xs text-gray-400'>Morphs into a more pointed arrow shape</p>
            <div class='flex items-center gap-8'>
              <div class='flex flex-col items-center gap-2'>
                <ArrowUp
                  animation='pointing'
                  class='cursor-pointer text-gray-700 transition-colors hover:text-green-600'
                />
                <span class='text-xs text-gray-500'>Up</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowDown
                  animation='pointing'
                  class='cursor-pointer text-gray-700 transition-colors hover:text-green-600'
                />
                <span class='text-xs text-gray-500'>Down</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowLeft
                  animation='pointing'
                  class='cursor-pointer text-gray-700 transition-colors hover:text-green-600'
                />
                <span class='text-xs text-gray-500'>Left</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowRight
                  animation='pointing'
                  class='cursor-pointer text-gray-700 transition-colors hover:text-green-600'
                />
                <span class='text-xs text-gray-500'>Right</span>
              </div>
            </div>
          </div>
        </section>

        {/* Check Icon Section */}
        <section class='mb-12'>
          <h2 class='mb-4 text-xl font-semibold text-gray-800'>Check Icon (Path Drawing)</h2>

          <div class='mb-6 rounded-lg bg-white p-6 shadow-sm'>
            <h3 class='mb-3 text-sm font-medium text-gray-500'>Path Drawing Animation</h3>
            <p class='mb-4 text-xs text-gray-400'>
              Draws the checkmark path on hover (like animate-ui)
            </p>
            <div class='flex items-center gap-8'>
              <div class='flex flex-col items-center gap-2'>
                <Check class='cursor-pointer text-green-600' />
                <span class='text-xs text-gray-500'>Default</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <Check size={32} class='cursor-pointer text-blue-600' />
                <span class='text-xs text-gray-500'>32px</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <Check size={40} strokeWidth={3} class='cursor-pointer text-purple-600' />
                <span class='text-xs text-gray-500'>40px, thick</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <Check size={48} class='cursor-pointer text-teal-600' />
                <span class='text-xs text-gray-500'>48px</span>
              </div>
            </div>
          </div>
        </section>

        {/* Loader Section */}
        <section class='mb-12'>
          <h2 class='mb-4 text-xl font-semibold text-gray-800'>Loader Icons</h2>

          <div class='mb-6 rounded-lg bg-white p-6 shadow-sm'>
            <h3 class='mb-3 text-sm font-medium text-gray-500'>Spin Animation (Default)</h3>
            <p class='mb-4 text-xs text-gray-400'>Continuous rotation</p>
            <div class='flex items-center gap-8'>
              <div class='flex flex-col items-center gap-2'>
                <Loader class='text-blue-600' />
                <span class='text-xs text-gray-500'>Default</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <Loader size={32} class='text-green-600' />
                <span class='text-xs text-gray-500'>32px</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <Loader size={40} strokeWidth={3} class='text-purple-600' />
                <span class='text-xs text-gray-500'>40px, thick</span>
              </div>
            </div>
          </div>

          <div class='mb-6 rounded-lg bg-white p-6 shadow-sm'>
            <h3 class='mb-3 text-sm font-medium text-gray-500'>Pulse Animation</h3>
            <p class='mb-4 text-xs text-gray-400'>Opacity pulsing effect</p>
            <div class='flex items-center gap-8'>
              <div class='flex flex-col items-center gap-2'>
                <Loader animation='pulse' class='text-orange-600' />
                <span class='text-xs text-gray-500'>Default</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <Loader animation='pulse' size={32} class='text-red-600' />
                <span class='text-xs text-gray-500'>32px</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <Loader animation='pulse' size={40} strokeWidth={3} class='text-pink-600' />
                <span class='text-xs text-gray-500'>40px, thick</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sizes Section */}
        <section class='mb-12'>
          <h2 class='mb-4 text-xl font-semibold text-gray-800'>Size Variations</h2>

          <div class='rounded-lg bg-white p-6 shadow-sm'>
            <div class='flex items-end gap-6'>
              <div class='flex flex-col items-center gap-2'>
                <ArrowRight size={16} class='cursor-pointer text-gray-700' />
                <span class='text-xs text-gray-500'>16px</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowRight size={20} class='cursor-pointer text-gray-700' />
                <span class='text-xs text-gray-500'>20px</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowRight size={24} class='cursor-pointer text-gray-700' />
                <span class='text-xs text-gray-500'>24px</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowRight size={32} class='cursor-pointer text-gray-700' />
                <span class='text-xs text-gray-500'>32px</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowRight size={40} class='cursor-pointer text-gray-700' />
                <span class='text-xs text-gray-500'>40px</span>
              </div>
              <div class='flex flex-col items-center gap-2'>
                <ArrowRight size={48} class='cursor-pointer text-gray-700' />
                <span class='text-xs text-gray-500'>48px</span>
              </div>
            </div>
          </div>
        </section>

        {/* Colors Section */}
        <section class='mb-12'>
          <h2 class='mb-4 text-xl font-semibold text-gray-800'>Color Variations</h2>

          <div class='rounded-lg bg-white p-6 shadow-sm'>
            <div class='flex items-center gap-6'>
              <ArrowDown size={32} color='#3b82f6' class='cursor-pointer' />
              <ArrowDown size={32} color='#10b981' class='cursor-pointer' />
              <ArrowDown size={32} color='#f59e0b' class='cursor-pointer' />
              <ArrowDown size={32} color='#ef4444' class='cursor-pointer' />
              <ArrowDown size={32} color='#8b5cf6' class='cursor-pointer' />
              <ArrowDown size={32} color='#ec4899' class='cursor-pointer' />
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section class='mb-12'>
          <h2 class='mb-4 text-xl font-semibold text-gray-800'>Example Use Cases</h2>

          {/* Button with Arrow */}
          <div class='mb-6 rounded-lg bg-white p-6 shadow-sm'>
            <h3 class='mb-3 text-sm font-medium text-gray-500'>Button with Animated Arrow</h3>
            <div class='flex gap-4'>
              <button class='group flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700'>
                Continue
                <ArrowRight
                  size={18}
                  color='white'
                  class='transition-transform group-hover:translate-x-0.5'
                />
              </button>
              <button class='group flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50'>
                <ArrowLeft size={18} class='transition-transform group-hover:-translate-x-0.5' />
                Back
              </button>
            </div>
          </div>

          {/* Loading States */}
          <div class='mb-6 rounded-lg bg-white p-6 shadow-sm'>
            <h3 class='mb-3 text-sm font-medium text-gray-500'>Loading States</h3>
            <div class='flex gap-4'>
              <button
                class='flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-500'
                disabled
              >
                <Loader size={18} />
                Loading...
              </button>
              <div class='flex items-center gap-2 text-sm text-gray-600'>
                <Loader size={16} animation='pulse' />
                Processing your request
              </div>
            </div>
          </div>

          {/* Accordion/Expand Indicator */}
          <div class='rounded-lg bg-white p-6 shadow-sm'>
            <h3 class='mb-3 text-sm font-medium text-gray-500'>Accordion Indicator</h3>
            <div class='space-y-2'>
              <div class='flex cursor-pointer items-center justify-between rounded border border-gray-200 p-3 transition-colors hover:bg-gray-50'>
                <span class='text-gray-700'>Click to expand</span>
                <ArrowDown size={20} class='text-gray-400' />
              </div>
              <div class='flex cursor-pointer items-center justify-between rounded border border-gray-200 p-3 transition-colors hover:bg-gray-50'>
                <span class='text-gray-700'>Another section</span>
                <ArrowDown size={20} animation='pointing' class='text-gray-400' />
              </div>
            </div>
          </div>
        </section>

        {/* Code Examples */}
        <section>
          <h2 class='mb-4 text-xl font-semibold text-gray-800'>Code Examples</h2>

          <div class='rounded-lg bg-gray-900 p-6 text-sm'>
            <pre class='overflow-x-auto text-gray-300'>
              <code>{`import { ArrowRight, Check, Loader } from '@components/ui/animated-icons';

// Arrow - default: moves 25% in direction on hover
<ArrowRight size={24} />

// Arrow - pointing: morphs to pointed shape
<ArrowRight animation="pointing" />

// Check - path drawing animation on hover
<Check size={24} />

// Loader with staggered opacity (like animate-ui)
<Loader animation="spin" />

// Loader with pulse animation
<Loader animation="pulse" />`}</code>
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AnimatedIconsDemo;
