import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import jwt from 'jsonwebtoken';
import { AccessTokenClaimsSchema, Errors, type AccessTokenClaims } from '@offshore/shared';

export const hashPassword = (plain: string) => hash(plain); // argon2id, paramètres par défaut

export const verifyPassword = async (hashed: string, plain: string) => {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
};

export function signAccessToken(claims: AccessTokenClaims, secret: string, ttlSeconds: number) {
  return jwt.sign({ companyId: claims.companyId, role: claims.role }, secret, {
    subject: claims.sub,
    expiresIn: ttlSeconds,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string, secret: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const parsed = AccessTokenClaimsSchema.safeParse(payload);
    if (!parsed.success) throw new Error('claims');
    return parsed.data;
  } catch {
    throw Errors.unauthorized('Jeton invalide ou expiré');
  }
}

/** Jeton opaque : seul son hash SHA-256 est stocké en base. */
export function newRefreshToken() {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}
export const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');
