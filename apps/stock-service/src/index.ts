import { createLogger } from '@offshore/shared';
import { createApp } from './app';
import { createDb } from './db';
import { loadEnv } from './env';

const env = loadEnv();
const logger = createLogger('stock-service');
const { db, close } = createDb(env.STOCK_DATABASE_URL);

const server = createApp({ db, logger }).listen(env.STOCK_PORT, () =>
  logger.info(`stock-service à l'écoute sur :${env.STOCK_PORT}`),
);

const shutdown = () => {
  logger.info('arrêt en cours');
  server.close(() => void close().then(() => process.exit(0)));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
