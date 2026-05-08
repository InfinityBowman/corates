import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getActiveDomainKeys } from './checklist-map';
import { PreliminarySection } from './PreliminarySection';
import { DomainSection } from './DomainSection';
import { OverallSection } from './OverallSection';
import { ResponseLegend } from './SignallingQuestion';
import { ScoringSummary } from './ScoringSummary';
import { useAnswer, useChecklistField } from '@/primitives/useProject/reactor/hooks';

interface ROB2ChecklistProps {
  studyId: string;
  checklistId: string;
  showComments?: boolean;
  showLegend?: boolean;
  readOnly?: boolean;
}

export function ROB2Checklist({
  studyId,
  checklistId,
  showComments,
  showLegend,
  readOnly,
}: ROB2ChecklistProps) {
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

  const aim = useAnswer<string>(studyId, checklistId, 'preliminary.aim');
  const checklistName = useChecklistField<string>(studyId, checklistId, 'name');
  const isAdhering = aim === 'ADHERING';
  const activeDomains = useMemo(() => getActiveDomainKeys(isAdhering), [isAdhering]);
  const hasAimSelected = !!aim;

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
          {checklistName || 'RoB 2 Checklist'}
        </div>

        {/* Scoring Summary Strip */}
        {hasAimSelected && (
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

        {/* Preliminary Considerations */}
        <PreliminarySection studyId={studyId} checklistId={checklistId} disabled={isReadOnly} />

        {/* Message when aim not selected */}
        {!hasAimSelected && (
          <div className='border-info-border bg-info-bg rounded-lg border-2 p-6 text-center'>
            <div className='text-info-foreground mb-2 text-lg font-semibold'>
              Select Assessment Aim
            </div>
            <p className='text-info text-sm'>
              Please select the review team's aim in the Preliminary Considerations section above to
              proceed with the domain assessment.
            </p>
          </div>
        )}

        {/* Domain sections */}
        {hasAimSelected && (
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

            <OverallSection studyId={studyId} checklistId={checklistId} disabled={isReadOnly} />
          </>
        )}
      </div>
    </div>
  );
}
