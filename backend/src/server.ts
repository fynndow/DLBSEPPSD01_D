import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { redirectRoutes } from './routes/redirect.routes';
import { shortlinksRoutes } from './routes/shortlinks.routes';

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(redirectRoutes);
  app.register(shortlinksRoutes, { prefix: '/api' });

  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server listening on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
