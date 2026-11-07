import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  CreateItemBodySchema,
  CreateMovementBodySchema,
  CreateWarehouseBodySchema,
  Errors,
  IdSchema,
  ListItemsQuerySchema,
  ListLevelsQuerySchema,
  ListMovementsQuerySchema,
  UpdateItemBodySchema,
  correlationId,
  errorHandler,
  getIdentity,
  notFoundHandler,
  requireIdentity,
  requireRole,
  valid,
  validate,
  type Logger,
} from '@offshore/shared';
import type { Db, Tx } from './db';
import { items, stockLevels, stockMovements, warehouses } from './db/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isUniqueViolation = (e: any) => (e?.code ?? e?.cause?.code) === '23505';
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const idParams = z.object({ id: IdSchema });

const toItem = (r: typeof items.$inferSelect) => ({
  id: r.id,
  companyId: r.companyId,
  sku: r.sku,
  name: r.name,
  category: r.category,
  unit: r.unit,
  threshold: r.threshold,
  defaultWarehouseId: r.defaultWarehouseId,
  archived: r.archivedAt !== null,
  createdAt: r.createdAt.toISOString(),
});
const toWarehouse = (r: typeof warehouses.$inferSelect) => ({
  id: r.id,
  companyId: r.companyId,
  name: r.name,
  createdAt: r.createdAt.toISOString(),
});
const toMovement = (r: typeof stockMovements.$inferSelect) => ({
  id: r.id,
  companyId: r.companyId,
  itemId: r.itemId,
  warehouseId: r.warehouseId,
  toWarehouseId: r.toWarehouseId,
  type: r.type,
  quantity: r.quantity,
  reason: r.reason,
  reference: r.reference,
  createdBy: r.createdBy,
  createdAt: r.createdAt.toISOString(),
});

/** Crée la ligne de niveau si besoin puis la verrouille (SELECT ... FOR UPDATE). */
async function lockLevel(tx: Tx, companyId: string, itemId: string, warehouseId: string) {
  await tx
    .insert(stockLevels)
    .values({ itemId, warehouseId, companyId, quantity: 0 })
    .onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(stockLevels)
    .where(and(eq(stockLevels.itemId, itemId), eq(stockLevels.warehouseId, warehouseId)))
    .for('update');
  return row!.quantity;
}

const setLevel = (tx: Tx, itemId: string, warehouseId: string, quantity: number) =>
  tx
    .update(stockLevels)
    .set({ quantity, updatedAt: new Date() })
    .where(and(eq(stockLevels.itemId, itemId), eq(stockLevels.warehouseId, warehouseId)));

