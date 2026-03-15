import { useMemo } from 'react';
import { CheckIcon, XIcon, ChevronRightIcon, ArrowLeftIcon } from 'lucide-react';
import {
  hasNavItemAnswer,
  isNavItemAgreement,
  getGroupedNavigationItems,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';

/**
 * Get display value for a preliminary field
 */
function getPreliminaryDisplayValue(key: string, finalAnswers: any): string {
  const value = finalAnswers?.preliminary?.[key];
  if (value === null || value === undefined || value === '') return 'Not set';

  if (key === 'deviationsToAddress' && Array.isArray(value)) {
    return value.length > 0 ? `${value.length} selected` : 'None selected';
  }
  if (key === 'sources' && typeof value === 'object') {
    const count = Object.values(value || {}).filter(Boolean).length;
    return count > 0 ? `${count} selected` : 'None selected';
  }
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }
  return value;
}

/**
 * Get display value for a domain question
 */
function getDomainQuestionDisplayValue(
  domainKey: string,
  questionKey: string,
  finalAnswers: any,
): string {
  const answer = finalAnswers?.[domainKey]?.answers?.[questionKey]?.answer;
  return answer || 'Not set';
}

/**
 * Get display value for a direction
 */
function getDirectionDisplayValue(domainKey: string, finalAnswers: any): string {
  if (domainKey === 'overall') {
    return finalAnswers?.overall?.direction || 'Not set';
  }
  return finalAnswers?.[domainKey]?.direction || 'Not set';
}

interface SummaryStats {
  total: number;
  agreed: number;
  disagreed: number;
  agreementPercentage: number;
  answered: number;
}

interface ROB2SummaryViewProps {
  navItems: any[];
  finalAnswers: any;
  comparison: any;
  summary: SummaryStats;
  onGoToPage: (_index: number) => void;
  onSave: () => void;
  onBack: () => void;
  allAnswered: boolean;
  saving: boolean;
}

/**
 * Get display value for any nav item
 */
function getDisplayValue(item: any, finalAnswers: any): string {
  if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
    return getPreliminaryDisplayValue(item.key, finalAnswers);
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
    return getDomainQuestionDisplayValue(item.domainKey, item.key, finalAnswers);
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION) {
    return getDirectionDisplayValue(item.domainKey, finalAnswers);
  }
  if (item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
    return getDirectionDisplayValue('overall', finalAnswers);
  }
  return 'N/A';
}

/**
 * ROB2SummaryView - Summary view showing all items before final save
 */
export function ROB2SummaryView({
  navItems,
  finalAnswers,
  comparison,
  summary,
  onGoToPage,
  onSave,
  onBack,
  allAnswered,
  saving,
}: ROB2SummaryViewProps) {
  const groups = useMemo(() => getGroupedNavigationItems(navItems), [navItems]);

  const getItemIndex = (item: any) => navItems.indexOf(item);

  return (
    <div className="bg-card rounded-xl shadow-lg">
      {/* Header */}
      <div className="bg-muted border-b p-6">
        <h2 className="text-foreground text-xl font-bold">Reconciliation Summary</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Review all reconciled items before saving. Click any item to edit.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 border-b p-6">
        <div className="bg-muted rounded-lg p-4 text-center">
          <div className="text-foreground text-2xl font-bold">{summary?.total || 0}</div>
          <div className="text-muted-foreground text-sm">Total Items</div>
        </div>
        <div className="rounded-lg bg-green-50 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{summary?.agreed || 0}</div>
          <div className="text-sm text-green-600">Agreements</div>
        </div>
        <div className="rounded-lg bg-amber-50 p-4 text-center">
          <div className="text-2xl font-bold text-amber-700">{summary?.disagreed || 0}</div>
          <div className="text-sm text-amber-600">Disagreements</div>
        </div>
        <div className="rounded-lg bg-blue-50 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">
            {summary?.agreementPercentage || 0}%
          </div>
          <div className="text-sm text-blue-600">Agreement Rate</div>
        </div>
      </div>

      {/* Grouped Items List */}
      <div className="divide-y">
        {groups.map((group: any) => (
          <div key={group.section}>
            {/* Section Header */}
            <div className="bg-muted px-6 py-3">
              <h3 className="text-secondary-foreground text-sm font-semibold">{group.section}</h3>
            </div>

            {/* Section Items */}
            <div className="divide-border-subtle divide-y">
              {group.items.map((item: any) => {
                const hasAnswer = hasNavItemAnswer(item, finalAnswers);
                const agreement = isNavItemAgreement(item, comparison);
                const displayVal = getDisplayValue(item, finalAnswers);

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onGoToPage?.(getItemIndex(item))}
                    className="hover:bg-muted flex w-full items-center gap-4 px-6 py-3 text-left transition-colors"
                  >
                    {/* Status Icon */}
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        agreement
                          ? 'bg-green-100 text-green-600'
                          : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      {agreement ? (
                        <CheckIcon className="h-3.5 w-3.5" />
                      ) : (
                        <XIcon className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Item Label */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground text-sm font-medium">{item.label}</span>
                        {item.isDirection && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                            Direction
                          </span>
                        )}
                      </div>
                      {item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && item.questionDef?.text && (
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {item.questionDef.text}
                        </p>
                      )}
                    </div>

                    {/* Final Answer Badge */}
                    <div className="flex items-center gap-2">
                      {hasAnswer ? (
                        <>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION
                                ? displayVal === 'Y'
                                  ? 'bg-green-100 text-green-700'
                                  : displayVal === 'PY'
                                    ? 'bg-lime-100 text-lime-700'
                                    : displayVal === 'PN'
                                      ? 'bg-amber-100 text-amber-700'
                                      : displayVal === 'N'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-secondary text-secondary-foreground'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {displayVal}
                          </span>
                          <CheckIcon className="h-4 w-4 text-green-500" />
                        </>
                      ) : (
                        <span className="bg-secondary text-muted-foreground rounded-full px-2 py-1 text-xs">
                          Not set
                        </span>
                      )}
                    </div>

                    {/* Chevron */}
                    <ChevronRightIcon className="text-muted-foreground/70 h-4 w-4 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t p-6">
        <button
          type="button"
          onClick={() => onBack?.()}
          className="bg-secondary text-secondary-foreground hover:bg-border flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Questions
        </button>

        <div className="flex items-center gap-4">
          <div className="text-muted-foreground text-sm">
            {summary?.answered || 0} of {summary?.total || 0} items reconciled
          </div>

          <button
            type="button"
            onClick={() => onSave?.()}
            disabled={!allAnswered || saving}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
              allAnswered && !saving
                ? 'bg-green-600 text-white shadow hover:bg-green-700'
                : 'bg-border text-muted-foreground/70 cursor-not-allowed'
            }`}
          >
            <CheckIcon className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Reconciled Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
}
