import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createLogger } from '@offshore/shared';
import { createApp } from '../src/app';
import { MemoryRateLimitStore } from '../src/rateLimit';
import { SECRET, makeEnv, startStub, tokenFor } from './helpers';

type Stub = Awaited<ReturnType<typeof startStub>>;
let auth: Stub;
let stock: Stub;
let store: MemoryRateLimitStore;

const build = (over: Record<string, string> = {}) => {
  store = new MemoryRateLimitStore();
  return createApp({
    env: makeEnv({ AUTH_SERVICE_URL: auth.url, STOCK_SERVICE_URL: stock.url, ...over }),
    logger: createLogger('test'),
    store,
  });
};

beforeEach(async () => {
  auth = await startStub();
  stock = await startStub();
});
afterEach(async () => {
  store?.close();
  await Promise.all([auth.close(), stock.close()]);
});

const STOCK = '/api/v1/stock';
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('routes publiques', () => {
  it('transmet login sans jeton, avec le corps intact', async () => {
    const app = build();
    const body = { email: 'val@cos.cg', password: 'un-mot-de-passe-solide' };
    const res = await request(app).post('/api/v1/auth/login').send(body);
    expect(res.status).toBe(200);
    expect(auth.hits).toHaveLength(1);
    expect(auth.hits[0]!.url).toBe('/api/v1/auth/login');
    expect(auth.hits[0]!.body).toEqual(body);
  });

  it("efface l'identité envoyée par le client, même sur une route publique", async () => {
    const app = build();
    await request(app)
      .post('/api/v1/auth/login')
      .set({ 'x-user-id': randomUUID(), 'x-company-id': randomUUID(), 'x-role': 'admin' })
      .send({ email: 'a@b.cg', password: 'x' });
    const h = auth.hits[0]!.headers;
    expect(h['x-user-id']).toBeUndefined();
    expect(h['x-company-id']).toBeUndefined();
    expect(h['x-role']).toBeUndefined();
  });
});

