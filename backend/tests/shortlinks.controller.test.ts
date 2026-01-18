import type { FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createShortLink, deleteShortLink, listShortLinks } from '../src/controllers/shortlinks.controller';
import { createReply } from './testUtils';

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

const shortCodeMocks = vi.hoisted(() => ({
  generateShortCode: vi.fn(),
}));

vi.mock('../src/db/client', () => ({
  supabase: supabaseMocks,
}));

vi.mock('../src/utils/shortCode', () => ({
  generateShortCode: shortCodeMocks.generateShortCode,
}));

describe('shortlinks.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shortCodeMocks.generateShortCode.mockReturnValue('abc1234');
  });

  it('rejects requests without user', async () => {
    const request = { body: {} } as FastifyRequest;
    const reply = createReply();

    await createShortLink(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: 'Unauthorized' });
  });

  it('validates missing and invalid URLs', async () => {
    const replyMissing = createReply();
    const requestMissing = { user: { id: 'user-1' }, body: {} } as FastifyRequest;
    await createShortLink(requestMissing, replyMissing);
    expect(replyMissing.statusCode).toBe(400);
    expect(replyMissing.payload).toEqual({ error: 'originalUrl is required' });

    const replyInvalid = createReply();
    const requestInvalid = {
      user: { id: 'user-1' },
      body: { originalUrl: 'not-a-url' },
    } as FastifyRequest;
    await createShortLink(requestInvalid, replyInvalid);
    expect(replyInvalid.statusCode).toBe(400);
    expect(replyInvalid.payload).toEqual({ error: 'originalUrl is invalid' });
  });

  it('rejects invalid shortCode and expiresAt', async () => {
    const replyCode = createReply();
    const requestCode = {
      user: { id: 'user-1' },
      body: { originalUrl: 'https://example.com', shortCode: 'bad code' },
    } as FastifyRequest;
    await createShortLink(requestCode, replyCode);
    expect(replyCode.statusCode).toBe(400);
    expect(replyCode.payload).toEqual({
      error: 'shortCode must be alphanumeric, dash or underscore',
    });

    const replyExpires = createReply();
    const requestExpires = {
      user: { id: 'user-1' },
      body: { originalUrl: 'https://example.com', expiresAt: 'bad-date' },
    } as FastifyRequest;
    await createShortLink(requestExpires, replyExpires);
    expect(replyExpires.statusCode).toBe(400);
    expect(replyExpires.payload).toEqual({ error: 'expiresAt is invalid' });
  });

  it('creates a short link with normalized values', async () => {
    const insert = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'link-1',
        short_code: 'abc1234',
        original_url: 'https://example.com',
        expires_at: '2030-01-01T00:00:00.000Z',
        click_count: 0,
        label: 'Label',
      },
      error: null,
    });

    supabaseMocks.from.mockReturnValue({ insert, select, single });

    const reply = createReply();
    const request = {
      user: { id: 'user-1' },
      body: {
        originalUrl: ' https://example.com ',
        label: ' Label ',
        expiresAt: '2030-01-01',
      },
    } as FastifyRequest;

    await createShortLink(request, reply);

    const [payload] = insert.mock.calls[0];
    expect(payload).toMatchObject({
      user_id: 'user-1',
      original_url: 'https://example.com',
      short_code: 'abc1234',
      label: 'Label',
      expires_at: new Date('2030-01-01').toISOString(),
    });
    expect(reply.statusCode).toBe(201);
  });

  it('handles duplicate shortCodes', async () => {
    const insert = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      });

    supabaseMocks.from.mockReturnValue({ insert, select, single });

    const reply = createReply();
    const request = {
      user: { id: 'user-1' },
      body: { originalUrl: 'https://example.com' },
    } as FastifyRequest;

    await createShortLink(request, reply);

    expect(shortCodeMocks.generateShortCode).toHaveBeenCalledTimes(3);
    expect(reply.statusCode).toBe(409);
    expect(reply.payload).toEqual({ error: 'Could not generate unique shortCode' });
  });

  it('rejects duplicate custom shortCodes', async () => {
    const insert = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    });
    supabaseMocks.from.mockReturnValue({ insert, select, single });

    const reply = createReply();
    const request = {
      user: { id: 'user-1' },
      body: { originalUrl: 'https://example.com', shortCode: 'custom' },
    } as FastifyRequest;

    await createShortLink(request, reply);

    expect(reply.statusCode).toBe(409);
    expect(reply.payload).toEqual({ error: 'shortCode already exists' });
  });

  it('returns 500 on database errors during create', async () => {
    const insert = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'db failure' },
    });
    supabaseMocks.from.mockReturnValue({ insert, select, single });

    const reply = createReply();
    const request = {
      user: { id: 'user-1' },
      body: { originalUrl: 'https://example.com' },
    } as FastifyRequest;

    await createShortLink(request, reply);

    expect(reply.statusCode).toBe(500);
    expect(reply.payload).toEqual({ error: 'db failure' });
  });

  it('lists only the current users links', async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'link-1' }],
      error: null,
    });
    supabaseMocks.from.mockReturnValue({ select, eq, order });

    const reply = createReply();
    const request = { user: { id: 'user-1' } } as FastifyRequest;

    await listShortLinks(request, reply);

    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(reply.payload).toEqual([{ id: 'link-1' }]);
  });

  it('rejects listing without a user', async () => {
    const reply = createReply();
    const request = {} as FastifyRequest;

    await listShortLinks(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload).toEqual({ error: 'Unauthorized' });
  });

  it('handles list errors from the database', async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'db error' },
    });
    supabaseMocks.from.mockReturnValue({ select, eq, order });

    const reply = createReply();
    const request = { user: { id: 'user-1' } } as FastifyRequest;

    await listShortLinks(request, reply);

    expect(reply.statusCode).toBe(500);
    expect(reply.payload).toEqual({ error: 'db error' });
  });

  it('deletes only a users own link', async () => {
    const del = vi.fn().mockReturnThis();
    const eq = vi.fn();
    const builder = { delete: del, eq };
    eq.mockImplementationOnce(() => builder);
    eq.mockResolvedValueOnce({ error: null });
    supabaseMocks.from.mockReturnValue(builder);

    const reply = createReply();
    const request = {
      user: { id: 'user-1' },
      params: { id: 'link-1' },
    } as FastifyRequest;

    await deleteShortLink(request, reply);

    expect(eq).toHaveBeenCalledWith('id', 'link-1');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(reply.statusCode).toBe(204);
  });

  it('rejects deletes without user or id', async () => {
    const replyNoUser = createReply();
    const requestNoUser = { params: { id: 'link-1' } } as FastifyRequest;
    await deleteShortLink(requestNoUser, replyNoUser);
    expect(replyNoUser.statusCode).toBe(401);
    expect(replyNoUser.payload).toEqual({ error: 'Unauthorized' });

    const replyNoId = createReply();
    const requestNoId = { user: { id: 'user-1' }, params: {} } as FastifyRequest;
    await deleteShortLink(requestNoId, replyNoId);
    expect(replyNoId.statusCode).toBe(400);
    expect(replyNoId.payload).toEqual({ error: 'id is required' });
  });

  it('returns 500 when delete fails', async () => {
    const del = vi.fn().mockReturnThis();
    const eq = vi.fn();
    const builder = { delete: del, eq };
    eq.mockImplementationOnce(() => builder);
    eq.mockResolvedValueOnce({ error: { message: 'delete failed' } });
    supabaseMocks.from.mockReturnValue(builder);

    const reply = createReply();
    const request = {
      user: { id: 'user-1' },
      params: { id: 'link-1' },
    } as FastifyRequest;

    await deleteShortLink(request, reply);

    expect(reply.statusCode).toBe(500);
    expect(reply.payload).toEqual({ error: 'delete failed' });
  });
});
