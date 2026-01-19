import { For, Show, createMemo, createSignal } from 'solid-js';
import { ROBINS_I_CHECKLIST, getActiveDomainKeys } from './checklist-map.js';
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
        return 'bg-muted-foreground/70';
    }
  };

  const getDomainChipColor = domainKey => {
    const domainInfo = smartScoring().domains[domainKey];
    if (!domainInfo?.effective) {
      return 'bg-secondary text-muted-foreground border-border';
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
        baseColor = 'bg-secondary text-muted-foreground border-border';
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
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent class='max-h-[85vh] max-w-md overflow-auto'>
          <div class='border-border border-b px-6 py-4'>
            <DialogTitle>ROBINS-I V2 Resources</DialogTitle>
            <DialogDescription class='mt-1'>
              Official guidance and documentation for the ROBINS-I assessment tool.
            </DialogDescription>
          </div>

          <div class='space-y-4 px-6 py-4'>
            <ResourceLink
              title='ROBINS-I Tool (Official)'
              description='Risk Of Bias In Non-randomized Studies of Interventions'
              url='https://www.riskofbias.info/welcome/robins-i-v2'
            />

            <ResourceLink
              title='Detailed Guidance Document'
              description='Comprehensive guidance for making judgements'
              url='https://drive.google.com/file/d/1zs85KZKFdwGcYwahvldNY_lARNv7Nqsr/view'
            />

            <ResourceLink
              title='Cochrane Handbook Chapter'
              description='Chapter 25: Assessing risk of bias in non-randomized studies'
              url='https://training.cochrane.org/handbook/current/chapter-25'
            />

            <div class='bg-muted rounded-lg p-3'>
              <h4 class='text-secondary-foreground text-sm font-medium'>About Auto Scoring</h4>
              <p class='text-muted-foreground mt-1 text-xs'>
                This tool automatically calculates domain judgements based on your signalling
                question responses, following the official ROBINS-I decision algorithms. You can
                override any automatic judgement if needed.
              </p>
            </div>
          </div>

          <div class='border-border border-t px-6 py-3'>
            <button
              type='button'
              onClick={() => props.onClose()}
              class='bg-secondary text-secondary-foreground hover:bg-muted w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors'
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
