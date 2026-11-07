import { createLogger } from '@offshore/shared';
import { createApp } from './app';
import { createDb } from './db';
import { loadEnv } from './env';

const env = loadEnv();
const logger = createLogger('auth-service');
const { db, close } = createDb(env.AUTH_DATABASE_URL);

const server = createApp({ db, env, logger }).listen(env.AUTH_PORT, () =>
  logger.info(`auth-service à l'écoute sur :${env.AUTH_PORT}`),
);

const shutdown = () => {
  logger.info('arrêt en cours');
  server.close(() => void close().then(() => process.exit(0)));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
