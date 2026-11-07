export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_STOCK'
  | 'ACCOUNT_LOCKED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (details: unknown) =>
    new AppError(400, 'VALIDATION_ERROR', 'Données invalides', details),
  unauthorized: (message = 'Authentification requise') =>
    new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Accès refusé pour ce rôle') => new AppError(403, 'FORBIDDEN', message),
  notFound: (what = 'Ressource') => new AppError(404, 'NOT_FOUND', `${what} introuvable`),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
  insufficientStock: (available: number) =>
    new AppError(409, 'INSUFFICIENT_STOCK', 'Stock insuffisant pour cette sortie', { available }),
  locked: () =>
    new AppError(423, 'ACCOUNT_LOCKED', 'Compte temporairement verrouillé, réessayez plus tard'),
};
