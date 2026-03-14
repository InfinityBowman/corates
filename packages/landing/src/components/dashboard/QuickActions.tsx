/**
 * QuickActions - Quick start cards for creating new appraisals
 */

import { PlayCircleIcon, BookOpenIcon } from 'lucide-react';
import { useAnimation } from './useInitialAnimation';

interface QuickActionsProps {
  onStartROBINSI: () => void;
  onStartAMSTAR2: () => void;
  onLearnMore: () => void;
}

const ACTIONS = [
  {
    id: 'robins-i',
    title: 'Start ROBINS-I',
    description: 'Risk of bias for non-randomized studies',
    icon: <PlayCircleIcon className="h-6 w-6 text-blue-600" />,
    iconBg: 'bg-blue-50',
    border: 'border-blue-100 hover:border-blue-200',
  },
  {
    id: 'amstar-2',
    title: 'Start AMSTAR 2',
    description: 'Quality assessment for systematic reviews',
    icon: <PlayCircleIcon className="h-6 w-6 text-emerald-600" />,
    iconBg: 'bg-emerald-50',
    border: 'border-emerald-100 hover:border-emerald-200',
  },
  {
    id: 'learn-more',
    title: 'Learn More',
    description: 'View documentation and guides',
    icon: <BookOpenIcon className="h-6 w-6 text-violet-600" />,
    iconBg: 'bg-violet-50',
    border: 'border-violet-100 hover:border-violet-200',
  },
];

export function QuickActions({ onStartROBINSI, onStartAMSTAR2, onLearnMore }: QuickActionsProps) {
  const animation = useAnimation();

  const handlers: Record<string, () => void> = {
    'robins-i': onStartROBINSI,
    'amstar-2': onStartAMSTAR2,
    'learn-more': onLearnMore,
  };

  return (
    <section className="mb-6" style={animation.fadeUp(400)}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Quick Start
      </h3>
      <div className="grid gap-3">
        {ACTIONS.map(action => (
          <button
            key={action.id}
            type="button"
            onClick={handlers[action.id]}
            className={`group flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:shadow-md ${action.border}`}
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${action.iconBg} transition-transform duration-200 group-hover:scale-105`}>
              {action.icon}
            </div>
            <div>
              <h4 className="font-medium text-foreground">{action.title}</h4>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
