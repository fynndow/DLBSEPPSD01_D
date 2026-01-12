import type { FastifyInstance } from 'fastify';
import { deleteAccount } from '../controllers/account.controller';
import { requireAuth } from '../middleware/auth';

export async function accountRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.delete('/account', deleteAccount);
}
