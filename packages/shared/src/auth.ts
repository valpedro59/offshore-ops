import { z } from 'zod';
import { IdSchema, RoleSchema } from './common';

const email = z.string().trim().toLowerCase().email('Email invalide').max(254);

export const PasswordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
  .max(128);

export const RegisterCompanyBodySchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  fullName: z.string().trim().min(2).max(120),
  email,
  password: PasswordSchema,
});

export const LoginBodySchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const RefreshBodySchema = z.object({ refreshToken: z.string().min(20).max(512) });
export const LogoutBodySchema = RefreshBodySchema;

export const UserSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  email: z.string().email(),
  fullName: z.string(),
  role: RoleSchema,
  active: z.boolean(),
  createdAt: z.string().datetime(),
});
export type UserDto = z.infer<typeof UserSchema>;

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().describe("Durée de vie du jeton d'accès, en secondes"),
});

export const AuthResponseSchema = TokenPairSchema.extend({ user: UserSchema });

/** MVP : l'admin crée le compte avec un mot de passe initial (l'invitation par email viendra plus tard). */
export const CreateUserBodySchema = z.object({
  email,
  fullName: z.string().trim().min(2).max(120),
  role: RoleSchema,
  password: PasswordSchema,
});

export const UpdateUserBodySchema = z
  .object({ role: RoleSchema.optional(), active: z.boolean().optional() })
  .refine((v) => v.role !== undefined || v.active !== undefined, {
    message: 'Au moins un champ à modifier est requis',
  });

export const AccessTokenClaimsSchema = z.object({
  sub: IdSchema,
  companyId: IdSchema,
  role: RoleSchema,
});
export type AccessTokenClaims = z.infer<typeof AccessTokenClaimsSchema>;
