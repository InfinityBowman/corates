import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getActiveDomainKeys } from './checklist-map';
import { PlanningSection } from './PlanningSection';
import { SectionA } from './SectionA';
import { SectionB } from './SectionB';
import { SectionC } from './SectionC';
import { SectionD } from './SectionD';
import { DomainSection } from './DomainSection';
import { OverallSection } from './OverallSection';
import { ResponseLegend } from './SignallingQuestion';
import { ScoringSummary } from './ScoringSummary';
import { useAnswer, useChecklistField } from '@/primitives/useProject/reactor/hooks';

interface ROBINSIChecklistProps {
  studyId: string;
  checklistId: string;
  showComments?: boolean;
  showLegend?: boolean;
  readOnly?: boolean;
}

export function ROBINSIChecklist({
  studyId,
  checklistId,
  showComments,
  showLegend,
  readOnly,
}: ROBINSIChecklistProps) {
  const isReadOnly = !!readOnly;
  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});
  const domainScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (domainScrollTimeoutRef.current !== null) {
        clearTimeout(domainScrollTimeoutRef.current);
      }
    };
  }, []);

  const checklistName = useChecklistField<string>(studyId, checklistId, 'name');
  const b2Answer = useAnswer<string>(studyId, checklistId, 'sectionB.b2');
  const b3Answer = useAnswer<string>(studyId, checklistId, 'sectionB.b3');
  const stopAssessment = useMemo(() => {
    const isYesOrPY = (v: string | null) => v === 'Y' || v === 'PY';
    return isYesOrPY(b2Answer) || isYesOrPY(b3Answer);
  }, [b2Answer, b3Answer]);

  const isPerProtocol = useAnswer<boolean>(studyId, checklistId, 'sectionC.isPerProtocol') === true;
  const activeDomains = useMemo(() => getActiveDomainKeys(isPerProtocol), [isPerProtocol]);

  const toggleDomainCollapse = useCallback((domainKey: string) => {
    setCollapsedDomains(prev => ({ ...prev, [domainKey]: !prev[domainKey] }));
  }, []);

  const handleDomainClick = useCallback((domainKey: string) => {
    setCollapsedDomains(prev => ({ ...prev, [domainKey]: false }));

    if (domainScrollTimeoutRef.current !== null) {
      clearTimeout(domainScrollTimeoutRef.current);
    }
    domainScrollTimeoutRef.current = setTimeout(() => {
      const element = document.getElementById(`domain-section-${domainKey}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      domainScrollTimeoutRef.current = null;
    }, 100);
  }, []);

  return (
    <div className='bg-blue-50'>
      <div className='container mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6'>
        <div className='text-foreground mb-6 text-left text-lg font-semibold sm:text-center'>
          {checklistName || 'ROBINS-I Checklist'}
        </div>

        {/* Scoring Summary Strip */}
        {!stopAssessment && (
          <div className='sticky z-40' style={{ top: '8px' }}>
            <ScoringSummary
              studyId={studyId}
              checklistId={checklistId}
              onDomainClick={handleDomainClick}
            />
          </div>
        )}

        {/* Response Legend */}
        {showLegend !== false && <ResponseLegend />}

        {/* Planning Stage */}
        <PlanningSection studyId={studyId} checklistId={checklistId} disabled={isReadOnly} />

        {/* Preliminary Considerations Header */}
        <div className='rounded-lg border border-blue-200 bg-blue-100 px-6 py-4'>
          <h2 className='text-lg font-semibold text-blue-900'>
            For Each Study Result: Preliminary Considerations (Parts A to D)
          </h2>
        </div>

        <SectionA studyId={studyId} checklistId={checklistId} disabled={isReadOnly} />

        <SectionB studyId={studyId} checklistId={checklistId} disabled={isReadOnly} />

        <SectionC studyId={studyId} checklistId={checklistId} disabled={isReadOnly} />

        <SectionD studyId={studyId} checklistId={checklistId} disabled={isReadOnly} />

        {/* Domain sections - hidden if assessment stopped */}
        {!stopAssessment && (
          <>
            <div className='flex flex-col gap-4'>
              {activeDomains.map((domainKey: string) => (
                <div
                  key={domainKey}
                  id={`domain-section-${domainKey}`}
                  style={{
                    scrollMarginTop:
                      'calc(var(--app-navbar-height, 56px) + var(--robins-summary-height, 0px) + 8px)',
                  }}
                >
                  <DomainSection
                    studyId={studyId}
                    checklistId={checklistId}
                    domainKey={domainKey}
                    disabled={isReadOnly}
                    showComments={showComments}
                    collapsed={collapsedDomains[domainKey]}
                    onToggleCollapse={() => toggleDomainCollapse(domainKey)}
                  />
                </div>
              ))}
            </div>

            <OverallSection
              studyId={studyId}
              checklistId={checklistId}
              disabled={isReadOnly}
            />
          </>
        )}

        {/* Critical risk message when stopped */}
        {stopAssessment && (
          <div className='border-destructive/20 bg-destructive/10 rounded-lg border-2 p-6 text-center'>
            <div className='text-destructive mb-2 text-lg font-semibold'>Critical Risk of Bias</div>
            <p className='text-destructive text-sm'>
              Based on Section B responses, this result has been classified as Critical risk of
              bias. Domain assessment is not required.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
