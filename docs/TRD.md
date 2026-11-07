# Offshore Ops – TRD

*Technical Requirements Document · Version 0.1 · Auteur : Val Clancy Pedro*

Ce document décrit **comment** le système est construit : architecture, stack, données, sécurité, déploiement et qualité. Il répond au PRD et au FRD.

## 1. Principes d'architecture

1. **Microservices avec une base par service.** Aucun service ne lit la base d'un autre.
2. **Synchrone (REST) pour les lectures, asynchrone (événements) pour les effets de bord.**
3. **Contrat d'abord** : OpenAPI par service, schémas zod partagés.
4. **Observabilité dès le départ** : logs structurés, `correlation-id`, endpoints de santé.
5. **Tout est conteneurisé** et déployable de façon reproductible.
6. **Chaque décision structurante est documentée** dans un ADR.

## 2. Vue d'ensemble

```
Next.js (front)
      │
  API Gateway  ── JWT, rate limiting, routage
      │
 ┌────┼─────────────┬──────────────┐
 auth-service   stock-service   hse-service   ai-service
 (Postgres)     (Postgres)      (MongoDB)     (LLM)
      └──── événements (Redis Streams / BullMQ) ────┘
                       │
                  audit-log (MongoDB)
```

## 3. Stack technique

| Couche | Choix | Justification |
| --- | --- | --- |
| Langage | TypeScript (strict) | Sûreté de typage, partage de types entre services et front |
| Front | Next.js + React, Tailwind | SSR, routage, productivité |
| Services | Node.js + Express (ou Fastify) | Déjà maîtrisé, écosystème riche |
| SQL | PostgreSQL | Données relationnelles et transactionnelles (utilisateurs, stock) |
| NoSQL | MongoDB | Documents flexibles (incidents, inspections, audit) |
| ORM / accès | Drizzle ORM (Postgres), Mongoose ou driver natif (Mongo) | Typage, migrations |
| Validation | zod | Contrats partagés dans `packages/shared` |
| Cache / bus | Redis (cache, rate limiting, Streams ou BullMQ) | Un seul composant pour plusieurs besoins |
| Auth | JWT (access + refresh), Argon2 | Standard, sans état côté services |
| Logs | Pino | Rapide, JSON structuré |
| Tests | Vitest, Supertest, Playwright | Unitaire, intégration, E2E |
| Monorepo | pnpm workspaces | Partage de code, scripts communs |
| Conteneurs | Docker, Docker Compose | Dev local reproductible |
| Orchestration | Kubernetes (kind en local, puis cloud free tier) | Compétence demandée |
| CI/CD | GitHub Actions | Intégré au dépôt |
| IA | API Claude avec tool calling | Assistant FR-AI-\* |

## 4. Services

### gateway

- Point d'entrée unique ; route vers les services.
- Vérifie le JWT, ajoute `x-user-id`, `x-company-id`, `x-role` et `x-correlation-id`.
- Rate limiting par IP et par utilisateur (Redis).
- CORS, Helmet.

### auth-service (Postgres)

- Tables : `companies`, `users`, `refresh_tokens`.
- Hachage Argon2 ; verrouillage après 5 échecs.
- Émet les JWT ; clé de signature fournie par variable d'environnement.

### stock-service (Postgres)

- Tables : `items`, `warehouses`, `stock_movements`, `stock_levels`.
- Un mouvement et la mise à jour du niveau se font dans **une transaction**.
- Verrouillage de ligne (`SELECT ... FOR UPDATE`) pour éviter les sorties concurrentes qui dépassent le stock.
- Publie `stock.movement.created` et `stock.threshold.crossed`.

### hse-service (MongoDB)

- Collections : `incidents`, `inspections`, `inspection_templates`, `corrective_actions`.
- Pièces jointes stockées dans un stockage objet (S3 compatible ou disque en dev) ; seule la référence est en base.
- Publie `hse.incident.created`.

