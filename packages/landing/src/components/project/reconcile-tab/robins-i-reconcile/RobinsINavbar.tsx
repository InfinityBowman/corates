import { useMemo, useCallback } from 'react';
import { RotateCcwIcon, AlertTriangleIcon } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { NavbarDomainPill } from './NavbarDomainPill';
import {
  getDomainProgress,
  getSectionKeyForPage,
  getFirstUnansweredInSection,
} from './navbar-utils.js';

interface NavItem {
  type: string;
  key: string;
  label: string;
  section: string;
  domainKey?: string;
  isJudgement?: boolean;
  [key: string]: any;
}

interface NavbarStore {
  navItems: NavItem[];
  viewMode: string;
  currentPage: number;
  comparison: any;
  finalAnswers: any;
  expandedDomain: string | null;
  setViewMode: ((_mode: string) => void) | null;
  goToPage: ((_index: number) => void) | null;
  setExpandedDomain: ((_domain: string | null) => void) | null;
  onReset: (() => void) | null;
  sectionBCritical: boolean;
}

interface RobinsINavbarProps {
  store: NavbarStore;
}

export function RobinsINavbar({ store }: RobinsINavbarProps) {
  const domainProgress = useMemo(
    () => getDomainProgress(store.navItems || [], store.finalAnswers, store.comparison),
    [store.navItems, store.finalAnswers, store.comparison],
  );

  const sectionKeys = useMemo(() => Object.keys(domainProgress), [domainProgress]);

  const currentSectionKey = useMemo(
    () => getSectionKeyForPage(store.navItems || [], store.currentPage),
    [store.navItems, store.currentPage],
  );

  const handleDomainClick = useCallback(
    (sectionKey: string) => {
      const isCurrentlyExpanded = store.expandedDomain === sectionKey;
      if (isCurrentlyExpanded) return;

      store.setExpandedDomain?.(sectionKey);

      const progress = (domainProgress as Record<string, any>)[sectionKey];
      if (progress && store.navItems) {
        const targetIndex = getFirstUnansweredInSection(
          progress,
          store.navItems,
          store.finalAnswers,
        );
        if (targetIndex >= 0) {
          store.goToPage?.(targetIndex);
        }
      }
    },
    [store, domainProgress],
  );

  const handleGoToPage = useCallback(
    (pageIndex: number) => {
      const sectionKey = getSectionKeyForPage(store.navItems || [], pageIndex);
      if (sectionKey && sectionKey !== store.expandedDomain) {
        store.setExpandedDomain?.(sectionKey);
      }
      store.goToPage?.(pageIndex);
    },
    [store],
  );

  return (
    <nav className='flex items-center gap-1 px-1 py-1.5' aria-label='Question navigation'>
      {/* Critical Risk Warning */}
      {store.sectionBCritical && (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <div className='mr-1 flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700'>
              <AlertTriangleIcon className='size-3' />
              Critical
            </div>
          </TooltipTrigger>
          <TooltipContent side='bottom'>Section B indicates Critical Risk</TooltipContent>
        </Tooltip>
      )}

      {/* Domain pills with expandable groups */}
      {sectionKeys.map(sectionKey => (
        <div key={sectionKey} className='shrink-0'>
          <NavbarDomainPill
            sectionKey={sectionKey}
            progress={(domainProgress as Record<string, any>)[sectionKey]}
            isExpanded={store.expandedDomain === sectionKey}
            isCurrentDomain={currentSectionKey === sectionKey}
            onClick={() => handleDomainClick(sectionKey)}
            allNavItems={store.navItems}
            currentPage={store.currentPage}
            goToPage={handleGoToPage}
            comparison={store.comparison}
            finalAnswers={store.finalAnswers}
          />
        </div>
      ))}

      {/* Separator before summary/reset */}
      <span className='text-border mx-1 shrink-0'>|</span>

      <div className='flex shrink-0 items-center gap-1'>
        <SummaryButton store={store} />
        <ResetButton onClick={() => store.onReset?.()} />
      </div>
    </nav>
  );
}

function SummaryButton({ store }: { store: NavbarStore }) {
  const isActive = store.viewMode === 'summary';

  const buttonStyle =
    isActive ?
      'bg-blue-600 text-white ring-2 ring-blue-300'
    : 'bg-secondary text-muted-foreground hover:bg-border';

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type='button'
          onClick={() => store.setViewMode?.('summary')}
          className={`h-7 rounded-full px-3 text-xs font-medium transition-all ${buttonStyle}`}
          aria-label='View summary'
          aria-current={isActive ? 'page' : undefined}
        >
          Summary
        </button>
      </TooltipTrigger>
      <TooltipContent side='bottom'>View summary of all items</TooltipContent>
    </Tooltip>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type='button'
          onClick={onClick}
          className='flex h-7 items-center gap-1 rounded-full bg-red-100 px-2 text-xs font-medium text-red-700 transition-all hover:bg-red-200'
          aria-label='Reset reconciliation'
        >
          <RotateCcwIcon className='size-2.5' />
          Reset
        </button>
      </TooltipTrigger>
      <TooltipContent side='bottom'>Reset all final answers</TooltipContent>
    </Tooltip>
  );
}
