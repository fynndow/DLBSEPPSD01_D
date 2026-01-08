import type { FastifyInstance } from 'fastify';
import {
  createShortLink,
  deleteShortLink,
  listShortLinks,
} from '../controllers/shortlinks.controller';
import { requireAuth } from '../middleware/auth';

export async function shortlinksRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/shortlinks', listShortLinks);
  app.post('/shortlinks', createShortLink);
  app.delete('/shortlinks/:id', deleteShortLink);
}
