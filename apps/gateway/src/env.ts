import { z } from 'zod';

const EnvSchema = z.object({
  GATEWAY_PORT: z.coerce.number().int().default(4000),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET : 32 caractères minimum'),
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:4001'),
  STOCK_SERVICE_URL: z.string().url().default('http://localhost:4002'),
  /** Origines autorisées par CORS, séparées par des virgules. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  /** Nombre de proxys de confiance devant la gateway (0 = aucun). Sert à lire la vraie IP du client. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  RATE_LIMIT_IP_PER_MIN: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_USER_PER_MIN: z.coerce.number().int().positive().default(600),
});
export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => EnvSchema.parse(source);
