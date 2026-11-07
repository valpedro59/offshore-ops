import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z, type ZodTypeAny } from 'zod';
import { ErrorResponseSchema, IdSchema, paginated } from './common';
import * as auth from './auth';
import * as stock from './stock';

extendZodWithOpenApi(z);

type Method = 'get' | 'post' | 'patch' | 'delete';
type Route = {
  method: Method;
  path: string;
  summary: string;
  description?: string;
  tag: string;
  secured?: boolean;
  params?: z.AnyZodObject;
  query?: z.AnyZodObject;
  body?: ZodTypeAny;
  ok: { status: 200 | 201 | 204; schema?: ZodTypeAny; description: string };
  errors?: number[];
};

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Données invalides',
  401: 'Non authentifié',
  403: 'Rôle insuffisant',
  404: 'Introuvable',
  409: 'Conflit',
  423: 'Compte verrouillé',
};

function addRoute(registry: OpenAPIRegistry, r: Route) {
  const errorResponses = Object.fromEntries(
    [
      ...new Set([
        ...(r.errors ?? []),
        ...(r.body || r.query || r.params ? [400] : []),
        ...(r.secured ? [401] : []),
      ]),
    ].map((code) => [
      code,
      {
        description: ERROR_DESCRIPTIONS[code] ?? 'Erreur',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    ]),
  );

  registry.registerPath({
    method: r.method,
    path: r.path,
    summary: r.summary,
    description: r.description,
    tags: [r.tag],
    security: r.secured ? [{ bearerAuth: [] }] : [],
    request: {
      params: r.params,
      query: r.query,
      body: r.body
        ? { content: { 'application/json': { schema: r.body } }, required: true }
        : undefined,
    },
    responses: {
      [r.ok.status]: {
        description: r.ok.description,
        ...(r.ok.schema ? { content: { 'application/json': { schema: r.ok.schema } } } : {}),
      },
      ...errorResponses,
    },
  });
}

function newRegistry() {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  registry.register('ErrorResponse', ErrorResponseSchema);
  return registry;
}

const idParam = z.object({ id: IdSchema });

// ======================= auth-service =======================
export function buildAuthRegistry() {
  const r = newRegistry();
  r.register('User', auth.UserSchema);
  r.register('AuthResponse', auth.AuthResponseSchema);
  r.register('TokenPair', auth.TokenPairSchema);

  const tag = 'Auth';
  addRoute(r, {
    method: 'post',
    path: '/api/v1/auth/register',
    tag,
    summary: 'Créer une société et son administrateur',
    body: auth.RegisterCompanyBodySchema,
    ok: {
      status: 201,
      schema: auth.AuthResponseSchema,
      description: 'Société créée, utilisateur connecté',
    },
    errors: [409],
  });
  addRoute(r, {
    method: 'post',
    path: '/api/v1/auth/login',
    tag,
    summary: 'Connexion',
    description: 'Après 5 échecs consécutifs, le compte est verrouillé 15 minutes.',
    body: auth.LoginBodySchema,
    ok: { status: 200, schema: auth.AuthResponseSchema, description: 'Jetons émis' },
    errors: [401, 423],
  });
  addRoute(r, {
    method: 'post',
    path: '/api/v1/auth/refresh',
    tag,
    summary: 'Renouveler les jetons',
    description:
      'Rotation : le jeton de rafraîchissement présenté est révoqué. Sa réutilisation révoque toute la session.',
    body: auth.RefreshBodySchema,
    ok: { status: 200, schema: auth.TokenPairSchema, description: 'Nouveaux jetons' },
    errors: [401],
  });
  addRoute(r, {
    method: 'post',
    path: '/api/v1/auth/logout',
    tag,
    summary: 'Déconnexion (révoque le jeton de rafraîchissement)',
    body: auth.LogoutBodySchema,
    ok: { status: 204, description: 'Déconnecté' },
  });
  addRoute(r, {
    method: 'get',
    path: '/api/v1/auth/me',
    tag,
    secured: true,
    summary: 'Utilisateur courant',
    ok: { status: 200, schema: auth.UserSchema, description: 'Profil' },
  });

  const utag = 'Utilisateurs';
  addRoute(r, {
    method: 'get',
    path: '/api/v1/auth/users',
    tag: utag,
    secured: true,
    summary: 'Lister les utilisateurs de la société (admin)',
    ok: { status: 200, schema: z.object({ data: z.array(auth.UserSchema) }), description: 'Liste' },
    errors: [403],
  });
  addRoute(r, {
    method: 'post',
    path: '/api/v1/auth/users',
    tag: utag,
    secured: true,
    summary: 'Créer un utilisateur (admin)',
    body: auth.CreateUserBodySchema,
    ok: { status: 201, schema: auth.UserSchema, description: 'Utilisateur créé' },
    errors: [403, 409],
  });
  addRoute(r, {
    method: 'patch',
    path: '/api/v1/auth/users/{id}',
    tag: utag,
    secured: true,
    summary: 'Changer le rôle ou désactiver un utilisateur (admin)',
    params: idParam,
    body: auth.UpdateUserBodySchema,
    ok: { status: 200, schema: auth.UserSchema, description: 'Utilisateur mis à jour' },
    errors: [403, 404, 409],
  });
  return r;
}

// ======================= stock-service =======================
export function buildStockRegistry() {
  const r = newRegistry();
  r.register('Item', stock.ItemSchema);
  r.register('Warehouse', stock.WarehouseSchema);
  r.register('Movement', stock.MovementSchema);
  r.register('StockLevel', stock.StockLevelSchema);
  r.register('MovementResult', stock.MovementResultSchema);

  const base = '/api/v1/stock';
  const tag = 'Articles';
  addRoute(r, {
    method: 'get',
    path: `${base}/items`,
    tag,
    secured: true,
    summary: 'Lister les articles',
    query: stock.ListItemsQuerySchema,
    ok: { status: 200, schema: paginated(stock.ItemSchema), description: 'Page d’articles' },
  });
  addRoute(r, {
    method: 'post',
    path: `${base}/items`,
    tag,
    secured: true,
    summary: 'Créer un article (admin, magasinier)',
    body: stock.CreateItemBodySchema,
    ok: { status: 201, schema: stock.ItemSchema, description: 'Article créé' },
    errors: [403, 409],
  });
  addRoute(r, {
    method: 'get',
    path: `${base}/items/{id}`,
    tag,
    secured: true,
    summary: 'Détail d’un article',
    params: idParam,
    ok: { status: 200, schema: stock.ItemSchema, description: 'Article' },
    errors: [404],
  });
  addRoute(r, {
    method: 'patch',
    path: `${base}/items/{id}`,
    tag,
    secured: true,
    summary: 'Modifier un article (admin, magasinier)',
    params: idParam,
    body: stock.UpdateItemBodySchema,
    ok: { status: 200, schema: stock.ItemSchema, description: 'Article modifié' },
    errors: [403, 404],
  });
  addRoute(r, {
    method: 'delete',
    path: `${base}/items/{id}`,
    tag,
    secured: true,
    summary: 'Archiver un article (suppression logique)',
    params: idParam,
    ok: { status: 204, description: 'Archivé' },
    errors: [403, 404],
  });

  const wtag = 'Entrepôts';
  addRoute(r, {
    method: 'get',
    path: `${base}/warehouses`,
    tag: wtag,
    secured: true,
    summary: 'Lister les entrepôts',
    ok: {
      status: 200,
      schema: z.object({ data: z.array(stock.WarehouseSchema) }),
      description: 'Liste',
    },
  });
  addRoute(r, {
    method: 'post',
    path: `${base}/warehouses`,
    tag: wtag,
    secured: true,
    summary: 'Créer un entrepôt (admin, magasinier)',
    body: stock.CreateWarehouseBodySchema,
    ok: { status: 201, schema: stock.WarehouseSchema, description: 'Entrepôt créé' },
    errors: [403, 409],
  });

  const mtag = 'Mouvements';
  addRoute(r, {
    method: 'post',
    path: `${base}/movements`,
    tag: mtag,
    secured: true,
    summary: 'Enregistrer une entrée, une sortie ou un transfert (admin, magasinier)',
    description:
      'Transaction unique : mouvement + mise à jour des niveaux, avec verrouillage de ligne. Une sortie qui rendrait le stock négatif est refusée (409 INSUFFICIENT_STOCK). Un mouvement ne se modifie pas : on le corrige par un mouvement inverse.',
    body: stock.CreateMovementBodySchema,
    ok: { status: 201, schema: stock.MovementResultSchema, description: 'Mouvement enregistré' },
    errors: [403, 404, 409],
  });
  addRoute(r, {
    method: 'get',
    path: `${base}/movements`,
    tag: mtag,
    secured: true,
    summary: 'Historique des mouvements',
    query: stock.ListMovementsQuerySchema,
    ok: { status: 200, schema: paginated(stock.MovementSchema), description: 'Page de mouvements' },
  });

  addRoute(r, {
    method: 'get',
    path: `${base}/levels`,
    tag: 'Niveaux',
    secured: true,
    summary: 'Niveaux de stock par article et entrepôt',
    query: stock.ListLevelsQuerySchema,
    ok: {
      status: 200,
      schema: z.object({ data: z.array(stock.StockLevelSchema) }),
      description: 'Niveaux',
    },
  });
  return r;
}

export function buildDocument(
  registry: OpenAPIRegistry,
  title: string,
  description: string,
  port: number,
) {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title, version: '0.1.0', description },
    servers: [
      { url: `http://localhost:${port}`, description: 'Local (via la gateway en sprint 2)' },
    ],
  });
}
