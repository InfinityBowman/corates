import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientLogger } from '@/lib/clientLogger';
import { createSyncSlowLog, SYNC_SLOW_MS } from '../syncSlowLog';

const info = vi.spyOn(clientLogger, 'info').mockImplementation(() => {});
const warn = vi.spyOn(clientLogger, 'warn').mockImplementation(() => {});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createSyncSlowLog', () => {
  it('logs nothing when the project syncs in time', () => {
    const log = createSyncSlowLog('p1');
    log.update(false);
    vi.advanceTimersByTime(SYNC_SLOW_MS - 1);
    log.update(true);
    vi.advanceTimersByTime(SYNC_SLOW_MS);
    expect(warn).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('logs slow once, then the total wait when it recovers', () => {
    const log = createSyncSlowLog('p1');
    log.update(false);
    log.update(false);
    vi.advanceTimersByTime(SYNC_SLOW_MS);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      'client.sync.slow',
      expect.objectContaining({ projectId: 'p1', waitedMs: SYNC_SLOW_MS }),
    );

    vi.advanceTimersByTime(15_000);
    log.update(true);
    expect(info).toHaveBeenCalledWith('client.sync.recovered', {
      projectId: 'p1',
      waitedMs: SYNC_SLOW_MS + 15_000,
    });
  });

  it('times each drop separately after a recovery', () => {
    const log = createSyncSlowLog('p1');
    log.update(false);
    vi.advanceTimersByTime(SYNC_SLOW_MS);
    log.update(true);
    log.update(false);
    vi.advanceTimersByTime(SYNC_SLOW_MS);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('stops the timer on dispose', () => {
    const log = createSyncSlowLog('p1');
    log.update(false);
    log.dispose();
    vi.advanceTimersByTime(SYNC_SLOW_MS * 2);
    expect(warn).not.toHaveBeenCalled();
  });
});
