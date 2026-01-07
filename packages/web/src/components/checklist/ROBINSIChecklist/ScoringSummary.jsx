import { For, Show, createMemo, createSignal } from 'solid-js';
import { ROBINS_I_CHECKLIST, getActiveDomainKeys } from './checklist-map.js';
import { getSmartScoring } from './checklist.js';
import { DialogPrimitive as Dialog } from '@corates/ui';
import { FiExternalLink, FiInfo } from 'solid-icons/fi';

/**
 * Compact scoring summary strip for ROBINS-I checklist
 * Shows overall calculated judgement and domain status chips
 *
 * @param {Object} props
 * @param {Object} props.checklistState - Full checklist state
 * @param {Function} [props.onDomainClick] - Callback when a domain chip is clicked (to expand/navigate)
 */
export function ScoringSummary(props) {
  const [resourcesOpen, setResourcesOpen] = createSignal(false);

  const smartScoring = createMemo(() => getSmartScoring(props.checklistState));

  const isPerProtocol = () => props.checklistState?.sectionC?.isPerProtocol || false;
  const activeDomains = createMemo(() => getActiveDomainKeys(isPerProtocol()));

  // Count complete domains
  const domainStats = createMemo(() => {
    const scoring = smartScoring();
    let complete = 0;
    let total = activeDomains().length;

    activeDomains().forEach(domainKey => {
      const domainInfo = scoring.domains[domainKey];
      if (domainInfo?.effective) {
        complete++;
      }
    });

    return { complete, total };
  });

  const getOverallColor = () => {
    const overall = smartScoring().overall;
    switch (overall) {
      case 'Low':
      case 'Low (except for concerns about uncontrolled confounding)':
        return 'bg-green-500';
      case 'Moderate':
        return 'bg-yellow-500';
      case 'Serious':
        return 'bg-orange-500';
      case 'Critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getDomainChipColor = domainKey => {
    const domainInfo = smartScoring().domains[domainKey];
    if (!domainInfo?.effective) {
      return 'bg-gray-100 text-gray-500 border-gray-200';
    }

    const judgement = domainInfo.effective;
    const isManual = domainInfo.source === 'manual';

    let baseColor;
    switch (judgement) {
      case 'Low':
      case 'Low (except for concerns about uncontrolled confounding)':
        baseColor = 'bg-green-100 text-green-800 border-green-300';
        break;
      case 'Moderate':
        baseColor = 'bg-yellow-100 text-yellow-800 border-yellow-300';
        break;
      case 'Serious':
        baseColor = 'bg-orange-100 text-orange-800 border-orange-300';
        break;
      case 'Critical':
        baseColor = 'bg-red-100 text-red-800 border-red-300';
        break;
      default:
        baseColor = 'bg-gray-100 text-gray-600 border-gray-300';
    }

    // Add ring for manual override
    if (isManual && domainInfo.isOverridden) {
      return `${baseColor} ring-2 ring-amber-400 ring-offset-1`;
    }

    return baseColor;
  };

  const getDomainShortName = domainKey => {
    switch (domainKey) {
      case 'domain1a':
        return 'D1';
      case 'domain1b':
        return 'D1';
      case 'domain2':
        return 'D2';
      case 'domain3':
        return 'D3';
      case 'domain4':
        return 'D4';
      case 'domain5':
        return 'D5';
      case 'domain6':
        return 'D6';
      default:
        return domainKey;
    }
  };

  const getDomainStatusText = domainKey => {
    const domainInfo = smartScoring().domains[domainKey];
    if (!domainInfo?.effective) {
      return 'Incomplete';
    }

    const judgement = domainInfo.effective;
    const shortJudgement =
      judgement === 'Low (except for concerns about uncontrolled confounding)' ? 'Low*' : judgement;

    if (domainInfo.source === 'manual' && domainInfo.isOverridden) {
      return `${shortJudgement} (manual)`;
    }

    return shortJudgement;
  };

  return (
    <div class='rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
      <div class='flex flex-wrap items-center justify-between gap-4'>
        {/* Overall score section */}
        <div class='flex items-center gap-3'>
          <div class='flex items-center gap-2'>
            <div class={`h-3 w-3 rounded-full ${getOverallColor()}`} />
            <span class='text-sm font-medium text-gray-700'>Overall:</span>
            <span class='text-sm font-semibold text-gray-900'>
              {smartScoring().overall || 'Incomplete'}
            </span>
          </div>
          <span class='text-xs text-gray-400'>|</span>
          <span class='text-xs text-gray-500'>
            {domainStats().complete}/{domainStats().total} domains
          </span>
        </div>

        {/* Domain chips */}
        <div class='flex flex-wrap items-center gap-2'>
          <For each={activeDomains()}>
            {domainKey => (
              <button
                type='button'
                onClick={() => props.onDomainClick?.(domainKey)}
                title={`${ROBINS_I_CHECKLIST[domainKey]?.name}: ${getDomainStatusText(domainKey)}`}
                class={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${getDomainChipColor(domainKey)}`}
              >
                <span>{getDomainShortName(domainKey)}</span>
                <Show when={smartScoring().domains[domainKey]?.source === 'manual'}>
                  <span class='text-amber-600'>*</span>
                </Show>
              </button>
            )}
          </For>

          {/* Resources button */}
          <button
            type='button'
            onClick={() => setResourcesOpen(true)}
            class='ml-2 inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100'
          >
            <FiInfo size={12} />
            Resources
          </button>
        </div>
      </div>

      {/* Resources Dialog */}
      <ResourcesDialog open={resourcesOpen()} onClose={() => setResourcesOpen(false)} />
    </div>
  );
}

/**
 * Resources dialog with links to ROBINS-I guidance
 */
function ResourcesDialog(props) {
  return (
    <Dialog open={props.open} onOpenChange={open => !open && props.onClose()}>
      <Dialog.Backdrop class='fixed inset-0 z-40 bg-black/50' />
      <Dialog.Positioner class='fixed inset-0 z-50 flex items-center justify-center p-4'>
        <Dialog.Content class='max-h-[85vh] w-full max-w-md overflow-auto rounded-lg bg-white shadow-xl'>
          <div class='border-b border-gray-200 px-6 py-4'>
            <Dialog.Title class='text-lg font-semibold text-gray-900'>
              ROBINS-I V2 Resources
            </Dialog.Title>
            <Dialog.Description class='mt-1 text-sm text-gray-500'>
              Official guidance and documentation for the ROBINS-I assessment tool.
            </Dialog.Description>
          </div>

          <div class='space-y-4 px-6 py-4'>
            <ResourceLink
              title='ROBINS-I Tool (Official)'
              description='Risk Of Bias In Non-randomized Studies of Interventions'
              url='https://www.riskofbias.info/welcome/home/current-version-of-robins-i'
            />

            <ResourceLink
              title='Detailed Guidance Document'
              description='Comprehensive guidance for making judgements'
              url='https://www.riskofbias.info/welcome/home/current-version-of-robins-i/robins-i-detailed-guidance-2016'
            />

            <ResourceLink
              title='Cochrane Handbook Chapter'
              description='Chapter 25: Assessing risk of bias in non-randomized studies'
              url='https://training.cochrane.org/handbook/current/chapter-25'
            />

            <div class='rounded-lg bg-gray-50 p-3'>
              <h4 class='text-sm font-medium text-gray-700'>About Auto Scoring</h4>
              <p class='mt-1 text-xs text-gray-600'>
                This tool automatically calculates domain judgements based on your signalling
                question responses, following the official ROBINS-I decision algorithms. You can
                override any automatic judgement if needed.
              </p>
            </div>
          </div>

          <div class='border-t border-gray-200 px-6 py-3'>
            <button
              type='button'
              onClick={() => props.onClose()}
              class='w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'
            >
              Close
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog>
  );
}

function ResourceLink(props) {
  return (
    <a
      href={props.url}
      target='_blank'
      rel='noopener noreferrer'
      class='block rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50'
    >
      <div class='flex items-start justify-between gap-2'>
        <div>
          <h4 class='text-sm font-medium text-gray-900'>{props.title}</h4>
          <p class='mt-0.5 text-xs text-gray-500'>{props.description}</p>
        </div>
        <FiExternalLink class='mt-0.5 shrink-0 text-gray-400' size={14} />
      </div>
    </a>
  );
}

export default ScoringSummary;
