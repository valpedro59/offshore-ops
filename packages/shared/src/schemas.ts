/**
 * Point d'entrée « navigateur » : uniquement des schémas zod et des types.
 * Aucune dépendance serveur (Express, pino, node:crypto...) : sûr à importer depuis le front.
 *
 *   import { CreateItemBodySchema } from '@offshore/shared/schemas';
 */
export * from './common';
export * from './auth';
export * from './stock';
export type { ErrorCode } from './errors';
