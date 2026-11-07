import { z } from 'zod';

export const roles = ['admin', 'storekeeper', 'hse', 'viewer'] as const;
export const RoleSchema = z.enum(roles);
export type Role = z.infer<typeof RoleSchema>;

export const IdSchema = z.string().uuid();

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
  });

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    correlationId: z.string().optional(),
  }),
});

/** En-têtes ajoutés par la gateway après vérification du JWT. */
export const IDENTITY_HEADERS = {
  userId: 'x-user-id',
  companyId: 'x-company-id',
  role: 'x-role',
  correlationId: 'x-correlation-id',
} as const;

export type Identity = { userId: string; companyId: string; role: Role };

export const nonEmptyObject = (v: object) => Object.keys(v).length > 0;
