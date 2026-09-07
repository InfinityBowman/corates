// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLocalAppraisalCompletion } from '../useLocalAppraisalCompletion';

vi.mock('@/lib/clientLogger', () => ({
  clientLogger: { info: vi.fn(), warn: vi.fn() },
}));

const { clientLogger } = await import('@/lib/clientLogger');
const info = vi.mocked(clientLogger.info);

function render(initialScore: string | null, checklistId = 'cl-1') {
  return renderHook(
    ({ score }: { score: string | null }) =>
      useLocalAppraisalCompletion(checklistId, 'AMSTAR2', score),
    { initialProps: { score: initialScore } },
  );
}

describe('useLocalAppraisalCompletion', () => {
  beforeEach(() => {
    localStorage.clear();
    info.mockClear();
  });

  it('emits once when the score first becomes computable', () => {
    const hook = render(null);
    expect(info).not.toHaveBeenCalled();

    hook.rerender({ score: 'High' });
    expect(info).toHaveBeenCalledExactlyOnceWith('client.local_appraisal.completed', {
      type: 'AMSTAR2',
    });

    hook.rerender({ score: 'Moderate' });
    hook.rerender({ score: null });
    hook.rerender({ score: 'Low' });
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('does not re-emit for a checklist completed in an earlier session', () => {
    render(null).rerender({ score: 'High' });
    expect(info).toHaveBeenCalledTimes(1);

    const later = render(null);
    later.rerender({ score: 'High' });
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('ignores a checklist that is already complete when opened', () => {
    render('High');
    expect(info).not.toHaveBeenCalled();
  });

  it('tracks checklists independently', () => {
    render(null, 'cl-1').rerender({ score: 'High' });
    render(null, 'cl-2').rerender({ score: 'Low' });
    expect(info).toHaveBeenCalledTimes(2);
  });
});
