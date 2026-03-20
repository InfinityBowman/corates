/**
 * ROBINSIChecklist - Main ROBINS-I V2 Checklist Component
 *
 * Renders planning, preliminary sections (A-D), domain sections with auto-first
 * scoring and manual override, and overall risk of bias assessment.
 * Assessment stops if Section B indicates Critical risk.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getActiveDomainKeys } from './checklist-map';
import { shouldStopAssessment } from './checklist.js';
import { PlanningSection } from './PlanningSection';
import { SectionA } from './SectionA';
import { SectionB } from './SectionB';
import { SectionC } from './SectionC';
import { SectionD } from './SectionD';
import { DomainSection } from './DomainSection';
import { OverallSection } from './OverallSection';
import { ResponseLegend } from './SignallingQuestion';
import { ScoringSummary } from './ScoringSummary';

interface ROBINSIChecklistProps {
  checklistState: any;
  onUpdate: (_patch: Record<string, any>) => void;
  showComments?: boolean;
  showLegend?: boolean;
  readOnly?: boolean;
  getRobinsText?: (_sectionKey: string, _fieldKey: string, _questionKey?: string) => any;
}

export function ROBINSIChecklist({
  checklistState,
  onUpdate,
  showComments,
  showLegend,
  readOnly,
  getRobinsText,
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

  const stopAssessment = useMemo(
    () => shouldStopAssessment(checklistState?.sectionB),
    [checklistState?.sectionB],
  );

  const isPerProtocol = useMemo(
    () => checklistState?.sectionC?.isPerProtocol || false,
    [checklistState?.sectionC?.isPerProtocol],
  );

  const activeDomains = useMemo(() => getActiveDomainKeys(isPerProtocol), [isPerProtocol]);

  const handleSectionBUpdate = useCallback((v: any) => onUpdate({ sectionB: v }), [onUpdate]);
  const handleSectionCUpdate = useCallback((v: any) => onUpdate({ sectionC: v }), [onUpdate]);
  const handleSectionDUpdate = useCallback((v: any) => onUpdate({ sectionD: v }), [onUpdate]);
  const handleDomainUpdate = useCallback(
    (domainKey: string, newState: any) => onUpdate({ [domainKey]: newState }),
    [onUpdate],
  );
  const handleOverallUpdate = useCallback((v: any) => onUpdate({ overall: v }), [onUpdate]);

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
          {checklistState?.name || 'ROBINS-I Checklist'}
        </div>

        {/* Scoring Summary Strip */}
        {!stopAssessment && (
          <div className='sticky z-40' style={{ top: '8px' }}>
            <ScoringSummary checklistState={checklistState} onDomainClick={handleDomainClick} />
          </div>
        )}

        {/* Response Legend */}
        {showLegend !== false && <ResponseLegend />}

        {/* Planning Stage */}
        <PlanningSection disabled={isReadOnly} getRobinsText={getRobinsText} />

        {/* Preliminary Considerations Header */}
        <div className='rounded-lg border border-blue-200 bg-blue-100 px-6 py-4'>
          <h2 className='text-lg font-semibold text-blue-900'>
            For Each Study Result: Preliminary Considerations (Parts A to D)
          </h2>
        </div>

        <SectionA disabled={isReadOnly} getRobinsText={getRobinsText} />

        <SectionB
          sectionBState={checklistState?.sectionB}
          onUpdate={handleSectionBUpdate}
          disabled={isReadOnly}
          getRobinsText={getRobinsText}
        />

        <SectionC
          sectionCState={checklistState?.sectionC}
          onUpdate={handleSectionCUpdate}
          disabled={isReadOnly}
          getRobinsText={getRobinsText}
        />

        <SectionD
          sectionDState={checklistState?.sectionD}
          onUpdate={handleSectionDUpdate}
          disabled={isReadOnly}
          getRobinsText={getRobinsText}
        />

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
                    domainKey={domainKey}
                    domainState={checklistState?.[domainKey]}
                    onUpdate={newState => handleDomainUpdate(domainKey, newState)}
                    disabled={isReadOnly}
                    showComments={showComments}
                    collapsed={collapsedDomains[domainKey]}
                    onToggleCollapse={() => toggleDomainCollapse(domainKey)}
                    getRobinsText={getRobinsText}
                  />
                </div>
              ))}
            </div>

            <OverallSection
              overallState={checklistState?.overall}
              checklistState={checklistState}
              onUpdate={handleOverallUpdate}
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
