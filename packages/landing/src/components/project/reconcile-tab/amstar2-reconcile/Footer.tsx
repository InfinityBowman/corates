/**
 * Footer - Actions for the reconciliation summary view
 */

import { CheckIcon, ArrowLeftIcon } from 'lucide-react';

interface FooterProps {
  onBack: () => void;
  onSave: () => void;
  allAnswered: boolean;
  saving: boolean;
}

export function Footer({ onBack, onSave, allAnswered, saving }: FooterProps) {
  return (
    <div className="border-border bg-muted flex items-center justify-between border-t p-6">
      <button
        onClick={onBack}
        className="bg-card text-secondary-foreground hover:bg-secondary focus:ring-primary flex items-center gap-2 rounded-lg px-4 py-2 font-medium shadow transition-colors focus:ring-2 focus:outline-none"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Questions
      </button>

      <button
        onClick={onSave}
        disabled={!allAnswered || saving}
        className={`flex items-center gap-2 rounded-lg px-6 py-2 font-medium transition-colors focus:outline-none ${
          allAnswered && !saving
            ? 'focus:ring-primary bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2'
            : 'bg-border text-muted-foreground cursor-not-allowed'
        }`}
      >
        {saving ? (
          'Saving...'
        ) : (
          <>
            <CheckIcon className="h-4 w-4" />
            Save Reconciled Checklist
          </>
        )}
      </button>
    </div>
  );
}
