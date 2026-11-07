import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CreateItemBodySchema,
  CreateMovementBodySchema,
  RegisterCompanyBodySchema,
  UpdateItemBodySchema,
  UpdateUserBodySchema,
} from '../src';

describe('auth schemas', () => {
  it('normalise l’email et impose 10 caractères de mot de passe', () => {
    const ok = RegisterCompanyBodySchema.parse({
      companyName: 'COS',
      fullName: 'Val Pedro',
      email: '  VAL@Cos.CG ',
      password: 'abcdefghij',
    });
    expect(ok.email).toBe('val@cos.cg');
    expect(RegisterCompanyBodySchema.safeParse({ ...ok, password: 'court' }).success).toBe(false);
  });

  it('exige au moins un champ pour modifier un utilisateur', () => {
    expect(UpdateUserBodySchema.safeParse({}).success).toBe(false);
    expect(UpdateUserBodySchema.safeParse({ active: false }).success).toBe(true);
  });
});

describe('stock schemas', () => {
  it('applique les valeurs par défaut d’un article', () => {
    const item = CreateItemBodySchema.parse({ sku: 'A1', name: 'Gants' });
    expect(item).toMatchObject({ unit: 'pièce', threshold: 0 });
  });

  it('un PATCH vide est refusé, un PATCH partiel est accepté', () => {
    expect(UpdateItemBodySchema.safeParse({}).success).toBe(false);
    expect(UpdateItemBodySchema.safeParse({ threshold: 3 }).success).toBe(true);
  });

  it('règles de mouvement : quantité > 0 et destination réservée aux transferts', () => {
    const base = { itemId: randomUUID(), warehouseId: randomUUID(), quantity: 2 };
    expect(CreateMovementBodySchema.safeParse({ ...base, type: 'IN' }).success).toBe(true);
    expect(CreateMovementBodySchema.safeParse({ ...base, type: 'IN', quantity: 0 }).success).toBe(
      false,
    );
    expect(
      CreateMovementBodySchema.safeParse({ ...base, type: 'IN', toWarehouseId: randomUUID() })
        .success,
    ).toBe(false);
    expect(CreateMovementBodySchema.safeParse({ ...base, type: 'TRANSFER' }).success).toBe(false);
    expect(
      CreateMovementBodySchema.safeParse({ ...base, type: 'TRANSFER', toWarehouseId: randomUUID() })
        .success,
    ).toBe(true);
  });
});
