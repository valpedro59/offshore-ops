import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { z, ZodError, type ZodTypeAny } from 'zod';
import { AppError, Errors } from './errors';
import { IDENTITY_HEADERS, IdSchema, RoleSchema, type Identity, type Role } from './common';
import type { Logger } from './logger';

type Source = 'body' | 'query' | 'params';

/** Reprend le correlation-id entrant (gateway) ou en crée un. */
export const correlationId: RequestHandler = (req, res, next) => {
  const id = req.header(IDENTITY_HEADERS.correlationId) ?? randomUUID();
  res.locals.correlationId = id;
  res.setHeader(IDENTITY_HEADERS.correlationId, id);
  next();
};

const zodDetails = (err: ZodError) =>
  err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));

/** Valide une partie de la requête ; le résultat typé se lit avec `valid()`. */
export function validate(schema: ZodTypeAny, source: Source = 'body'): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) return next(Errors.validation(zodDetails(parsed.error)));
    res.locals.valid = { ...(res.locals.valid ?? {}), [source]: parsed.data };
    next();
  };
}

export function valid<T extends ZodTypeAny>(res: Response, source: Source, _schema: T): z.infer<T> {
  return res.locals.valid?.[source] as z.infer<T>;
}

const IdentityHeadersSchema = z.object({
  [IDENTITY_HEADERS.userId]: IdSchema,
  [IDENTITY_HEADERS.companyId]: IdSchema,
  [IDENTITY_HEADERS.role]: RoleSchema,
});

/** Lit l'identité transmise par la gateway (le service n'est jamais exposé directement). */
export const requireIdentity: RequestHandler = (req, res, next) => {
  const parsed = IdentityHeadersSchema.safeParse({
    [IDENTITY_HEADERS.userId]: req.header(IDENTITY_HEADERS.userId),
    [IDENTITY_HEADERS.companyId]: req.header(IDENTITY_HEADERS.companyId),
    [IDENTITY_HEADERS.role]: req.header(IDENTITY_HEADERS.role),
  });
  if (!parsed.success) return next(Errors.unauthorized());
  const d = parsed.data;
  const identity: Identity = {
    userId: d[IDENTITY_HEADERS.userId],
    companyId: d[IDENTITY_HEADERS.companyId],
    role: d[IDENTITY_HEADERS.role],
  };
  res.locals.identity = identity;
  next();
};

export const getIdentity = (res: Response): Identity => res.locals.identity as Identity;

export const requireRole =
  (...allowed: Role[]): RequestHandler =>
  (_req, res, next) =>
    allowed.includes(getIdentity(res).role) ? next() : next(Errors.forbidden());

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(Errors.notFound('Route'));

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req: Request, res: Response, _next) => {
    const cid = res.locals.correlationId as string | undefined;
    let status = 500;
    let body: { code: string; message: string; details?: unknown } = {
      code: 'INTERNAL_ERROR',
      message: 'Erreur interne',
    };

    if (err instanceof AppError) {
      status = err.status;
      body = { code: err.code, message: err.message, details: err.details };
    } else if (err instanceof ZodError) {
      status = 400;
      body = { code: 'VALIDATION_ERROR', message: 'Données invalides', details: zodDetails(err) };
    } else if (err?.type === 'entity.parse.failed') {
      status = 400;
      body = { code: 'VALIDATION_ERROR', message: 'JSON invalide' };
    } else if (err?.type === 'entity.too.large') {
      status = 413;
      body = { code: 'VALIDATION_ERROR', message: 'Corps de requête trop volumineux' };
    }

    if (status >= 500) logger.error({ err, correlationId: cid, path: req.path }, 'unhandled error');
    res.status(status).json({ error: { ...body, correlationId: cid } });
  };
}
