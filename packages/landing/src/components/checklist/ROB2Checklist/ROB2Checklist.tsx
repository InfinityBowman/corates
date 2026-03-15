/**
 * ROB2Checklist - Main ROB-2 Checklist Component
 *
 * Renders preliminary considerations, domain sections with auto-scoring,
 * and overall risk of bias assessment.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getActiveDomainKeys } from './checklist-map';
import { PreliminarySection } from './PreliminarySection';
import { DomainSection } from './DomainSection';
import { OverallSection } from './OverallSection';
import { ResponseLegend } from './SignallingQuestion';
import { ScoringSummary } from './ScoringSummary';

interface ROB2ChecklistProps {
  checklistState: any;
  onUpdate: (_patch: Record<string, any>) => void;
  showComments?: boolean;
  showLegend?: boolean;
  readOnly?: boolean;
  getRob2Text?: (_sectionKey: string, _fieldKey: string, _questionKey?: string) => any;
}

export function ROB2Checklist({
  checklistState,
  onUpdate,
  showComments,
  showLegend,
  readOnly,
  getRob2Text,
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

  const isAdhering = useMemo(
    () => checklistState?.preliminary?.aim === 'ADHERING',
    [checklistState?.preliminary?.aim],
  );
  const activeDomains = useMemo(() => getActiveDomainKeys(isAdhering), [isAdhering]);
  const hasAimSelected = !!checklistState?.preliminary?.aim;

  const handlePreliminaryUpdate = useCallback(
    (newPreliminary: any) => onUpdate({ preliminary: newPreliminary }),
    [onUpdate],
  );

  const handleDomainUpdate = useCallback(
    (domainKey: string, newDomainState: any) => onUpdate({ [domainKey]: newDomainState }),
    [onUpdate],
  );

  const handleOverallUpdate = useCallback(
    (newOverall: any) => onUpdate({ overall: newOverall }),
    [onUpdate],
  );

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
    <div className="bg-blue-50">
      <div className="container mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div className="text-foreground mb-6 text-left text-lg font-semibold sm:text-center">
          {checklistState?.name || 'RoB 2 Checklist'}
        </div>

        {/* Scoring Summary Strip */}
        {hasAimSelected && (
          <div className="sticky z-40" style={{ top: '8px' }}>
            <ScoringSummary
              checklistState={checklistState}
              onDomainClick={handleDomainClick}
            />
          </div>
        )}

        {/* Response Legend */}
        {showLegend !== false && <ResponseLegend />}

        {/* Preliminary Considerations */}
        <PreliminarySection
          preliminaryState={checklistState?.preliminary}
          onUpdate={handlePreliminaryUpdate}
          disabled={isReadOnly}
          getRob2Text={getRob2Text}
        />

        {/* Message when aim not selected */}
        {!hasAimSelected && (
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-6 text-center">
            <div className="mb-2 text-lg font-semibold text-blue-800">Select Assessment Aim</div>
            <p className="text-sm text-blue-600">
              Please select the review team's aim in the Preliminary Considerations section above to
              proceed with the domain assessment.
            </p>
          </div>
        )}

        {/* Domain sections */}
        {hasAimSelected && (
          <>
            <div className="space-y-4">
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
                    getRob2Text={getRob2Text}
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
      </div>
    </div>
  );
}
