# ADR-002 : PostgreSQL pour auth et stock, MongoDB pour le HSE et l'audit

- **Statut** : accepté
- **Date** : 2026-11-06

## Contexte

Le stock exige des transactions et des contraintes d'intégrité (jamais de quantité négative). Les incidents et inspections HSE ont des formulaires dont les champs varient selon le type.

## Décision

PostgreSQL (Drizzle ORM) pour `auth` et `stock` ; MongoDB pour `hse` et le journal d'audit (ajout seul).

## Alternatives écartées

- **Tout en PostgreSQL (JSONB)** : possible pour le HSE, mais on perd l'occasion de justifier un choix SQL/NoSQL selon le besoin.
- **Tout en MongoDB** : transactions multi-documents possibles, mais les contraintes et le verrouillage de ligne du stock sont plus naturels en SQL.

## Conséquences

Deux technologies à exploiter, deux stratégies de sauvegarde. En contrepartie : transaction + `SELECT ... FOR UPDATE` + `CHECK (quantity >= 0)` pour le stock, schéma souple pour le HSE.
