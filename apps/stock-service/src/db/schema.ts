import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const warehouses = pgTable(
  'warehouses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    name: text('name').notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('warehouses_company_name_uq').on(t.companyId, t.name)],
);

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    category: text('category'),
    unit: text('unit').notNull().default('pièce'),
    threshold: integer('threshold').notNull().default(0),
    defaultWarehouseId: uuid('default_warehouse_id').references(() => warehouses.id),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('items_company_sku_uq').on(t.companyId, t.sku),
    index('items_company_idx').on(t.companyId),
  ],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    toWarehouseId: uuid('to_warehouse_id').references(() => warehouses.id),
    type: text('type', { enum: ['IN', 'OUT', 'TRANSFER'] }).notNull(),
    quantity: integer('quantity').notNull(),
    reason: text('reason'),
    reference: text('reference'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('movements_company_item_idx').on(t.companyId, t.itemId, t.createdAt),
    check('movements_qty_positive', sql`${t.quantity} > 0`),
  ],
);

export const stockLevels = pgTable(
  'stock_levels',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    companyId: uuid('company_id').notNull(),
    quantity: integer('quantity').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.warehouseId] }),
    check('levels_qty_non_negative', sql`${t.quantity} >= 0`),
  ],
);