### audit (consommateur d'événements)

- Écoute tous les événements métier et écrit dans la collection `audit_logs` (MongoDB), en ajout seul.

### ai-service

- Appelle l'API Claude avec des outils (`get_stock_level`, `list_low_stock`, `list_incidents`).
- Les outils appellent les services via la gateway avec **le jeton de l'utilisateur** : l'assistant n'a jamais plus de droits que lui.
- Lecture seule dans le MVP. Les clés d'API restent côté serveur.

## 5. Modèle de données (extraits)

### Postgres – stock-service

| Table | Colonnes principales |
| --- | --- |
| `items` | id, company\_id, sku (unique par société), name, category, unit, threshold, archived\_at |
| `warehouses` | id, company\_id, name |
| `stock_movements` | id, company\_id, item\_id, warehouse\_id, type (IN/OUT/TRANSFER), quantity, reason, reference, created\_by, created\_at |
| `stock_levels` | item\_id, warehouse\_id, quantity (contrainte ≥ 0) |

Chaque table métier porte un `company_id` indexé : toutes les requêtes sont filtrées par société.

### MongoDB – hse-service (exemple d'incident)

```json
{
  "_id": "...",
  "companyId": "...",
  "type": "near_miss",
  "severity": "high",
  "status": "open",
  "occurredAt": "2026-11-02T08:30:00Z",
  "location": "Base de Pointe-Noire",
  "description": "...",
  "people": ["..."],
  "attachments": [{ "key": "...", "name": "photo1.jpg" }],
  "history": [{ "status": "open", "by": "...", "at": "..." }]
}
```

## 6. API et événements

- **REST JSON**, versionnée (`/api/v1/...`), documentée en OpenAPI.
- Erreurs au format uniforme : `{ "error": { "code", "message", "details" } }`.
- Pagination par curseur ou `page` / `limit`.
- **Événements** : enveloppe commune `{ id, type, version, occurredAt, companyId, correlationId, payload }` ; consommateurs **idempotents** (un événement rejoué ne crée pas de doublon).

Exemples d'endpoints :

| Méthode | Route | Description |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | Connexion |
| POST | `/api/v1/auth/refresh` | Renouvellement du jeton |
| GET | `/api/v1/stock/items` | Liste des articles |
| POST | `/api/v1/stock/movements` | Nouveau mouvement |
| GET | `/api/v1/stock/levels` | Niveaux de stock |
| POST | `/api/v1/hse/incidents` | Déclarer un incident |
| GET | `/api/v1/audit/logs` | Journal d'audit (admin) |
| POST | `/api/v1/assistant/messages` | Question à l'assistant |

## 7. Sécurité

- Mots de passe : Argon2. Jeton d'accès : 15 minutes. Jeton de rafraîchissement : rotation et révocation.
- **Isolation multi-société** : `company_id` pris dans le jeton, jamais dans le corps de la requête.
- RBAC vérifié dans la gateway **et** dans chaque service (défense en profondeur).
- Validation zod de toutes les entrées ; requêtes paramétrées (pas de SQL concaténé) ; protection contre l'injection NoSQL.
- Secrets en variables d'environnement, jamais dans le dépôt ; Secrets Kubernetes en production.
- Helmet, CORS restrictif, rate limiting, limite de taille des uploads et contrôle du type MIME.
- Audit des dépendances (`pnpm audit`, Dependabot) en CI.
- Données de l'assistant : aucune donnée sensible dans les logs ; clé d'API IA jamais exposée au front.

## 8. Exigences non fonctionnelles

| Domaine | Exigence | Mesure |
| --- | --- | --- |
| Performance | p95 < 300 ms sur les lectures courantes, 200 utilisateurs simultanés | Test de charge k6 |
| Disponibilité | 99 % en MVP | Sondes `/health` et `/ready` |
| Scalabilité | Services sans état, mise à l'échelle horizontale | Réplicas Kubernetes |
| Maintenabilité | Couverture de tests ≥ 70 % sur la logique métier, lint sans erreur | CI |
| Portabilité | Lancement local en une commande | `docker compose up` |
| Frugalité réseau | Pages légères, compression, cache HTTP | Audit Lighthouse |

