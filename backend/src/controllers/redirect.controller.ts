import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../db/client';

type RedirectParams = {
  shortCode: string;
};

export async function redirectShortCode(
  request: FastifyRequest<{ Params: RedirectParams }>,
  reply: FastifyReply
) {
  const { shortCode } = request.params;
  if (!shortCode) {
    reply.code(400).send({ error: 'shortCode is required' });
    return;
  }

  const { data, error } = await supabase
    .from('short_links')
    .select('id, original_url, expires_at, click_count')
    .eq('short_code', shortCode)
    .maybeSingle();

  if (error) {
    reply.code(500).send({ error: error.message });
    return;
  }

  if (!data) {
    reply.code(404).send({ error: 'Short link not found' });
    return;
  }

  if (data.expires_at) {
    const expiresAt = new Date(data.expires_at);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      reply.code(410).send({ error: 'Short link expired' });
      return;
    }
  }

  const ipAddress = request.ip;
  const userAgent = request.headers['user-agent'] ?? null;

  const nextCount = (data.click_count ?? 0) + 1;
  const [countResult, clickResult] = await Promise.all([
    supabase
      .from('short_links')
      .update({ click_count: nextCount })
      .eq('id', data.id),
    supabase.from('clicks').insert({
      short_link_id: data.id,
      ip_address: ipAddress,
      user_agent: userAgent,
    }),
  ]);

  if (countResult.error || clickResult.error) {
    request.log.error(
      {
        countError: countResult.error?.message,
        clickError: clickResult.error?.message,
        shortLinkId: data.id,
      },
      'Failed to record click data'
    );
  }

  reply.redirect(data.original_url);
}
