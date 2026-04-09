import Fastify from 'fastify';
import type { Client } from 'discord.js';
import { registerStripeWebhook } from './webhooks/stripe.js';
import { logger } from '../utils/logger.js';

export async function startServer(discordClient: Client) {
  const server = Fastify({ logger: false });

  registerStripeWebhook(server, discordClient);

  const port = parseInt(process.env.PORT || '3000');
  const host = '0.0.0.0';

  await server.listen({ port, host });
  logger.info(`Webhook server listening on ${host}:${port}`);

  return server;
}
