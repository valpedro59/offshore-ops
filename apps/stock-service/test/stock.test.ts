import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { as, makeApp, type TestApp } from './helpers';

const COMPANY_A = randomUUID();
const COMPANY_B = randomUUID();
const B = '/api/v1/stock';

let app: TestApp;
let keeper: ReturnType<typeof as>;

beforeEach(async () => {
  app = await makeApp();
  keeper = as(app, { companyId: COMPANY_A, role: 'storekeeper' });
});

async function seed(threshold = 5) {
  const w1 = (await keeper.post(`${B}/warehouses`, { name: 'Magasin principal' })).body;
  const w2 = (await keeper.post(`${B}/warehouses`, { name: 'Base offshore' })).body;
  const item = (
    await keeper.post(`${B}/items`, { sku: 'CASQUE-01', name: 'Casque de sécurité', threshold })
  ).body;
  return { w1, w2, item };
}

const move = (b: object) => keeper.post(`${B}/movements`, b);

describe('mouvements de stock', () => {
  it('entrée de 10 puis sortie de 3 : le niveau est 7', async () => {
    const { w1, item } = await seed();
    expect(
      (await move({ type: 'IN', itemId: item.id, warehouseId: w1.id, quantity: 10 })).status,
    ).toBe(201);
    const out = await move({
      type: 'OUT',
      itemId: item.id,
      warehouseId: w1.id,
      quantity: 3,
      reason: 'Embarquement',
    });
    expect(out.status).toBe(201);
    expect(out.body.totalQuantity).toBe(7);

    const levels = await keeper.get(`${B}/levels?itemId=${item.id}`);
    expect(levels.body.data).toEqual([
      expect.objectContaining({ warehouseId: w1.id, quantity: 7, sku: 'CASQUE-01' }),
    ]);
  });

  it('refuse une sortie qui rendrait le stock négatif (409) sans rien modifier', async () => {
    const { w1, item } = await seed();
    await move({ type: 'IN', itemId: item.id, warehouseId: w1.id, quantity: 4 });
    const res = await move({ type: 'OUT', itemId: item.id, warehouseId: w1.id, quantity: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.details).toEqual({ available: 4 });
    const levels = await keeper.get(`${B}/levels`);
    expect(levels.body.data[0].quantity).toBe(4);
    expect((await keeper.get(`${B}/movements`)).body.total).toBe(1);
  });

  it("n'autorise qu'autant de sorties que le stock le permet quand elles arrivent en même temps", async () => {
    const { w1, item } = await seed();
    await move({ type: 'IN', itemId: item.id, warehouseId: w1.id, quantity: 10 });
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        move({ type: 'OUT', itemId: item.id, warehouseId: w1.id, quantity: 3 }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect((await keeper.get(`${B}/levels`)).body.data[0].quantity).toBe(1);
  });

  it('transfère entre entrepôts sans changer le total', async () => {
    const { w1, w2, item } = await seed();
    await move({ type: 'IN', itemId: item.id, warehouseId: w1.id, quantity: 10 });
    const t = await move({
      type: 'TRANSFER',
      itemId: item.id,
      warehouseId: w1.id,
      toWarehouseId: w2.id,
      quantity: 6,
    });
    expect(t.status).toBe(201);
    expect(t.body.totalQuantity).toBe(10);
    const levels = (await keeper.get(`${B}/levels`)).body.data as {
      warehouseId: string;
      quantity: number;
    }[];
    expect(levels.find((l) => l.warehouseId === w1.id)?.quantity).toBe(4);
    expect(levels.find((l) => l.warehouseId === w2.id)?.quantity).toBe(6);
  });

  it('signale le franchissement du seuil une seule fois', async () => {
    const { w1, item } = await seed(5);
    await move({ type: 'IN', itemId: item.id, warehouseId: w1.id, quantity: 8 });
    const first = await move({ type: 'OUT', itemId: item.id, warehouseId: w1.id, quantity: 4 });
    expect(first.body.thresholdCrossed).toBe(true); // 8 -> 4 : on passe sous le seuil de 5
    const second = await move({ type: 'OUT', itemId: item.id, warehouseId: w1.id, quantity: 1 });
    expect(second.body.thresholdCrossed).toBe(false); // déjà sous le seuil : pas de nouvelle alerte
  });

  it('valide les transferts (destination requise, différente de la source)', async () => {
    const { w1, item } = await seed();
    const noDest = await move({
      type: 'TRANSFER',
      itemId: item.id,
      warehouseId: w1.id,
      quantity: 1,
    });
    expect(noDest.status).toBe(400);
    const same = await move({
      type: 'TRANSFER',
      itemId: item.id,
      warehouseId: w1.id,
      toWarehouseId: w1.id,
      quantity: 1,
    });
    expect(same.status).toBe(400);
    const badQty = await move({ type: 'IN', itemId: item.id, warehouseId: w1.id, quantity: 0 });
    expect(badQty.status).toBe(400);
  });
});

describe('isolation et droits', () => {
  it("une autre société ne voit ni n'utilise les données (404)", async () => {
    const { w1, item } = await seed();
    const other = as(app, { companyId: COMPANY_B, role: 'admin' });
    expect((await other.get(`${B}/items/${item.id}`)).status).toBe(404);
    expect((await other.get(`${B}/items`)).body.total).toBe(0);
    const mv = await other.post(`${B}/movements`, {
      type: 'IN',
      itemId: item.id,
      warehouseId: w1.id,
      quantity: 5,
    });
    expect(mv.status).toBe(404);
  });

  it('un lecteur consulte mais ne modifie rien (403)', async () => {
    const { w1, item } = await seed();
    const viewer = as(app, { companyId: COMPANY_A, role: 'viewer' });
    expect((await viewer.get(`${B}/items`)).status).toBe(200);
    expect(
      (
        await viewer.post(`${B}/movements`, {
          type: 'IN',
          itemId: item.id,
          warehouseId: w1.id,
          quantity: 1,
        })
      ).status,
    ).toBe(403);
    expect((await viewer.post(`${B}/items`, { sku: 'X', name: 'X' })).status).toBe(403);
  });

  it('refuse les requêtes sans identité (401)', async () => {
    expect((await request(app).get(`${B}/items`)).status).toBe(401);
  });
});

describe('articles', () => {
  it('crée, modifie, recherche, archive', async () => {
    const { item } = await seed();
    expect((await keeper.post(`${B}/items`, { sku: 'CASQUE-01', name: 'Doublon' })).status).toBe(
      409,
    );

    const patched = await keeper.patch(`${B}/items/${item.id}`, { threshold: 12 });
    expect(patched.body.threshold).toBe(12);
    expect((await keeper.patch(`${B}/items/${item.id}`, {})).status).toBe(400);

    expect((await keeper.get(`${B}/items?search=casque`)).body.total).toBe(1);
    expect((await keeper.get(`${B}/items?search=zzz`)).body.total).toBe(0);

    expect((await keeper.delete(`${B}/items/${item.id}`)).status).toBe(204);
    expect((await keeper.get(`${B}/items`)).body.total).toBe(0);
    expect((await keeper.get(`${B}/items?includeArchived=true`)).body.total).toBe(1);
  });
});
