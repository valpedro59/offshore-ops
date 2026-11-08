import { createLogger } from '@offshore/shared';
import { createApp } from './app';
import { loadEnv } from './env';

const env = loadEnv();
const logger = createLogger('gateway');

const server = createApp({ env, logger }).listen(env.GATEWAY_PORT, () =>
  logger.info(`gateway à l'écoute sur :${env.GATEWAY_PORT}`),
);

const shutdown = () => {
  logger.info('arrêt en cours');
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
