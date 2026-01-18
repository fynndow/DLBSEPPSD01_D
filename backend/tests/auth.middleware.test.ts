import type { FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAuth } from '../src/middleware/auth';
import { createReply } from './testUtils';

const supabaseMocks = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
  },
}));

vi.mock('../src/db/client', () => ({
  supabase: supabaseMocks,
}));

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing bearer token', async () => {
    const request = { headers: {} } as FastifyRequest;
    const reply = createReply();

    await requireAuth(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: 'Missing bearer token' });
  });

  it('rejects invalid tokens', async () => {
    supabaseMocks.auth.getUser.mockResolvedValue({ data: { user: null }, error: {} });
    const request = {
      headers: { authorization: 'Bearer token' },
    } as FastifyRequest;
    const reply = createReply();

    await requireAuth(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: 'Invalid token' });
  });

  it('accepts valid token and attaches user', async () => {
    supabaseMocks.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const request = {
      headers: { authorization: 'Bearer token' },
    } as FastifyRequest;
    const reply = createReply();

    await requireAuth(request, reply);

    expect(request.user?.id).toBe('user-1');
    expect(reply.statusCode).toBe(200);
  });
});
