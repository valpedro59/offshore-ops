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
│   ├── gateway/          # entrée unique : JWT, RBAC, rate limiting, proxy
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
pnpm dev                        # gateway :4000 · auth :4001 · stock :4002
```

Tout passe par la **gateway** (`http://localhost:4000`). Contrats d'API : <http://localhost:4000/docs>.

### Essayer l'API

```bash
# 1. Créer une société et son admin, récupérer le jeton
TOKEN=$(curl -s localhost:4000/api/v1/auth/register -H 'content-type: application/json' \
  -d '{"companyName":"Congo Offshore Services","fullName":"Val Pedro","email":"val@cos.cg","password":"un-mot-de-passe-solide"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')

# 2. Créer un entrepôt et un article
curl -s localhost:4000/api/v1/stock/warehouses -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"name":"Magasin principal"}'
curl -s localhost:4000/api/v1/stock/items -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"sku":"CASQUE-01","name":"Casque de sécurité","threshold":5}'

# 3. Voir les niveaux
curl -s localhost:4000/api/v1/stock/levels -H "authorization: Bearer $TOKEN"
```

> ⚠️ `auth-service` (:4001) et `stock-service` (:4002) ne sont pas faits pour être appelés directement : le `stock-service` fait confiance aux en-têtes d'identité posés par la gateway. En production ils ne doivent être joignables que depuis la gateway (réseau interne).

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
- **Gateway à refus par défaut** : seules les routes listées dans `apps/gateway/src/policy.ts` sont transmises ; l'identité envoyée par le client est toujours effacée puis réécrite depuis le JWT vérifié (voir [ADR-004](docs/adr/004-gateway-refus-par-defaut.md)).
- **Limitation de débit** : par IP, plus strict sur la connexion, et par utilisateur.

## Limites connues

- PGlite exécute les transactions l'une après l'autre : le test de concurrence valide la logique, mais un test sur un vrai Postgres (conteneur de service en CI) reste à ajouter au sprint 5.
- Les utilisateurs sont créés par l'admin avec un mot de passe initial ; l'invitation par email viendra plus tard.
- La limitation de débit est en mémoire : valable pour une instance, à remplacer par Redis dès qu'il y a plusieurs réplicas.
- Pas encore d'événements : l'alerte de seuil est renvoyée dans la réponse du mouvement (`thresholdCrossed`) et sera publiée sur le bus au sprint 4.

## Auteur

**Val Clancy Pedro**, développeur fullstack, Pointe-Noire (Congo)
