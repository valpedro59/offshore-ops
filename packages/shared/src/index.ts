// Point d'entrée « serveur » : schémas + erreurs + middlewares Express + logger.
// Le front doit importer depuis '@offshore/shared/schemas', jamais d'ici.
export * from './schemas';
export * from './errors';
export * from './logger';
export * from './http';
