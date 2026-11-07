import { z } from 'zod';

const EnvSchema = z.object({
  AUTH_PORT: z.coerce.number().int().default(4001),
  AUTH_DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET : 32 caractères minimum'),
  ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
});
export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => EnvSchema.parse(source);
