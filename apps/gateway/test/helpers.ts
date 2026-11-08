import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@offshore/shared';
import { loadEnv } from '../src/env';

export const SECRET = 'test-secret-test-secret-test-secret-123';

export type Hit = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};

export const urlOf = (server: Server) =>
  `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

/** Faux service en aval : enregistre ce qu'il reçoit et le renvoie. */
export async function startStub(opts: { delayMs?: number } = {}) {
  const hits: Hit[] = [];
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => void res.json({ status: 'ok' }));
  app.use((req, res) => {
    hits.push({ method: req.method, url: req.originalUrl, headers: req.headers, body: req.body });
    setTimeout(
      () => res.status(200).json({ ok: true, headers: req.headers, body: req.body }),
      opts.delayMs ?? 0,
    );
  });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return {
    hits,
    url: urlOf(server),
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export const makeEnv = (over: Record<string, string> = {}) =>
  loadEnv({
    JWT_ACCESS_SECRET: SECRET,
    AUTH_SERVICE_URL: 'http://127.0.0.1:1',
    STOCK_SERVICE_URL: 'http://127.0.0.1:1',
    ...over,
  } as NodeJS.ProcessEnv);

export function tokenFor(
  role: Role,
  over: { userId?: string; companyId?: string; expiresIn?: number; secret?: string } = {},
) {
  return jwt.sign({ companyId: over.companyId ?? randomUUID(), role }, over.secret ?? SECRET, {
    subject: over.userId ?? randomUUID(),
    expiresIn: over.expiresIn ?? 60,
    algorithm: 'HS256',
  });
}
