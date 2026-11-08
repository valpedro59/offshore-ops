/**
 * Test de bout en bout : gateway + vrai auth-service + vrai stock-service,
 * chacun sur sa propre base PGlite (une base par service, comme en production).
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createLogger } from '@offshore/shared';
import { createApp as createGateway } from '../src/app';
import { MemoryRateLimitStore } from '../src/rateLimit';
import { createApp as createAuth } from '../../auth-service/src/app';
import * as authSchema from '../../auth-service/src/db/schema';
import { loadEnv as loadAuthEnv } from '../../auth-service/src/env';
import { createApp as createStock } from '../../stock-service/src/app';
import * as stockSchema from '../../stock-service/src/db/schema';
import { SECRET, makeEnv, urlOf } from './helpers';

const here = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('e2e');

let gateway: ReturnType<typeof createGateway>;
let store: MemoryRateLimitStore;
const servers: Server[] = [];

const listen = (app: { listen: (port: number, host: string, cb: () => void) => Server }) =>
  new Promise<Server>((resolveListen) => {
    const s = app.listen(0, '127.0.0.1', () => resolveListen(s));
    servers.push(s);
  });

beforeAll(async () => {
  const authClient = new PGlite();
  const authDb = drizzle(authClient, { schema: authSchema });
  await migrate(authDb, { migrationsFolder: resolve(here, '../../auth-service/drizzle') });

  const stockClient = new PGlite();
  const stockDb = drizzle(stockClient, { schema: stockSchema });
  await migrate(stockDb, { migrationsFolder: resolve(here, '../../stock-service/drizzle') });

  const authEnv = loadAuthEnv({
    AUTH_DATABASE_URL: 'unused',
    JWT_ACCESS_SECRET: SECRET,
  } as NodeJS.ProcessEnv);
  const authServer = await listen(createAuth({ db: authDb as never, env: authEnv, logger }));
  const stockServer = await listen(createStock({ db: stockDb as never, logger }));

  store = new MemoryRateLimitStore();
  gateway = createGateway({
    env: makeEnv({ AUTH_SERVICE_URL: urlOf(authServer), STOCK_SERVICE_URL: urlOf(stockServer) }),
    logger,
    store,
  });
}, 60_000);

afterAll(async () => {
  store.close();
  await Promise.all(
    servers.map(
      (s) =>
        new Promise((r) => {
          s.closeAllConnections();
          s.close(r);
        }),
    ),
  );
});

const A = '/api/v1/auth';
const S = '/api/v1/stock';
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('parcours complet via la gateway', () => {
  let adminToken: string;
  let adminUser: { id: string; companyId: string };
  let viewerToken: string;
  let warehouseId: string;
  let itemId: string;

  it('inscription : une société et son admin', async () => {
    const res = await request(gateway).post(`${A}/register`).send({
      companyName: 'Congo Offshore Services',
      fullName: 'Val Pedro',
      email: 'val@cos.cg',
      password: 'un-mot-de-passe-solide',
    });
    expect(res.status).toBe(201);
    adminToken = res.body.accessToken;
    adminUser = res.body.user;
  });

  it("l'admin crée un lecteur, qui se connecte", async () => {
    const created = await request(gateway).post(`${A}/users`).set(bearer(adminToken)).send({
      email: 'lecteur@cos.cg',
      fullName: 'Léa Lecteur',
      role: 'viewer',
      password: 'mot-de-passe-lecteur',
    });
    expect(created.status).toBe(201);
    const login = await request(gateway)
      .post(`${A}/login`)
      .send({ email: 'lecteur@cos.cg', password: 'mot-de-passe-lecteur' });
    expect(login.status).toBe(200);
    viewerToken = login.body.accessToken;
  });

  it("l'admin crée entrepôt, article, puis une entrée et une sortie", async () => {
    const w = await request(gateway)
      .post(`${S}/warehouses`)
      .set(bearer(adminToken))
      .send({ name: 'Magasin principal' });
    expect(w.status).toBe(201);
    warehouseId = w.body.id;

    const item = await request(gateway)
      .post(`${S}/items`)
      .set(bearer(adminToken))
      .send({ sku: 'CASQUE-01', name: 'Casque', threshold: 5 });
    expect(item.status).toBe(201);
    itemId = item.body.id;
    expect(item.body.companyId).toBe(adminUser.companyId); // la société vient du jeton, pas du client

    const inn = await request(gateway)
      .post(`${S}/movements`)
      .set(bearer(adminToken))
      .send({ type: 'IN', itemId, warehouseId, quantity: 10 });
    expect(inn.status).toBe(201);
    const out = await request(gateway)
      .post(`${S}/movements`)
      .set(bearer(adminToken))
      .send({ type: 'OUT', itemId, warehouseId, quantity: 3 });
    expect(out.body.totalQuantity).toBe(7);

    const tooMuch = await request(gateway)
      .post(`${S}/movements`)
      .set(bearer(adminToken))
      .send({ type: 'OUT', itemId, warehouseId, quantity: 99 });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('le lecteur consulte le stock mais ne peut rien modifier', async () => {
    const levels = await request(gateway).get(`${S}/levels`).set(bearer(viewerToken));
    expect(levels.status).toBe(200);
    expect(levels.body.data[0].quantity).toBe(7);
    const write = await request(gateway)
      .post(`${S}/movements`)
      .set(bearer(viewerToken))
      .send({ type: 'IN', itemId, warehouseId, quantity: 1 });
    expect(write.status).toBe(403);
  });

  it("une autre société ne voit rien, même en usurpant les en-têtes d'identité", async () => {
    const other = await request(gateway).post(`${A}/register`).send({
      companyName: 'Autre SARL',
      fullName: 'Bob Boss',
      email: 'bob@autre.cg',
      password: 'mot-de-passe-autre-1',
    });
    const token = other.body.accessToken;

    const spoofed = await request(gateway)
      .get(`${S}/items/${itemId}`)
      .set(bearer(token))
      .set({ 'x-company-id': adminUser.companyId, 'x-role': 'admin', 'x-user-id': adminUser.id });
    expect(spoofed.status).toBe(404);

    const list = await request(gateway).get(`${S}/items`).set(bearer(token));
    expect(list.body.total).toBe(0);
  });

  it('les sondes et la documentation répondent', async () => {
    const ready = await request(gateway).get('/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.services).toEqual({ auth: 'up', stock: 'up' });
  });
});
