import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createLogger } from '@offshore/shared';
import { createApp } from '../src/app';
import type { Db } from '../src/db';
import * as schema from '../src/db/schema';
import { loadEnv } from '../src/env';

export async function makeApp() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  const env = loadEnv({
    AUTH_DATABASE_URL: 'unused',
    JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123',
  } as NodeJS.ProcessEnv);
  return {
    app: createApp({ db: db as unknown as Db, env, logger: createLogger('test') }),
    db: db as unknown as Db,
  };
}

export const registerBody = (over: Record<string, unknown> = {}) => ({
  companyName: 'Congo Offshore Services',
  fullName: 'Val Pedro',
  email: 'val@cos.cg',
  password: 'un-mot-de-passe-solide',
  ...over,
});