describe('authentification', () => {
  it('refuse sans jeton, avec un mauvais jeton, un jeton expiré ou signé avec un autre secret (401)', async () => {
    const app = build();
    expect((await request(app).get(`${STOCK}/items`)).status).toBe(401);
    expect((await request(app).get(`${STOCK}/items`).set(bearer('nimporte'))).status).toBe(401);
    const expired = jwt.sign({ companyId: randomUUID(), role: 'admin' }, SECRET, {
      subject: randomUUID(),
      expiresIn: -10,
      algorithm: 'HS256',
    });
    expect((await request(app).get(`${STOCK}/items`).set(bearer(expired))).status).toBe(401);
    const forged = tokenFor('admin', { secret: 'un-autre-secret-un-autre-secret-123456' });
    expect((await request(app).get(`${STOCK}/items`).set(bearer(forged))).status).toBe(401);
    expect(stock.hits).toHaveLength(0);
  });

  it('refuse un jeton "alg: none"', async () => {
    const app = build();
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: randomUUID(), companyId: randomUUID(), role: 'admin' })}.`;
    expect((await request(app).get(`${STOCK}/items`).set(bearer(none))).status).toBe(401);
    expect(stock.hits).toHaveLength(0);
  });

  it("réécrit l'identité à partir du jeton et ignore les en-têtes usurpés", async () => {
    const app = build();
    const userId = randomUUID();
    const companyId = randomUUID();
    const token = tokenFor('storekeeper', { userId, companyId });
    const res = await request(app)
      .get(`${STOCK}/items`)
      .set(bearer(token))
      .set({ 'x-user-id': randomUUID(), 'x-company-id': randomUUID(), 'x-role': 'admin' });
    expect(res.status).toBe(200);
    const h = stock.hits[0]!.headers;
    expect(h['x-user-id']).toBe(userId);
    expect(h['x-company-id']).toBe(companyId);
    expect(h['x-role']).toBe('storekeeper');
  });
});

describe('autorisation par rôle', () => {
  it('un lecteur lit le stock mais ne peut pas écrire (403, rien transmis)', async () => {
    const app = build();
    const viewer = tokenFor('viewer');
    expect((await request(app).get(`${STOCK}/levels`).set(bearer(viewer))).status).toBe(200);
    const res = await request(app).post(`${STOCK}/movements`).set(bearer(viewer)).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(stock.hits).toHaveLength(1); // seule la lecture est passée
  });

  it('un magasinier écrit dans le stock mais ne gère pas les utilisateurs', async () => {
    const app = build();
    const keeper = tokenFor('storekeeper');
    expect(
      (await request(app).post(`${STOCK}/items`).set(bearer(keeper)).send({ sku: 'A', name: 'A' }))
        .status,
    ).toBe(200);
    expect((await request(app).get('/api/v1/auth/users').set(bearer(keeper))).status).toBe(403);
    expect(auth.hits).toHaveLength(0);
  });

  it('un admin gère les utilisateurs ; tout utilisateur lit /me', async () => {
    const app = build();
    expect(
      (
        await request(app)
          .get('/api/v1/auth/users')
          .set(bearer(tokenFor('admin')))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .set(bearer(tokenFor('hse')))
      ).status,
    ).toBe(200);
  });
});

describe('routage par défaut : refus', () => {
  it('ne transmet jamais une route inconnue ni un chemin détourné', async () => {
    const app = build();
    const t = bearer(tokenFor('admin'));
    for (const path of [
      '/api/v1/unknown',
      '/api/v1/stock/secret',
      '/api/v1/stock/items/../../auth/users',
      '/api/v1/auth/login/../users',
      '/health-internal',
    ]) {
      const res = await request(app).get(path).set(t);
      expect(res.status, path).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    expect((await request(app).delete('/api/v1/stock/levels').set(t)).status).toBe(404);
    expect(auth.hits).toHaveLength(0);
    expect(stock.hits).toHaveLength(0);
  });
});

describe('correlation-id', () => {
  it('le crée s’il manque, le réutilise sinon, et le transmet au service', async () => {
    const app = build();
    const t = bearer(tokenFor('viewer'));
    const generated = await request(app).get(`${STOCK}/items`).set(t);
    const id = generated.headers['x-correlation-id'];
    expect(id).toBeTruthy();
    expect(stock.hits[0]!.headers['x-correlation-id']).toBe(id);

    const mine = 'abc-123';
    const reused = await request(app).get(`${STOCK}/items`).set(t).set('x-correlation-id', mine);
    expect(reused.headers['x-correlation-id']).toBe(mine);
    expect(stock.hits[1]!.headers['x-correlation-id']).toBe(mine);
  });
});

describe('limitation de débit', () => {
  it('bloque le login après 3 tentatives par minute (429 + Retry-After)', async () => {
    const app = build({ RATE_LIMIT_AUTH_PER_MIN: '3' });
    const login = () =>
      request(app).post('/api/v1/auth/login').send({ email: 'a@b.cg', password: 'x' });
    for (let i = 0; i < 3; i++) expect((await login()).status).toBe(200);
    const blocked = await login();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(auth.hits).toHaveLength(3);
  });

  it('limite par utilisateur, pas seulement par IP', async () => {
    const app = build({ RATE_LIMIT_USER_PER_MIN: '2' });
    const a = bearer(tokenFor('viewer'));
    const b = bearer(tokenFor('viewer'));
    expect((await request(app).get(`${STOCK}/items`).set(a)).status).toBe(200);
    expect((await request(app).get(`${STOCK}/items`).set(a)).status).toBe(200);
    expect((await request(app).get(`${STOCK}/items`).set(a)).status).toBe(429);
    expect((await request(app).get(`${STOCK}/items`).set(b)).status).toBe(200); // autre utilisateur, même IP
  });

  it('applique une limite globale par IP', async () => {
    const app = build({ RATE_LIMIT_IP_PER_MIN: '3' });
    for (let i = 0; i < 3; i++) expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/health')).status).toBe(429);
  });
});

describe('pannes en aval', () => {
  it('renvoie 502 si le service est injoignable', async () => {
    const dead = await startStub();
    const deadUrl = dead.url;
    await dead.close();
    const app = build({ STOCK_SERVICE_URL: deadUrl });
    const res = await request(app)
      .get(`${STOCK}/items`)
      .set(bearer(tokenFor('viewer')));
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('BAD_GATEWAY');
  });

  it('renvoie 504 si le service répond trop lentement', async () => {
    const slow = await startStub({ delayMs: 2000 });
    const app = build({ STOCK_SERVICE_URL: slow.url, UPSTREAM_TIMEOUT_MS: '300' });
    const res = await request(app)
      .get(`${STOCK}/items`)
      .set(bearer(tokenFor('viewer')));
    await slow.close();
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('GATEWAY_TIMEOUT');
  });
});

describe('sondes et documentation', () => {
  it('/ready reflète l’état des services', async () => {
    const ok = await request(build()).get('/ready');
    expect(ok.status).toBe(200);
    expect(ok.body.services).toEqual({ auth: 'up', stock: 'up' });

    const dead = await startStub();
    const deadUrl = dead.url;
    await dead.close();
    const degraded = await request(build({ STOCK_SERVICE_URL: deadUrl })).get('/ready');
    expect(degraded.status).toBe(503);
    expect(degraded.body.services.stock).toBe('down');
  });

  it('sert les contrats OpenAPI', async () => {
    const app = build();
    expect((await request(app).get('/docs')).status).toBe(200);
    const yaml = await request(app).get('/docs/stock.openapi.yaml');
    expect(yaml.status).toBe(200);
    expect(yaml.text).toContain('openapi: 3.1.0');
  });
});
