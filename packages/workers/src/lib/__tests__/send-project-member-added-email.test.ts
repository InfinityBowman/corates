import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendProjectMemberAddedEmail } from '../send-project-member-added-email';

const mockQueueSend = vi.fn();

vi.mock('@corates/shared/email', () => ({
  queueEmail: vi.fn(async (queue, payload) => {
    await queue.send(payload);
  }),
}));

describe('sendProjectMemberAddedEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueSend.mockResolvedValue(undefined);
  });

  it('queues email with project URL including basepath', async () => {
    const env = {
      APP_URL: 'https://corates.org',
      BASEPATH: '/app',
      ENVIRONMENT: 'production',
      EMAIL_QUEUE: { send: mockQueueSend },
    };

    const result = await sendProjectMemberAddedEmail({
      env: env as never,
      email: 'member@example.com',
      projectId: 'proj-1',
      projectName: 'My Study',
      inviterName: 'Alice',
      role: 'member',
    });

    expect(result.emailQueued).toBe(true);
    expect(mockQueueSend).toHaveBeenCalledOnce();
    const payload = mockQueueSend.mock.calls[0][0];
    expect(payload.to).toBe('member@example.com');
    expect(payload.subject).toContain('My Study');
    expect(payload.text).toContain('https://corates.org/app/projects/proj-1');
    expect(payload.html).toContain('https://corates.org/app/projects/proj-1');
  });

  it('returns emailQueued false when queue send fails', async () => {
    mockQueueSend.mockRejectedValue(new Error('queue unavailable'));

    const result = await sendProjectMemberAddedEmail({
      env: {
        APP_URL: 'https://corates.org',
        BASEPATH: '/',
        ENVIRONMENT: 'production',
        EMAIL_QUEUE: { send: mockQueueSend },
      } as never,
      email: 'member@example.com',
      projectId: 'proj-1',
      projectName: 'My Study',
      inviterName: 'Alice',
      role: 'member',
    });

    expect(result.emailQueued).toBe(false);
  });
});
