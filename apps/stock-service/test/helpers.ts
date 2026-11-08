import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createLogger, type Role } from '@offshore/shared';
import { createApp } from '../src/app';
import type { Db } from '../src/db';
import * as schema from '../src/db/schema';

export async function makeApp() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  const typedDb = db as unknown as Db;
  return {
    app: createApp({ db: typedDb, logger: createLogger('test') }),
    /** Vide les tables entre deux tests (beaucoup plus rapide que de recréer la base). */
    reset: async () => {
      await typedDb.execute(
        sql`truncate table stock_movements, stock_levels, items, warehouses cascade`,
      );
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof makeApp>>['app'];

/** Simule les en-têtes que la gateway ajoute après vérification du JWT. */
export const as = (app: TestApp, who: { companyId: string; role: Role; userId?: string }) => {
  const headers = {
    'x-user-id': who.userId ?? randomUUID(),
    'x-company-id': who.companyId,
    'x-role': who.role,
  };
  return {
    get: (url: string) => request(app).get(url).set(headers),
    post: (url: string, body: object) => request(app).post(url).set(headers).send(body),
    patch: (url: string, body: object) => request(app).patch(url).set(headers).send(body),
    delete: (url: string) => request(app).delete(url).set(headers),
  };
};
