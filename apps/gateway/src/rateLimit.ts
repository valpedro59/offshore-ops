import type { Request, RequestHandler, Response } from 'express';
import { Errors } from '@offshore/shared';

export interface RateLimitStore {
  /** Compte une requête dans la fenêtre courante de `key`. */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

/**
 * Stockage en mémoire (fenêtre fixe). Suffisant pour une seule instance ;
 * avec plusieurs réplicas il faudra un stockage partagé (Redis) qui implémente la même interface.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();
  private readonly timer: NodeJS.Timeout;

  constructor(cleanupMs = 60_000) {
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.entries) if (v.resetAt <= now) this.entries.delete(k);
    }, cleanupMs);
    this.timer.unref();
  }

  async hit(key: string, windowMs: number) {
    const now = Date.now();
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.entries.set(key, fresh);
      return fresh;
    }
    current.count += 1;
    return current;
  }

  close() {
    clearInterval(this.timer);
  }
}

type Options = {
  name: string;
  windowMs: number;
  max: number;
  key: (req: Request, res: Response) => string;
  store: RateLimitStore;
};

export function rateLimit({ name, windowMs, max, key, store }: Options): RequestHandler {
  return async (req, res, next) => {
    try {
      const { count, resetAt } = await store.hit(`${name}:${key(req, res)}`, windowMs);
      const resetSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, max - count)));
      res.setHeader('RateLimit-Reset', String(resetSeconds));
      if (count > max) {
        res.setHeader('Retry-After', String(resetSeconds));
        return next(Errors.tooManyRequests(resetSeconds));
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
