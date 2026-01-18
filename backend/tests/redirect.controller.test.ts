import type { FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectShortCode } from '../src/controllers/redirect.controller';
import { createReply } from './testUtils';

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  supabase: supabaseMocks,
}));

describe('redirect.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when shortCode is missing', async () => {
    const request = { params: {} } as FastifyRequest;
    const reply = createReply();

    await redirectShortCode(request, reply);

    expect(reply.statusCode).toBe(400);
    expect(reply.payload).toEqual({ error: 'shortCode is required' });
  });

  it('returns 404 when short link is not found', async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    supabaseMocks.from.mockReturnValue({ select, eq, maybeSingle });

    const request = { params: { shortCode: 'abc' } } as FastifyRequest;
    const reply = createReply();

    await redirectShortCode(request, reply);

    expect(reply.statusCode).toBe(404);
    expect(reply.payload).toEqual({ error: 'Short link not found' });
  });

  it('returns 500 on database errors', async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'db down' },
    });
    supabaseMocks.from.mockReturnValue({ select, eq, maybeSingle });

    const request = { params: { shortCode: 'abc' } } as FastifyRequest;
    const reply = createReply();

    await redirectShortCode(request, reply);

    expect(reply.statusCode).toBe(500);
    expect(reply.payload).toEqual({ error: 'db down' });
  });

  it('returns 410 for expired links', async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'link-1',
        original_url: 'https://example.com',
        expires_at: new Date(Date.now() - 1000).toISOString(),
        click_count: 0,
      },
      error: null,
    });
    supabaseMocks.from.mockReturnValue({ select, eq, maybeSingle });

    const request = { params: { shortCode: 'abc' } } as FastifyRequest;
    const reply = createReply();

    await redirectShortCode(request, reply);

    expect(reply.statusCode).toBe(410);
    expect(reply.payload).toEqual({ error: 'Short link expired' });
  });

  it('increments click count and redirects', async () => {
    const now = new Date(Date.now() + 10000).toISOString();

    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'link-1',
        original_url: 'https://example.com',
        expires_at: now,
        click_count: 3,
      },
      error: null,
    });

    const update = vi.fn().mockReturnThis();
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const shortLinksUpdateBuilder = { update, eq: updateEq };

    const clicksInsert = vi.fn().mockResolvedValue({ error: null });
    const clicksBuilder = { insert: clicksInsert };

    let shortLinksCall = 0;
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === 'short_links') {
        shortLinksCall += 1;
        return shortLinksCall === 1
          ? { select, eq, maybeSingle }
          : shortLinksUpdateBuilder;
      }
      if (table === 'clicks') {
        return clicksBuilder;
      }
      return {};
    });

    const request = {
      params: { shortCode: 'abc' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
      log: { error: vi.fn() },
    } as FastifyRequest;
    const reply = createReply();

    await redirectShortCode(request, reply);

    expect(update).toHaveBeenCalledWith({ click_count: 4 });
    expect(clicksInsert).toHaveBeenCalledWith({
      short_link_id: 'link-1',
      ip_address: '127.0.0.1',
      user_agent: 'test-agent',
    });
    expect(reply.redirectedTo).toBe('https://example.com');
  });
});
