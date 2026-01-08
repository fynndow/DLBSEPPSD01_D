import type { FastifyInstance } from 'fastify';
import { redirectShortCode } from '../controllers/redirect.controller';

export async function redirectRoutes(app: FastifyInstance) {
  app.get('/r/:shortCode', redirectShortCode);
}
