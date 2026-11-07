import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { and, eq, isNull } from 'drizzle-orm';
import {
  AppError,
  CreateUserBodySchema,
  Errors,
  LoginBodySchema,
  LogoutBodySchema,
  RefreshBodySchema,
  RegisterCompanyBodySchema,
  UpdateUserBodySchema,
  correlationId,
  errorHandler,
  notFoundHandler,
  valid,
  validate,
  type AccessTokenClaims,
  type Logger,
  type UserDto,
} from '@offshore/shared';
import type { Db } from './db';
import { companies, refreshTokens, users } from './db/schema';
import type { Env } from './env';
import {
  hashPassword,
  hashRefreshToken,
  newRefreshToken,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
} from './security';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

type UserRow = typeof users.$inferSelect;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errCode = (e: any): string | undefined => e?.code ?? e?.cause?.code;
const isUniqueViolation = (e: unknown) => errCode(e) === '23505';

const toUserDto = (u: UserRow): UserDto => ({
  id: u.id,
  companyId: u.companyId,
  email: u.email,
  fullName: u.fullName,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt.toISOString(),
});

export function createApp({ db, env, logger }: { db: Db; env: Env; logger: Logger }) {
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

  // ---------- sondes ----------
  app.get('/health', (_req, res) => void res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    try {
      await db.select({ id: companies.id }).from(companies).limit(1);
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  // ---------- helpers ----------
  async function issueTokens(user: UserRow) {
    const refresh = newRefreshToken();
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: refresh.hash,
      expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 86_400_000),
    });
    return {
      accessToken: signAccessToken(
        { sub: user.id, companyId: user.companyId, role: user.role },
        env.JWT_ACCESS_SECRET,
        env.ACCESS_TTL_SECONDS,
      ),
      refreshToken: refresh.token,
      tokenType: 'Bearer' as const,
      expiresIn: env.ACCESS_TTL_SECONDS,
    };
  }

  const revokeAllTokens = (userId: string) =>
    db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));

  const authenticate: RequestHandler = (req, res, next) => {
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(Errors.unauthorized());
    try {
      res.locals.claims = verifyAccessToken(token, env.JWT_ACCESS_SECRET);
      next();
    } catch (e) {
      next(e);
    }
  };
  const claims = (res: { locals: Record<string, unknown> }) =>
    res.locals.claims as AccessTokenClaims;
  const adminOnly: RequestHandler = (_req, res, next) =>
    claims(res).role === 'admin' ? next() : next(Errors.forbidden());

  // Hash factice pour égaliser le temps de réponse quand l'email n'existe pas.
  const dummyHash = hashPassword('dummy-password-for-timing');

  // ---------- routes publiques ----------
  const api = express.Router();

  api.post('/auth/register', validate(RegisterCompanyBodySchema), async (_req, res) => {
    const body = valid(res, 'body', RegisterCompanyBodySchema);
    const passwordHash = await hashPassword(body.password);
    try {
      const user = await db.transaction(async (tx) => {
        const [company] = await tx.insert(companies).values({ name: body.companyName }).returning();
        const [u] = await tx
          .insert(users)
          .values({
            companyId: company!.id,
            email: body.email,
            fullName: body.fullName,
            passwordHash,
            role: 'admin',
          })
          .returning();
        return u!;
      });
      res.status(201).json({ ...(await issueTokens(user)), user: toUserDto(user) });
    } catch (e) {
      if (isUniqueViolation(e)) throw Errors.conflict('Un compte existe déjà avec cet email');
      throw e;
    }
  });

  api.post('/auth/login', validate(LoginBodySchema), async (_req, res) => {
    const { email, password } = valid(res, 'body', LoginBodySchema);
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      await verifyPassword(await dummyHash, password);
      throw Errors.unauthorized('Email ou mot de passe incorrect');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) throw Errors.locked();

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok || !user.active) {
      if (!ok) {
        const failed = user.failedLogins + 1;
        const lock = failed >= MAX_FAILED_LOGINS;
        await db
          .update(users)
          .set({
            failedLogins: lock ? 0 : failed,
            lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
          })
          .where(eq(users.id, user.id));
      }
      throw Errors.unauthorized('Email ou mot de passe incorrect');
    }

    if (user.failedLogins > 0 || user.lockedUntil) {
      await db
        .update(users)
        .set({ failedLogins: 0, lockedUntil: null })
        .where(eq(users.id, user.id));
    }
    res.json({ ...(await issueTokens(user)), user: toUserDto(user) });
  });

  api.post('/auth/refresh', validate(RefreshBodySchema), async (_req, res) => {
    const { refreshToken } = valid(res, 'body', RefreshBodySchema);
    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(refreshToken)))
      .limit(1);
    if (!row) throw Errors.unauthorized('Jeton de rafraîchissement invalide');

    if (row.revokedAt) {
      // Réutilisation d'un jeton déjà consommé : on suppose un vol et on coupe la session.
      await revokeAllTokens(row.userId);
      throw Errors.unauthorized('Jeton de rafraîchissement invalide');
    }
    if (row.expiresAt <= new Date()) throw Errors.unauthorized('Jeton de rafraîchissement expiré');

    const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
    if (!user || !user.active) throw Errors.unauthorized('Compte désactivé');

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));
    res.json(await issueTokens(user));
  });

  api.post('/auth/logout', validate(LogoutBodySchema), async (_req, res) => {
    const { refreshToken } = valid(res, 'body', LogoutBodySchema);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.tokenHash, hashRefreshToken(refreshToken)),
          isNull(refreshTokens.revokedAt),
        ),
      );
    res.status(204).end();
  });

  // ---------- routes protégées ----------
  api.get('/auth/me', authenticate, async (_req, res) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, claims(res).sub))
      .limit(1);
    if (!user || !user.active) throw Errors.unauthorized();
    res.json(toUserDto(user));
  });

  api.get('/auth/users', authenticate, adminOnly, async (_req, res) => {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.companyId, claims(res).companyId));
    res.json({ data: rows.map(toUserDto) });
  });

  api.post(
    '/auth/users',
    authenticate,
    adminOnly,
    validate(CreateUserBodySchema),
    async (_req, res) => {
      const body = valid(res, 'body', CreateUserBodySchema);
      try {
        const [user] = await db
          .insert(users)
          .values({
            companyId: claims(res).companyId,
            email: body.email,
            fullName: body.fullName,
            role: body.role,
            passwordHash: await hashPassword(body.password),
          })
          .returning();
        res.status(201).json(toUserDto(user!));
      } catch (e) {
        if (isUniqueViolation(e)) throw Errors.conflict('Un compte existe déjà avec cet email');
        throw e;
      }
    },
  );

  api.patch(
    '/auth/users/:id',
    authenticate,
    adminOnly,
    validate(UpdateUserBodySchema),
    async (req, res) => {
      const id = String(req.params.id);
      const patch = valid(res, 'body', UpdateUserBodySchema);
      if (id === claims(res).sub) {
        throw new AppError(409, 'CONFLICT', 'Vous ne pouvez pas modifier votre propre compte');
      }
      const [user] = await db
        .update(users)
        .set(patch)
        .where(and(eq(users.id, id), eq(users.companyId, claims(res).companyId)))
        .returning();
      if (!user) throw Errors.notFound('Utilisateur');
      if (patch.active === false) await revokeAllTokens(user.id);
      res.json(toUserDto(user));
    },
  );

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
