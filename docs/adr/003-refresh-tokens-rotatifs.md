# ADR-003 : JWT d'accès court et jeton de rafraîchissement rotatif

- **Statut** : accepté
- **Date** : 2026-11-06

## Décision

Jeton d'accès JWT (HS256, 15 min) portant `sub`, `companyId` et `role`. Jeton de rafraîchissement opaque (48 octets aléatoires), stocké sous forme de hash SHA-256, à usage unique : chaque `refresh` révoque l'ancien jeton et en émet un nouveau. La présentation d'un jeton déjà consommé révoque toutes les sessions de l'utilisateur.

## Conséquences

- Les services n'ont pas besoin d'interroger `auth` à chaque requête.
- Un compte désactivé garde un accès valide jusqu'à 15 minutes au plus (durée du jeton d'accès) ; ses jetons de rafraîchissement sont révoqués immédiatement.
- Évolution possible : passer à RS256 pour que seule `auth` détienne la clé de signature.
