import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../db/client';
import { generateShortCode } from '../utils/shortCode';

type CreateShortLinkBody = {
  originalUrl?: string;
  shortCode?: string;
  label?: string;
  expiresAt?: string | null;
};

type DeleteParams = {
  id: string;
};

const shortCodePattern = /^[A-Za-z0-9_-]+$/;

function parseExpiresAt(value?: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export async function createShortLink(
  request: FastifyRequest<{ Body: CreateShortLinkBody }>,
  reply: FastifyReply
) {
  const userId = request.user?.id;
  if (!userId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const originalUrl = request.body?.originalUrl?.trim();
  if (!originalUrl) {
    reply.code(400).send({ error: 'originalUrl is required' });
    return;
  }

  try {
    new URL(originalUrl);
  } catch {
    reply.code(400).send({ error: 'originalUrl is invalid' });
    return;
  }

  const providedCode = request.body?.shortCode?.trim();
  if (providedCode && !shortCodePattern.test(providedCode)) {
    reply
      .code(400)
      .send({ error: 'shortCode must be alphanumeric, dash or underscore' });
    return;
  }

  const expiresAt = parseExpiresAt(request.body?.expiresAt ?? null);
  if (request.body?.expiresAt && !expiresAt) {
    reply.code(400).send({ error: 'expiresAt is invalid' });
    return;
  }

  const labelInput = request.body?.label?.trim();
  const label = labelInput ? labelInput.slice(0, 80) : null;

  const attempts = providedCode ? 1 : 3;
  for (let i = 0; i < attempts; i += 1) {
    const shortCode = providedCode ?? generateShortCode();
    const { data, error } = await supabase
      .from('short_links')
      .insert({
        user_id: userId,
        original_url: originalUrl,
        short_code: shortCode,
        label,
        expires_at: expiresAt,
      })
      .select('id, short_code, original_url, expires_at, click_count, created_at, label')
      .single();

    if (!error) {
      reply.code(201).send(data);
      return;
    }

    if (error.code === '23505') {
      if (providedCode) {
        reply.code(409).send({ error: 'shortCode already exists' });
        return;
      }
      continue;
    }

    reply.code(500).send({ error: error.message });
    return;
  }

  reply.code(409).send({ error: 'Could not generate unique shortCode' });
}

export async function listShortLinks(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.user?.id;
  if (!userId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabase
    .from('short_links')
    .select('id, short_code, original_url, expires_at, click_count, created_at, label')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    reply.code(500).send({ error: error.message });
    return;
  }

  reply.send(data ?? []);
}

export async function deleteShortLink(
  request: FastifyRequest<{ Params: DeleteParams }>,
  reply: FastifyReply
) {
  const userId = request.user?.id;
  if (!userId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const { id } = request.params;
  if (!id) {
    reply.code(400).send({ error: 'id is required' });
    return;
  }

  const { error } = await supabase
    .from('short_links')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    reply.code(500).send({ error: error.message });
    return;
  }

  reply.code(204).send();
}