## 9. Observabilité

- Logs JSON Pino avec `correlation-id` propagé de la gateway aux services et dans les événements.
- `/health` (le processus vit) et `/ready` (les dépendances répondent) sur chaque service.
- Métriques de base (latence, erreurs) exposées au format Prometheus ; tableau Grafana en option.

## 10. Déploiement et infrastructure

- **Local** : `docker compose up` démarre Postgres, MongoDB, Redis, les services et le front.
- **Images** : un Dockerfile multi-étapes par service, utilisateur non root, images légères.
- **Kubernetes** : Deployment, Service, Ingress, ConfigMap, Secret, probes de liveness / readiness, limites de ressources, HPA en option. Test local avec kind, puis cluster cloud en free tier.
- **Environnements** : `dev` (local), `staging` (cluster), `prod` (démo publique).

## 11. CI/CD (GitHub Actions)

1. Déclenchement sur chaque Pull Request.
2. Installation pnpm avec cache, lint, vérification des types.
3. Tests unitaires et d'intégration (bases éphémères via conteneurs de service).
4. Build des images Docker.
5. Audit des dépendances.
6. Revue automatisée par IA sur la PR (commentaires, jamais de merge automatique).
7. Sur `main` : push des images vers un registre, déploiement vers staging, puis E2E Playwright.

**Règles Git** : branche `main` protégée, PR obligatoire, au moins une revue (auto-revue écrite en solo), commits conventionnels, une PR par issue.

## 12. Stratégie de tests

| Niveau | Outil | Cible |
| --- | --- | --- |
| Unitaire | Vitest | Règles métier (stock négatif, RBAC, validation) |
| Intégration | Vitest + Supertest + bases éphémères | Routes API, transactions, événements |
| Contrat | Schémas OpenAPI / zod | Compatibilité entre services |
| E2E | Playwright | Parcours A, B et C du FRD |
| Charge | k6 | Lecture du stock, création de mouvements |
| Sécurité | Audit de dépendances, tests d'autorisation | Isolation entre sociétés |

## 13. Développement assisté par IA

Le projet documente un usage réel d'agents IA dans le développement :

- Génération et amélioration de tests, refactorisation et analyse de code avec un agent de code.
- Revue de PR automatisée en CI.
- Un fichier `docs/ai-workflow.md` consigne, pour chaque usage : la tâche, ce que l'agent a produit, ce qui a été corrigé à la main, et les enseignements.
- Règle : tout code généré est relu et testé avant merge.

## 14. Architecture Decision Records prévus

| ADR | Décision |
| --- | --- |
| 001 | Microservices plutôt que monolithe modulaire (et ses compromis) |
| 002 | PostgreSQL pour le stock, MongoDB pour le HSE et l'audit |
| 003 | Événements asynchrones pour l'audit et les alertes |
| 004 | JWT sans état avec jeton de rafraîchissement rotatif |
| 005 | Redis Streams ou BullMQ comme bus |
| 006 | Stratégie multi-société : `company_id` dans chaque table |
| 007 | Assistant IA en lecture seule avec les droits de l'utilisateur |

## 15. Risques techniques

| Risque | Mitigation |
| --- | --- |
| Complexité opérationnelle des microservices pour un développeur seul | 3 services au départ, outillage partagé, compose unique |
| Coût du cloud | Free tier, cluster éteint hors démos |
| Cohérence entre services (événements perdus ou dupliqués) | Consommateurs idempotents, nouvelle tentative avec file d'échecs |
| Dérive de l'assistant IA (réponses fausses) | Outils à schéma strict, affichage des sources, lecture seule |
