import type { Role } from '@offshore/shared';

export type Service = 'auth' | 'stock';

export type Rule = {
  methods: string[];
  pattern: RegExp;
  service: Service;
  /** Route publique : pas de jeton exigé. */
  public?: boolean;
  /** Limiteur strict par IP (anti force brute). */
  strictLimit?: boolean;
  /** Rôles autorisés ; absent = tout utilisateur authentifié. */
  roles?: Role[];
};

const WRITE = ['POST', 'PATCH', 'PUT', 'DELETE'];
const WRITERS: Role[] = ['admin', 'storekeeper'];

/**
 * Table de routage ET d'autorisation. Seules les routes listées ici sont transmises :
 * tout le reste est refusé par défaut (404), sans jamais atteindre un service.
 * Les services revérifient les rôles de leur côté (défense en profondeur).
 */
export const RULES: Rule[] = [
  // --- auth : routes publiques ---
  {
    methods: ['POST'],
    pattern: /^\/api\/v1\/auth\/(register|login|refresh|logout)\/?$/,
    service: 'auth',
    public: true,
    strictLimit: true,
  },
  // --- auth : routes protégées ---
  { methods: ['GET'], pattern: /^\/api\/v1\/auth\/me\/?$/, service: 'auth' },
  {
    methods: ['GET', ...WRITE],
    pattern: /^\/api\/v1\/auth\/users(\/[0-9a-f-]{36})?\/?$/,
    service: 'auth',
    roles: ['admin'],
  },
  // --- stock ---
  {
    methods: ['GET'],
    pattern: /^\/api\/v1\/stock\/(items|warehouses|movements|levels)(\/[0-9a-f-]{36})?\/?$/,
    service: 'stock',
  },
  {
    methods: WRITE,
    pattern: /^\/api\/v1\/stock\/(items|warehouses|movements)(\/[0-9a-f-]{36})?\/?$/,
    service: 'stock',
    roles: WRITERS,
  },
];

export function matchRule(method: string, path: string): Rule | undefined {
  return RULES.find((r) => r.methods.includes(method) && r.pattern.test(path));
}
