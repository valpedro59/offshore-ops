# ADR-001 : Microservices, une base par service

- **Statut** : accepté
- **Date** : 2026-11-06

## Contexte

Offshore Ops regroupe des domaines aux besoins différents (utilisateurs, stock transactionnel, rapports HSE flexibles). Le projet sert aussi de démonstration d'architecture distribuée.

## Décision

Un service par domaine (`auth`, `stock`, plus tard `hse`), chacun avec sa propre base. Aucun service ne lit la base d'un autre ; ils se parlent en REST (lectures) et par événements (effets de bord).

## Alternatives écartées

- **Monolithe modulaire** : plus simple à exploiter pour un développeur seul, mais ne démontre pas la gestion de services indépendants, de la gateway et de Kubernetes.
- **Base partagée** : simple, mais crée un couplage fort par le schéma.

## Conséquences

- Chaque service se déploie et évolue seul ; les schémas zod partagés (`@offshore/shared`) servent de contrat.
- Coût : plus d'outillage (compose, CI, observabilité) et une cohérence éventuelle plutôt qu'immédiate entre services.
- Les jointures entre domaines passent par l'API : `company_id` est dupliqué dans chaque base, sans clé étrangère inter-services.
