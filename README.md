# Offshore Ops

Plateforme SaaS B2B tout-en-un pour les entreprises parapétrolières et sous-traitants offshore de Pointe-Noire : **gestion de stock**, **conformité HSE** et **assistant IA**, dans une seule application.

> Projet fil rouge d'architecture microservices : TypeScript, Postgres + MongoDB, Docker, Kubernetes, CI/CD et développement assisté par IA.

## État d'avancement

| Sprint | Contenu                                                      | État                                 |
| ------ | ------------------------------------------------------------ | ------------------------------------ |
| 1      | Monorepo, `@offshore/shared`, `auth-service`, premiers tests | ✅                                   |
| 2      | `stock-service` + gateway                                    | `stock-service` ✅ · gateway à faire |
| 3      | Front Next.js                                                | à faire                              |
| 4      | HSE (MongoDB), événements, audit                             | à faire                              |
| 5      | CI/CD complète, E2E                                          | CI de base ✅                        |
| 6      | Kubernetes + cloud                                           | à faire                              |
| 7      | Assistant IA                                                 | à faire                              |
| 8      | Performance, sécurité, finition                              | à faire                              |

## Architecture cible

```
Next.js (front)
      │
  API Gateway  ── JWT, rate limiting, routage
      │
 ┌────┼─────────────┬──────────────┐
 auth-service   stock-service   hse-service   ai-service
 (Postgres)     (Postgres)      (MongoDB)     (LLM)
      └──── événements (Redis Streams / BullMQ) ────┘
```

Les décisions d'architecture sont dans [`docs/adr`](docs/adr). Les contrats d'API sont dans [`docs/api`](docs/api) (OpenAPI, **générés depuis les schémas zod** de `packages/shared`).

## Structure

```
offshore-ops/
├── apps/
│   ├── auth-service/     # utilisateurs, sociétés, JWT, RBAC   (Postgres)
│   └── stock-service/    # articles, entrepôts, mouvements     (Postgres)
├── packages/
│   ├── shared/           # schémas zod, erreurs, middlewares HTTP, logger, génération OpenAPI
│   └── config/           # tsconfig de base
├── infra/compose.yml     # Postgres (et Mongo/Redis pour plus tard)
├── docs/                 # adr/, api/, retros/ (+ PRD, FRD, TRD)
└── .github/workflows/ci.yml
```

## Prérequis

Node.js 20.6+, pnpm 9+, Docker.

## Démarrage

```bash
pnpm install
cp .env.example .env            # changer JWT_ACCESS_SECRET (32 caractères minimum)

docker compose -f infra/compose.yml up -d postgres-auth postgres-stock
pnpm db:migrate                 # applique les migrations des deux services
pnpm dev                        # auth-service :4001 · stock-service :4002
```

### Essayer l'API

```bash
# 1. Créer une société et son admin
curl -s localhost:4001/api/v1/auth/register -H 'content-type: application/json' \
  -d '{"companyName":"Congo Offshore Services","fullName":"Val Pedro","email":"val@cos.cg","password":"un-mot-de-passe-solide"}'
```

Le `stock-service` ne vérifie pas de JWT lui-même : il lit l'identité que la **gateway** ajoute après vérification (`x-user-id`, `x-company-id`, `x-role`). En attendant la gateway (sprint 2), simulez-la en local :

```bash
H='-H x-user-id:11111111-1111-4111-8111-111111111111 -H x-company-id:22222222-2222-4222-8222-222222222222 -H x-role:storekeeper -H content-type:application/json'
curl -s localhost:4002/api/v1/stock/warehouses $H -d '{"name":"Magasin principal"}'
```

> ⚠️ Ces en-têtes ne doivent **jamais** être acceptés depuis l'extérieur : le `stock-service` ne doit être joignable que via la gateway (réseau interne).

## Commandes

```bash
pnpm lint          # ESLint
pnpm typecheck     # TypeScript strict, tous les paquets
pnpm test          # Vitest (PGlite : vraie base Postgres en mémoire, sans Docker)
pnpm openapi       # régénère docs/api/*.yaml (la CI échoue si ce n'est pas à jour)
pnpm db:generate   # nouvelle migration Drizzle après modification d'un schema.ts
```

## Choix notables

- **Contrat d'abord** : un seul jeu de schémas zod valide les requêtes, type le code et génère OpenAPI.
- **Stock fiable** : un mouvement et la mise à jour des niveaux se font dans une transaction, avec `SELECT ... FOR UPDATE` (verrous pris dans un ordre fixe) et `CHECK (quantity >= 0)`.
- **Sessions** : jeton d'accès de 15 minutes, jeton de rafraîchissement opaque, haché, à usage unique ; la réutilisation d'un jeton consommé révoque la session.
- **Multi-société** : `company_id` dans chaque table et dans chaque requête ; il vient du jeton, jamais du corps de la requête.
- **Verrouillage** : 5 échecs de connexion → compte bloqué 15 minutes.

## Limites connues

- PGlite exécute les transactions l'une après l'autre : le test de concurrence valide la logique, mais un test sur un vrai Postgres (conteneur de service en CI) reste à ajouter au sprint 5.
- Les utilisateurs sont créés par l'admin avec un mot de passe initial ; l'invitation par email viendra plus tard.
- Pas encore d'événements : l'alerte de seuil est renvoyée dans la réponse du mouvement (`thresholdCrossed`) et sera publiée sur le bus au sprint 4.

## Auteur

**Val Clancy Pedro**, développeur fullstack, Pointe-Noire (Congo)
