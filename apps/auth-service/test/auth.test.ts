import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { makeApp, registerBody } from './helpers';
import { users } from '../src/db/schema';

let app: Awaited<ReturnType<typeof makeApp>>['app'];
let db: Awaited<ReturnType<typeof makeApp>>['db'];
let reset: Awaited<ReturnType<typeof makeApp>>['reset'];

beforeAll(async () => {
  ({ app, db, reset } = await makeApp());
});
beforeEach(() => reset());

const register = (over = {}) => request(app).post('/api/v1/auth/register').send(registerBody(over));

describe('register / login', () => {
  it('crée une société et un admin, renvoie des jetons', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('refuse un email déjà utilisé (409) et un mot de passe trop court (400)', async () => {
    await register();
    expect((await register()).status).toBe(409);
    const weak = await register({ email: 'autre@cos.cg', password: 'court' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('connecte avec les bons identifiants, refuse les mauvais', async () => {
    await register();
    const ok = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'VAL@cos.cg', password: 'un-mot-de-passe-solide' });
    expect(ok.status).toBe(200);
    const bad = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'val@cos.cg', password: 'faux-faux-faux' });
    expect(bad.status).toBe(401);
  });

  it('verrouille le compte après 5 échecs', async () => {
    await register();
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'val@cos.cg', password: 'faux-faux-faux' });
    }
    const locked = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'val@cos.cg', password: 'un-mot-de-passe-solide' });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});

describe('refresh / logout', () => {
  it('fait tourner le jeton et détecte la réutilisation', async () => {
    const { body } = await register();
    const first = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(body.refreshToken);

    // Réutilisation de l'ancien jeton : refusée, et la session entière est révoquée.
    const reuse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken });
    expect(reuse.status).toBe(401);
    const afterReuse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.body.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it('révoque le jeton à la déconnexion', async () => {
    const { body } = await register();
    expect(
      (await request(app).post('/api/v1/auth/logout').send({ refreshToken: body.refreshToken }))
        .status,
    ).toBe(204);
    expect(
      (await request(app).post('/api/v1/auth/refresh').send({ refreshToken: body.refreshToken }))
        .status,
    ).toBe(401);
  });
});

describe('RBAC et isolation des sociétés', () => {
  it('exige un jeton valide sur /me', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer nimporte')).status,
    ).toBe(401);
    const { body } = await register();
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('val@cos.cg');
  });

  it('un admin crée un magasinier ; celui-ci ne peut pas gérer les utilisateurs', async () => {
    const admin = (await register()).body;
    const created = await request(app)
      .post('/api/v1/auth/users')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        email: 'mag@cos.cg',
        fullName: 'Marc Magasin',
        role: 'storekeeper',
        password: 'mot-de-passe-magasin',
      });
    expect(created.status).toBe(201);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'mag@cos.cg', password: 'mot-de-passe-magasin' });
    expect(login.status).toBe(200);
    const forbidden = await request(app)
      .get('/api/v1/auth/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(forbidden.status).toBe(403);
  });

  it("un admin ne voit ni ne modifie les utilisateurs d'une autre société", async () => {
    const a = (await register()).body;
    const b = (await register({ companyName: 'Autre SARL', email: 'boss@autre.cg' })).body;

    const listA = await request(app)
      .get('/api/v1/auth/users')
      .set('Authorization', `Bearer ${a.accessToken}`);
    expect(listA.body.data).toHaveLength(1);

    const patch = await request(app)
      .patch(`/api/v1/auth/users/${b.user.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ active: false });
    expect(patch.status).toBe(404);
  });

  it('désactiver un utilisateur révoque ses jetons et bloque la connexion', async () => {
    const admin = (await register()).body;
    const created = await request(app)
      .post('/api/v1/auth/users')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        email: 'hse@cos.cg',
        fullName: 'Hélène HSE',
        role: 'hse',
        password: 'mot-de-passe-hse-ok',
      });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'hse@cos.cg', password: 'mot-de-passe-hse-ok' });

    const off = await request(app)
      .patch(`/api/v1/auth/users/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ active: false });
    expect(off.status).toBe(200);

    expect(
      (
        await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: login.body.refreshToken })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'hse@cos.cg', password: 'mot-de-passe-hse-ok' })
      ).status,
    ).toBe(401);
    const [row] = await db.select().from(users).where(eq(users.id, created.body.id));
    expect(row?.active).toBe(false);
  });
});

describe('sondes', () => {
  it('répond sur /health et /ready', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/ready')).status).toBe(200);
  });
});
