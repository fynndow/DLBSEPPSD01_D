import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../db/client';

export async function deleteAccount(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.user?.id;
  if (!userId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    reply.code(500).send({ error: error.message });
    return;
  }

  reply.code(204).send();
}
