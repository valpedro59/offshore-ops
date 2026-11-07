import { z } from 'zod';

const EnvSchema = z.object({
  STOCK_PORT: z.coerce.number().int().default(4002),
  STOCK_DATABASE_URL: z.string().min(1),
});
export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => EnvSchema.parse(source);
