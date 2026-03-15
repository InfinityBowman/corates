/**
 * ScoringSummary - Compact scoring strip for ROB-2 checklist
 * Shows overall calculated judgement and clickable domain status chips
 */

import { useState, useMemo } from 'react';
import { InfoIcon, ExternalLinkIcon } from 'lucide-react';
import { ROB2_CHECKLIST, getActiveDomainKeys } from './checklist-map';
import { getSmartScoring } from './checklist.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ScoringSummaryProps {
  checklistState: any;
  onDomainClick?: (_domainKey: string) => void;
}

export function ScoringSummary({ checklistState, onDomainClick }: ScoringSummaryProps) {
  const [resourcesOpen, setResourcesOpen] = useState(false);

  const smartScoring = useMemo(() => getSmartScoring(checklistState), [checklistState]);
  const isAdhering = checklistState?.preliminary?.aim === 'ADHERING';
  const activeDomains = useMemo(() => getActiveDomainKeys(isAdhering), [isAdhering]);

  const domainStats = useMemo(() => {
    let complete = 0;
    const total = activeDomains.length;
    activeDomains.forEach((domainKey: string) => {
      if (smartScoring.domains[domainKey]?.effective) complete++;
    });
    return { complete, total };
  }, [smartScoring, activeDomains]);

  const getOverallColor = () => {
    switch (smartScoring.overall) {
      case 'Low': return 'bg-green-500';
      case 'Some concerns': return 'bg-yellow-500';
      case 'High': return 'bg-red-500';
      default: return 'bg-muted-foreground/70';
    }
  };

  const getDomainChipColor = (domainKey: string) => {
    const domainInfo = smartScoring.domains[domainKey];
    if (!domainInfo?.effective) return 'bg-secondary text-muted-foreground border-border';
    switch (domainInfo.effective) {
      case 'Low': return 'bg-green-100 text-green-800 border-green-300';
      case 'Some concerns': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'High': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-secondary text-muted-foreground border-border';
    }
  };

  const getDomainShortName = (domainKey: string) => {
    const map: Record<string, string> = {
      domain1: 'D1', domain2a: 'D2', domain2b: 'D2',
      domain3: 'D3', domain4: 'D4', domain5: 'D5',
    };
    return map[domainKey] || domainKey;
  };

  const getDomainStatusText = (domainKey: string) => {
    const domainInfo = smartScoring.domains[domainKey];
    return domainInfo?.effective || 'Incomplete';
  };

  return (
    <div className="border-border bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Overall score */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${getOverallColor()}`} />
            <span className="text-secondary-foreground text-sm font-medium">Overall:</span>
            <span className="text-foreground text-sm font-semibold">
              {smartScoring.overall || 'Incomplete'}
            </span>
          </div>
          <span className="text-muted-foreground/70 text-xs">|</span>
          <span className="text-muted-foreground text-xs">
            {domainStats.complete}/{domainStats.total} domains
          </span>
        </div>

        {/* Domain chips */}
        <div className="flex flex-wrap items-center gap-2">
          {activeDomains.map((domainKey: string) => (
            <button
              key={domainKey}
              type="button"
              onClick={() => onDomainClick?.(domainKey)}
              title={`${(ROB2_CHECKLIST as any)[domainKey]?.name}: ${getDomainStatusText(domainKey)}`}
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${getDomainChipColor(domainKey)}`}
            >
              <span>{getDomainShortName(domainKey)}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setResourcesOpen(true)}
            className="ml-2 inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <InfoIcon className="h-3 w-3" />
            Resources
          </button>
        </div>
      </div>

      <ResourcesDialog open={resourcesOpen} onClose={() => setResourcesOpen(false)} />
    </div>
  );
}

function ResourcesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={openState => !openState && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-auto">
        <DialogHeader>
          <DialogTitle>ROB-2 Resources</DialogTitle>
          <DialogDescription>
            Official guidance and documentation for the RoB 2 assessment tool.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <ResourceLink
            title="RoB 2 Tool (Official)"
            description="Risk of Bias 2 - Assessing risk of bias in randomized trials"
            url="https://www.riskofbias.info/welcome/rob-2-0-tool"
          />
          <ResourceLink
            title="Detailed Guidance Document"
            description="Comprehensive guidance for making judgements"
            url="https://drive.google.com/file/d/19R9savfPdCHC8XLz2iiMvL_71lPJERWK/view"
          />
          <ResourceLink
            title="Cochrane Handbook Chapter"
            description="Chapter 8: Assessing risk of bias in included studies"
            url="https://training.cochrane.org/handbook/current/chapter-08"
          />
          <div className="bg-muted rounded-lg p-3">
            <h4 className="text-secondary-foreground text-sm font-medium">About Auto Scoring</h4>
            <p className="text-muted-foreground mt-1 text-xs">
              This tool automatically calculates domain judgements based on your signalling
              question responses, following the official RoB 2 decision algorithms.
            </p>
          </div>
        </div>

        <div className="border-border border-t pt-3">
          <button
            type="button"
            onClick={onClose}
            className="text-secondary-foreground bg-secondary hover:bg-muted w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResourceLink({ title, description, url }: { title: string; description: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border block rounded-lg border p-3 transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-foreground text-sm font-medium">{title}</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        </div>
        <ExternalLinkIcon className="text-muted-foreground/70 mt-0.5 h-3.5 w-3.5 shrink-0" />
      </div>
    </a>
  );
}
