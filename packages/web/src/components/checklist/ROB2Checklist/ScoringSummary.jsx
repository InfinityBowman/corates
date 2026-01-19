import { For, createMemo, createSignal } from 'solid-js';
import { ROB2_CHECKLIST, getActiveDomainKeys } from './checklist-map.js';
import { getSmartScoring } from './checklist.js';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FiExternalLink, FiInfo } from 'solid-icons/fi';

/**
 * Compact scoring summary strip for ROB-2 checklist
 * Shows overall calculated judgement and domain status chips
 *
 * @param {Object} props
 * @param {Object} props.checklistState - Full checklist state
 * @param {Function} [props.onDomainClick] - Callback when a domain chip is clicked
 */
export function ScoringSummary(props) {
  const [resourcesOpen, setResourcesOpen] = createSignal(false);

  const smartScoring = createMemo(() => getSmartScoring(props.checklistState));

  const isAdhering = () => props.checklistState?.preliminary?.aim === 'ADHERING';
  const activeDomains = createMemo(() => getActiveDomainKeys(isAdhering()));

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
        return 'bg-green-500';
      case 'Some concerns':
        return 'bg-yellow-500';
      case 'High':
        return 'bg-red-500';
      default:
        return 'bg-muted-foreground/70';
    }
  };

  const getDomainChipColor = domainKey => {
    const domainInfo = smartScoring().domains[domainKey];
    if (!domainInfo?.effective) {
      return 'bg-secondary text-muted-foreground border-border';
    }

    const judgement = domainInfo.effective;

    switch (judgement) {
      case 'Low':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Some concerns':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'High':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-secondary text-muted-foreground border-border';
    }
  };

  const getDomainShortName = domainKey => {
    switch (domainKey) {
      case 'domain1':
        return 'D1';
      case 'domain2a':
        return 'D2';
      case 'domain2b':
        return 'D2';
      case 'domain3':
        return 'D3';
      case 'domain4':
        return 'D4';
      case 'domain5':
        return 'D5';
      default:
        return domainKey;
    }
  };

  const getDomainStatusText = domainKey => {
    const domainInfo = smartScoring().domains[domainKey];
    if (!domainInfo?.effective) {
      return 'Incomplete';
    }
    return domainInfo.effective;
  };

  return (
    <div class='border-border bg-card rounded-lg border p-4 shadow-sm'>
      <div class='flex flex-wrap items-center justify-between gap-4'>
        {/* Overall score section */}
        <div class='flex items-center gap-3'>
          <div class='flex items-center gap-2'>
            <div class={`h-3 w-3 rounded-full ${getOverallColor()}`} />
            <span class='text-secondary-foreground text-sm font-medium'>Overall:</span>
            <span class='text-foreground text-sm font-semibold'>
              {smartScoring().overall || 'Incomplete'}
            </span>
          </div>
          <span class='text-muted-foreground/70 text-xs'>|</span>
          <span class='text-muted-foreground text-xs'>
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
                title={`${ROB2_CHECKLIST[domainKey]?.name}: ${getDomainStatusText(domainKey)}`}
                class={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${getDomainChipColor(domainKey)}`}
              >
                <span>{getDomainShortName(domainKey)}</span>
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
 * Resources dialog with links to ROB-2 guidance
 */
function ResourcesDialog(props) {
  return (
    <Dialog open={props.open} onOpenChange={open => !open && props.onClose?.()}>
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent class='max-h-[85vh] max-w-md overflow-auto'>
          <div class='border-border border-b px-6 py-4'>
            <DialogTitle>ROB-2 Resources</DialogTitle>
            <DialogDescription class='mt-1'>
              Official guidance and documentation for the RoB 2 assessment tool.
            </DialogDescription>
          </div>

          <div class='space-y-4 px-6 py-4'>
            <ResourceLink
              title='RoB 2 Tool (Official)'
              description='Risk of Bias 2 - Assessing risk of bias in randomized trials'
              url='https://www.riskofbias.info/welcome/rob-2-0-tool'
            />

            <ResourceLink
              title='Detailed Guidance Document'
              description='Comprehensive guidance for making judgements'
              url='https://drive.google.com/file/d/19R9savfPdCHC8XLz2iiMvL_71lPJERWK/view'
            />

            <ResourceLink
              title='Cochrane Handbook Chapter'
              description='Chapter 8: Assessing risk of bias in included studies'
              url='https://training.cochrane.org/handbook/current/chapter-08'
            />

            <div class='bg-muted rounded-lg p-3'>
              <h4 class='text-secondary-foreground text-sm font-medium'>About Auto Scoring</h4>
              <p class='text-muted-foreground mt-1 text-xs'>
                This tool automatically calculates domain judgements based on your signalling
                question responses, following the official RoB 2 decision algorithms.
              </p>
            </div>
          </div>

          <div class='border-border border-t px-6 py-3'>
            <button
              type='button'
              onClick={() => props.onClose()}
              class='text-secondary-foreground bg-secondary hover:bg-muted w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors'
            >
              Close
            </button>
          </div>
        </DialogContent>
      </DialogPositioner>
    </Dialog>
  );
}

function ResourceLink(props) {
  return (
    <a
      href={props.url}
      target='_blank'
      rel='noopener noreferrer'
      class='border-border block rounded-lg border p-3 transition-colors hover:border-blue-300 hover:bg-blue-50'
    >
      <div class='flex items-start justify-between gap-2'>
        <div>
          <h4 class='text-foreground text-sm font-medium'>{props.title}</h4>
          <p class='text-muted-foreground mt-0.5 text-xs'>{props.description}</p>
        </div>
        <FiExternalLink class='text-muted-foreground/70 mt-0.5 shrink-0' size={14} />
      </div>
    </a>
  );
}

export default ScoringSummary;
