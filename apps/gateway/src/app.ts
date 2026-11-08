import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { pinoHttp } from 'pino-http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  AccessTokenClaimsSchema,
  Errors,
  IDENTITY_HEADERS,
  correlationId,
  errorHandler,
  notFoundHandler,
  type AccessTokenClaims,
  type Logger,
} from '@offshore/shared';
import type { Env } from './env';
import { matchRule, type Rule, type Service } from './policy';
import { MemoryRateLimitStore, rateLimit, type RateLimitStore } from './rateLimit';

const DOCS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/api');
const DOCS_FILES = ['auth.openapi.yaml', 'stock.openapi.yaml'];

function verifyToken(token: string, secret: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const parsed = AccessTokenClaimsSchema.safeParse(payload);
    if (!parsed.success) throw new Error('claims');
    return parsed.data;
  } catch {
    throw Errors.unauthorized('Jeton invalide ou expiré');
  }
}

const isServerResponse = (r: ServerResponse | Socket | undefined): r is ServerResponse =>
  !!r && 'setHeader' in r;

export function createApp({
  env,
  logger,
  store = new MemoryRateLimitStore(),
}: {
  env: Env;
  logger: Logger;
  store?: RateLimitStore;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: false, maxAge: 600 }));
  app.use(correlationId);
  app.use(
    pinoHttp({
      logger,
      customProps: (_req, res) => ({ correlationId: res.getHeader('x-correlation-id') }),
    }),
  );
  // Pas de express.json() ici : le corps traverse la gateway sans être lu.

  const targets: Record<Service, string> = {
    auth: env.AUTH_SERVICE_URL,
    stock: env.STOCK_SERVICE_URL,
  };

  // ---------- proxys ----------
  const makeProxy = (service: Service): RequestHandler =>
    createProxyMiddleware({
      target: targets[service],
      xfwd: true,
      // proxyTimeout : délai d'attente du service en aval. (L'option `timeout` coupe la connexion
      // du client sans réponse, on ne l'utilise donc pas.)
      proxyTimeout: env.UPSTREAM_TIMEOUT_MS,
      on: {
        error: (err, req, res) => {
          const code = (err as NodeJS.ErrnoException).code;
          const timeout =
            code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ESOCKETTIMEDOUT';
          const appErr = timeout ? Errors.gatewayTimeout() : Errors.badGateway();
          logger.error({ service, code, path: req.url }, 'erreur du service en aval');
          if (isServerResponse(res) && !res.headersSent) {
            res.statusCode = appErr.status;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                error: {
                  code: appErr.code,
                  message: appErr.message,
                  correlationId: res.getHeader('x-correlation-id'),
                },
              }),
            );
          } else if (res && !isServerResponse(res)) {
            res.destroy();
          }
        },
      },
    }) as unknown as RequestHandler;

  const proxies: Record<Service, RequestHandler> = {
    auth: makeProxy('auth'),
    stock: makeProxy('stock'),
  };

  // ---------- limiteurs ----------
  const ipKey = (req: express.Request) => req.ip ?? 'unknown';
  const globalLimit = rateLimit({
    name: 'ip',
    windowMs: 60_000,
    max: env.RATE_LIMIT_IP_PER_MIN,
    key: ipKey,
    store,
  });
  const strictLimit = rateLimit({
    name: 'auth',
    windowMs: 60_000,
    max: env.RATE_LIMIT_AUTH_PER_MIN,
    key: ipKey,
    store,
  });
  const userLimit = rateLimit({
    name: 'user',
    windowMs: 60_000,
    max: env.RATE_LIMIT_USER_PER_MIN,
    key: (_req, res) => (res.locals.claims as AccessTokenClaims).sub,
    store,
  });

  app.use(globalLimit);

  // ---------- sondes et documentation ----------
  app.get('/health', (_req, res) => void res.json({ status: 'ok' }));

  app.get('/ready', async (_req, res) => {
    const check = async (url: string) => {
      try {
        const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
        return r.ok;
      } catch {
        return false;
      }
    };
    const [auth, stock] = await Promise.all([check(targets.auth), check(targets.stock)]);
    res.status(auth && stock ? 200 : 503).json({
      status: auth && stock ? 'ready' : 'degraded',
      services: { auth: auth ? 'up' : 'down', stock: stock ? 'up' : 'down' },
    });
  });

  app.get('/docs', (_req, res) => {
    const links = DOCS_FILES.map((f) => `<li><a href="/docs/${f}">${f}</a></li>`).join('');
    res
      .type('html')
      .send(
        `<!doctype html><meta charset="utf-8"><title>Offshore Ops – API</title>` +
          `<h1>Offshore Ops – contrats d'API (OpenAPI)</h1><ul>${links}</ul>` +
          `<p>Collez ces fichiers dans <a href="https://editor.swagger.io">editor.swagger.io</a> ou dans un client comme Bruno ou Postman.</p>`,
      );
  });
  app.use('/docs', express.static(DOCS_DIR, { index: false, extensions: [] }));

  // ---------- routage, authentification, autorisation ----------
  const route: RequestHandler = (req, res, next) => {
    const rule = matchRule(req.method, req.path);
    if (!rule) return next(); // route inconnue : 404 par défaut
    res.locals.rule = rule;
    next();
  };

  const guard: RequestHandler = (req, res, next) => {
    const rule = res.locals.rule as Rule | undefined;
    if (!rule) return next();
    if (rule.public) return next();

    const [scheme, token] = (req.header('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) return next(Errors.unauthorized());
    try {
      res.locals.claims = verifyToken(token, env.JWT_ACCESS_SECRET);
    } catch (e) {
      return next(e);
    }
    const { role } = res.locals.claims as AccessTokenClaims;
    if (rule.roles && !rule.roles.includes(role)) return next(Errors.forbidden());
    next();
  };

  const forward: RequestHandler = (req, res, next) => {
    const rule = res.locals.rule as Rule | undefined;
    if (!rule) return next();

    // Jamais de confiance envers l'identité fournie par le client : on l'efface,
    // puis on la réécrit uniquement à partir d'un jeton vérifié.
    delete req.headers[IDENTITY_HEADERS.userId];
    delete req.headers[IDENTITY_HEADERS.companyId];
    delete req.headers[IDENTITY_HEADERS.role];
    req.headers[IDENTITY_HEADERS.correlationId] = res.locals.correlationId as string;

    const claims = res.locals.claims as AccessTokenClaims | undefined;
    if (claims) {
      req.headers[IDENTITY_HEADERS.userId] = claims.sub;
      req.headers[IDENTITY_HEADERS.companyId] = claims.companyId;
      req.headers[IDENTITY_HEADERS.role] = claims.role;
    }
    return proxies[rule.service](req, res, next);
  };

  const strict: RequestHandler = (req, res, next) =>
    (res.locals.rule as Rule | undefined)?.strictLimit ? strictLimit(req, res, next) : next();
  const perUser: RequestHandler = (req, res, next) =>
    res.locals.claims ? userLimit(req, res, next) : next();

  app.use(route, strict, guard, perUser, forward);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
