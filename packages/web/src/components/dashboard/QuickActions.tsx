/**
 * QuickActions - Quick start cards for creating new appraisals by type
 */

import { useNavigate } from '@tanstack/react-router';
import { PlayCircleIcon } from 'lucide-react';

const ACTIONS = [
  {
    type: 'AMSTAR2',
    title: 'AMSTAR 2',
    description: 'Quality assessment of systematic reviews',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    border: 'border-blue-100 hover:border-blue-200',
  },
  {
    type: 'ROBINS_I',
    title: 'ROBINS-I',
    description: 'Risk of bias in non-randomized studies',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    border: 'border-emerald-100 hover:border-emerald-200',
  },
  {
    type: 'ROB2',
    title: 'RoB 2',
    description: 'Risk of bias in randomized trials',
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
    border: 'border-violet-100 hover:border-violet-200',
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className='grid gap-3 sm:grid-cols-3'>
      {ACTIONS.map(action => (
        <button
          key={action.type}
          type='button'
          onClick={() => navigate({ to: '/checklist' as string, search: { type: action.type } })}
          className={`group bg-card flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-md ${action.border}`}
        >
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${action.iconBg} transition-transform duration-200 group-hover:scale-105`}
          >
            <PlayCircleIcon className={`size-5 ${action.iconColor}`} />
          </div>
          <div className='min-w-0'>
            <h4 className='text-foreground text-sm font-medium'>{action.title}</h4>
            <p className='text-muted-foreground text-xs leading-tight'>{action.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
