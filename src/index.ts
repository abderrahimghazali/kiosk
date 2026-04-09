import 'dotenv/config';
import { createBot } from './bot/client.js';
import { startServer } from './server/index.js';
import { logger } from './utils/logger.js';

const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

async function main() {
  const client = createBot();

  // Start webhook server
  const server = await startServer(client);

  // Login to Discord
  await client.login(process.env.DISCORD_TOKEN);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    client.destroy();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error('Fatal error', { error: String(err) });
  process.exit(1);
});