export function createApp({ db, logger }: { db: Db; logger: Logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(correlationId);
  app.use(
    pinoHttp({
      logger,
      customProps: (_req, res) => ({ correlationId: res.getHeader('x-correlation-id') }),
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => void res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    try {
      await db.select({ id: warehouses.id }).from(warehouses).limit(1);
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  const api = express.Router();
  api.use(requireIdentity);
  const canWrite = requireRole('admin', 'storekeeper');

  async function assertWarehousesOwned(companyId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const rows = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(and(eq(warehouses.companyId, companyId), inArray(warehouses.id, unique)));
    if (rows.length !== unique.length) throw Errors.notFound('Entrepôt');
  }

  // ======================= Entrepôts =======================
  api.get('/stock/warehouses', async (_req, res) => {
    const { companyId } = getIdentity(res);
    const rows = await db.select().from(warehouses).where(eq(warehouses.companyId, companyId));
    res.json({ data: rows.map(toWarehouse) });
  });

  api.post(
    '/stock/warehouses',
    canWrite,
    validate(CreateWarehouseBodySchema),
    async (_req, res) => {
      const { companyId } = getIdentity(res);
      const { name } = valid(res, 'body', CreateWarehouseBodySchema);
      try {
        const [row] = await db.insert(warehouses).values({ companyId, name }).returning();
        res.status(201).json(toWarehouse(row!));
      } catch (e) {
        if (isUniqueViolation(e)) throw Errors.conflict('Un entrepôt porte déjà ce nom');
        throw e;
      }
    },
  );

  // ======================= Articles =======================
  api.get('/stock/items', validate(ListItemsQuerySchema, 'query'), async (_req, res) => {
    const { companyId } = getIdentity(res);
    const q = valid(res, 'query', ListItemsQuerySchema);
    const where = and(
      eq(items.companyId, companyId),
      q.includeArchived ? undefined : isNull(items.archivedAt),
      q.search
        ? or(
            ilike(items.name, `%${escapeLike(q.search)}%`),
            ilike(items.sku, `%${escapeLike(q.search)}%`),
          )
        : undefined,
    );
    const [rows, [count]] = await Promise.all([
      db
        .select()
        .from(items)
        .where(where)
        .orderBy(items.sku)
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(items)
        .where(where),
    ]);
    res.json({ data: rows.map(toItem), page: q.page, limit: q.limit, total: count?.total ?? 0 });
  });

  api.post('/stock/items', canWrite, validate(CreateItemBodySchema), async (_req, res) => {
    const { companyId } = getIdentity(res);
    const body = valid(res, 'body', CreateItemBodySchema);
    if (body.defaultWarehouseId) await assertWarehousesOwned(companyId, [body.defaultWarehouseId]);
    try {
      const [row] = await db
        .insert(items)
        .values({ ...body, companyId })
        .returning();
      res.status(201).json(toItem(row!));
    } catch (e) {
      if (isUniqueViolation(e))
        throw Errors.conflict('Un article avec cette référence existe déjà');
      throw e;
    }
  });

  api.get('/stock/items/:id', validate(idParams, 'params'), async (_req, res) => {
    const { companyId } = getIdentity(res);
    const { id } = valid(res, 'params', idParams);
    const [row] = await db
      .select()
      .from(items)
      .where(and(eq(items.id, id), eq(items.companyId, companyId)));
    if (!row) throw Errors.notFound('Article');
    res.json(toItem(row));
  });

  api.patch(
    '/stock/items/:id',
    canWrite,
    validate(idParams, 'params'),
    validate(UpdateItemBodySchema),
    async (_req, res) => {
      const { companyId } = getIdentity(res);
      const { id } = valid(res, 'params', idParams);
      const patch = valid(res, 'body', UpdateItemBodySchema);
      if (patch.defaultWarehouseId)
        await assertWarehousesOwned(companyId, [patch.defaultWarehouseId]);
      const [row] = await db
        .update(items)
        .set(patch)
        .where(and(eq(items.id, id), eq(items.companyId, companyId)))
        .returning();
      if (!row) throw Errors.notFound('Article');
      res.json(toItem(row));
    },
  );

  api.delete('/stock/items/:id', canWrite, validate(idParams, 'params'), async (_req, res) => {
    const { companyId } = getIdentity(res);
    const { id } = valid(res, 'params', idParams);
    const [row] = await db
      .update(items)
      .set({ archivedAt: new Date() })
      .where(and(eq(items.id, id), eq(items.companyId, companyId)))
      .returning({ id: items.id });
    if (!row) throw Errors.notFound('Article');
    res.status(204).end();
  });

  // ======================= Mouvements =======================
  api.post('/stock/movements', canWrite, validate(CreateMovementBodySchema), async (_req, res) => {
    const { companyId, userId } = getIdentity(res);
    const m = valid(res, 'body', CreateMovementBodySchema);

    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.id, m.itemId), eq(items.companyId, companyId), isNull(items.archivedAt)));
    if (!item) throw Errors.notFound('Article');
    await assertWarehousesOwned(companyId, [
      m.warehouseId,
      ...(m.toWarehouseId ? [m.toWarehouseId] : []),
    ]);

    const result = await db.transaction(async (tx) => {
      // Verrous toujours pris dans le même ordre (id croissant) pour éviter les deadlocks.
      const targets = [m.warehouseId, ...(m.toWarehouseId ? [m.toWarehouseId] : [])].sort();
      const current = new Map<string, number>();
      for (const w of targets) current.set(w, await lockLevel(tx, companyId, m.itemId, w));

      const [{ total: before }] = (await tx
        .select({ total: sql<number>`coalesce(sum(${stockLevels.quantity}), 0)::int` })
        .from(stockLevels)
        .where(eq(stockLevels.itemId, m.itemId))) as [{ total: number }];

      const src = current.get(m.warehouseId)!;
      if (m.type === 'IN') {
        await setLevel(tx, m.itemId, m.warehouseId, src + m.quantity);
      } else {
        if (src < m.quantity) throw Errors.insufficientStock(src);
        await setLevel(tx, m.itemId, m.warehouseId, src - m.quantity);
        if (m.type === 'TRANSFER') {
          const dst = current.get(m.toWarehouseId!)!;
          await setLevel(tx, m.itemId, m.toWarehouseId!, dst + m.quantity);
        }
      }

      const [movement] = await tx
        .insert(stockMovements)
        .values({ ...m, companyId, createdBy: userId })
        .returning();

      const after =
        m.type === 'IN' ? before + m.quantity : m.type === 'OUT' ? before - m.quantity : before;
      return { movement: movement!, before, after };
    });

    res.status(201).json({
      movement: toMovement(result.movement),
      totalQuantity: result.after,
      threshold: item.threshold,
      thresholdCrossed: result.before >= item.threshold && result.after < item.threshold,
    });
  });

  api.get('/stock/movements', validate(ListMovementsQuerySchema, 'query'), async (_req, res) => {
    const { companyId } = getIdentity(res);
    const q = valid(res, 'query', ListMovementsQuerySchema);
    const where = and(
      eq(stockMovements.companyId, companyId),
      q.itemId ? eq(stockMovements.itemId, q.itemId) : undefined,
    );
    const [rows, [count]] = await Promise.all([
      db
        .select()
        .from(stockMovements)
        .where(where)
        .orderBy(desc(stockMovements.createdAt))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(stockMovements)
        .where(where),
    ]);
    res.json({
      data: rows.map(toMovement),
      page: q.page,
      limit: q.limit,
      total: count?.total ?? 0,
    });
  });

  // ======================= Niveaux =======================
  api.get('/stock/levels', validate(ListLevelsQuerySchema, 'query'), async (_req, res) => {
    const { companyId } = getIdentity(res);
    const q = valid(res, 'query', ListLevelsQuerySchema);
    const rows = await db
      .select({
        itemId: stockLevels.itemId,
        sku: items.sku,
        name: items.name,
        warehouseId: stockLevels.warehouseId,
        quantity: stockLevels.quantity,
      })
      .from(stockLevels)
      .innerJoin(items, eq(items.id, stockLevels.itemId))
      .where(
        and(
          eq(stockLevels.companyId, companyId),
          q.itemId ? eq(stockLevels.itemId, q.itemId) : undefined,
          q.warehouseId ? eq(stockLevels.warehouseId, q.warehouseId) : undefined,
        ),
      )
      .orderBy(items.sku);
    res.json({ data: rows });
  });

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
