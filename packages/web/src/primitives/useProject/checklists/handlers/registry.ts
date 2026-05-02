import type { ChecklistHandler } from './base';
import { AMSTAR2Handler } from './amstar2';
import { ROB2Handler } from './rob2';
import { ROBINSIHandler } from './robins-i';

const handlers: Record<string, ChecklistHandler> = {
  AMSTAR2: new AMSTAR2Handler(),
  ROB2: new ROB2Handler(),
  ROBINS_I: new ROBINSIHandler(),
};

export function getHandler(checklistType: string): ChecklistHandler | null {
  return handlers[checklistType] ?? null;
}
