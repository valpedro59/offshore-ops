# ADR-004 : Gateway à refus par défaut

- **Statut** : accepté
- **Date** : 2026-11-07

## Contexte

Les services métier font confiance à l'identité qu'ils reçoivent (`x-user-id`, `x-company-id`, `x-role`). Si un client pouvait forger ces en-têtes, l'isolation entre sociétés et les rôles tomberaient.

## Décision

La gateway est le seul point d'entrée et applique, dans cet ordre : limite par IP → route connue ? → limite stricte (routes de connexion) → vérification du JWT → contrôle du rôle → limite par utilisateur → transmission.

- **Refus par défaut** : une table (`policy.ts`) liste les routes transmises. Tout le reste répond 404 sans toucher un service.
- **Identité** : les en-têtes d'identité envoyés par le client sont toujours effacés, puis réécrits à partir du jeton vérifié (HS256 uniquement, `alg: none` refusé).
- **Corps non lu** : la gateway ne parse pas le JSON, elle le laisse passer tel quel.
- **Défense en profondeur** : chaque service revérifie le rôle et filtre par `company_id`.

## Alternatives écartées

- Proxy transparent par préfixe (`/api/v1/stock/*`) : plus court, mais toute nouvelle route d'un service serait exposée sans décision explicite.
- Vérifier le JWT dans chaque service : duplique la logique et la clé de signature partout.

## Conséquences

- Ajouter une route = ajouter une ligne dans `policy.ts` (et son test) : volontaire.
- La limitation de débit est en mémoire (une instance). Avec plusieurs réplicas, il faudra un stockage partagé (Redis) derrière la même interface `RateLimitStore`.
- Le service `stock` ne doit être joignable que depuis la gateway (réseau interne, `NetworkPolicy` Kubernetes au sprint 6).
- Piste : passer le JWT en RS256 pour que seule `auth` détienne la clé de signature.
