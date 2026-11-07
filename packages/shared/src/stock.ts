import { z } from 'zod';
import { IdSchema, PaginationQuerySchema, nonEmptyObject } from './common';

const iso = z.string().datetime();

// ---------- Entrepôts ----------
export const CreateWarehouseBodySchema = z.object({ name: z.string().trim().min(2).max(120) });
export const WarehouseSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  name: z.string(),
  createdAt: iso,
});

// ---------- Articles ----------
export const CreateItemBodySchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).optional(),
  unit: z.string().trim().min(1).max(20).default('pièce'),
  threshold: z.number().int().min(0).default(0).describe("Seuil d'alerte (quantité totale)"),
  defaultWarehouseId: IdSchema.optional(),
});

export const UpdateItemBodySchema = CreateItemBodySchema.omit({ sku: true })
  .partial()
  .refine(nonEmptyObject, { message: 'Au moins un champ à modifier est requis' });

export const ItemSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  sku: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  unit: z.string(),
  threshold: z.number().int(),
  defaultWarehouseId: IdSchema.nullable(),
  archived: z.boolean(),
  createdAt: iso,
});

export const ListItemsQuerySchema = PaginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  includeArchived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

// ---------- Mouvements ----------
export const MovementTypeSchema = z.enum(['IN', 'OUT', 'TRANSFER']);
export type MovementType = z.infer<typeof MovementTypeSchema>;

export const CreateMovementBodySchema = z
  .object({
    type: MovementTypeSchema,
    itemId: IdSchema,
    warehouseId: IdSchema.describe('Entrepôt concerné (source pour OUT et TRANSFER)'),
    toWarehouseId: IdSchema.optional().describe('Destination, uniquement pour TRANSFER'),
    quantity: z.number().int().positive(),
    reason: z.string().trim().max(200).optional(),
    reference: z.string().trim().max(100).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'TRANSFER') {
      if (!v.toWarehouseId) {
        ctx.addIssue({
          code: 'custom',
          path: ['toWarehouseId'],
          message: 'Entrepôt de destination requis pour un transfert',
        });
      } else if (v.toWarehouseId === v.warehouseId) {
        ctx.addIssue({
          code: 'custom',
          path: ['toWarehouseId'],
          message: 'La destination doit différer de la source',
        });
      }
    } else if (v.toWarehouseId) {
      ctx.addIssue({
        code: 'custom',
        path: ['toWarehouseId'],
        message: 'toWarehouseId est réservé aux transferts',
      });
    }
  });

export const MovementSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  itemId: IdSchema,
  warehouseId: IdSchema,
  toWarehouseId: IdSchema.nullable(),
  type: MovementTypeSchema,
  quantity: z.number().int(),
  reason: z.string().nullable(),
  reference: z.string().nullable(),
  createdBy: IdSchema,
  createdAt: iso,
});

export const ListMovementsQuerySchema = PaginationQuerySchema.extend({
  itemId: IdSchema.optional(),
});

// ---------- Niveaux ----------
export const StockLevelSchema = z.object({
  itemId: IdSchema,
  sku: z.string(),
  name: z.string(),
  warehouseId: IdSchema,
  quantity: z.number().int(),
});

export const ListLevelsQuerySchema = z.object({
  itemId: IdSchema.optional(),
  warehouseId: IdSchema.optional(),
});

export const MovementResultSchema = z.object({
  movement: MovementSchema,
  totalQuantity: z.number().int().describe("Quantité totale de l'article, tous entrepôts"),
  threshold: z.number().int(),
  thresholdCrossed: z
    .boolean()
    .describe("Vrai si ce mouvement a fait passer le total sous le seuil d'alerte"),
});
