import { Link } from '@tanstack/react-router';
import { ArrowRightIcon } from 'lucide-react';
import { clientLogger } from '@/lib/clientLogger';
import type { ToolContent } from '@/lib/tool-content';

/**
 * Call to action on the tool resource pages. `placement` is carried into the
 * click event so the two positions can be compared per page.
 */
export function ResourceCta({
  tool,
  placement,
}: {
  tool: ToolContent;
  placement: 'workflow' | 'page-end';
}) {
  const atWorkflow = placement === 'workflow';

  const logClick = (target: 'checklist' | 'signup') => {
    clientLogger.info('client.resource.cta_clicked', { tool: tool.slug, placement, target });
  };

  return (
    <div className='rounded-lg border border-blue-200 bg-blue-50 p-6'>
      <h2 className='text-lg font-semibold text-gray-900'>
        {atWorkflow ? `Try ${tool.name} in CoRATES` : 'Start appraising'}
      </h2>
      <p className='mt-2 text-gray-600'>
        {atWorkflow ?
          `Open a ${tool.name} appraisal in your browser and work through it item by item. Nothing to install and no account needed.`
        : `Run a ${tool.name} appraisal for free, or create an account to appraise with a team across a whole review.`
        }
      </p>
      <div className='mt-5 flex flex-col gap-3 sm:flex-row'>
        <Link
          to='/checklist'
          search={{ type: tool.checklistType }}
          onClick={() => logClick('checklist')}
          className='group inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none'
        >
          Start a {tool.name} appraisal
          <ArrowRightIcon className='size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
        </Link>
        {!atWorkflow && (
          <Link
            to='/signup'
            onClick={() => logClick('signup')}
            className='inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 font-semibold text-gray-800 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 focus-visible:outline-none'
          >
            Start a review project
          </Link>
        )}
      </div>
    </div>
  );
}
