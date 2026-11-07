# Offshore Ops – FRD

*Functional Requirements Document · Version 0.1 · Auteur : Val Clancy Pedro*

Ce document décrit **ce que fait** le système, fonction par fonction. Il découle du PRD. Le **comment** est dans le TRD.

## 1. Rôles et permissions

| Action | Admin | Magasinier | HSE | Lecteur |
| --- | --- | --- | --- | --- |
| Gérer les utilisateurs et rôles | ✓ |  |  |  |
| Créer / modifier un article | ✓ | ✓ |  |  |
| Enregistrer un mouvement de stock | ✓ | ✓ |  |  |
| Consulter le stock | ✓ | ✓ | ✓ | ✓ |
| Déclarer un incident / inspection | ✓ |  | ✓ |  |
| Consulter les rapports HSE | ✓ |  | ✓ | ✓ |
| Consulter le journal d'audit | ✓ |  |  |  |
| Utiliser l'assistant IA | ✓ | ✓ | ✓ | ✓ |

Chaque utilisateur appartient à **une société** et ne voit jamais les données d'une autre.

## 2. Module Authentification et sociétés

**FR-AUTH-01 – Inscription d'une société.** Un nouvel utilisateur crée une société (nom, email, mot de passe) et devient son administrateur.

**FR-AUTH-02 – Connexion.** Email + mot de passe. Le système retourne un jeton d'accès court et un jeton de rafraîchissement.

**FR-AUTH-03 – Rafraîchissement et déconnexion.** Le jeton de rafraîchissement permet de renouveler la session ; la déconnexion l'invalide.

**FR-AUTH-04 – Gestion des utilisateurs.** L'admin invite un utilisateur par email, lui attribue un rôle, le désactive ou change son rôle.

**FR-AUTH-05 – Verrouillage.** Après 5 échecs de connexion consécutifs, le compte est temporairement bloqué (15 minutes).

*Critères d'acceptation* : un utilisateur désactivé ne peut plus se connecter ; un jeton expiré est refusé avec un code 401.

## 3. Module Stock

**FR-STK-01 – Articles.** Créer, modifier, archiver un article : référence unique, désignation, catégorie, unité, seuil d'alerte, entrepôt par défaut.

**FR-STK-02 – Entrepôts.** Créer et lister des entrepôts / zones de stockage (ex. magasin principal, base offshore).

**FR-STK-03 – Mouvements.** Enregistrer une **entrée**, une **sortie** ou un **transfert** : article, quantité, entrepôt, motif, référence de document, date, auteur.

**FR-STK-04 – Cohérence.** Une sortie qui rendrait le stock négatif est refusée. Un mouvement ne se modifie pas : on le corrige par un mouvement inverse.

**FR-STK-05 – Niveau de stock.** Afficher la quantité courante par article et par entrepôt, avec recherche, filtres et pagination.

**FR-STK-06 – Historique.** Afficher l'historique des mouvements d'un article.

**FR-STK-07 – Alerte de seuil.** Quand le stock d'un article passe sous son seuil, une alerte est créée et visible sur le tableau de bord.

**FR-STK-08 – Import / export.** Import CSV d'articles ; export CSV de l'état du stock.

*Critères d'acceptation* : après une entrée de 10 unités, le niveau augmente de 10 ; deux sorties simultanées ne peuvent pas dépasser le stock disponible.

## 4. Module HSE

**FR-HSE-01 – Déclaration d'incident.** Formulaire : date, lieu, type (presqu'accident, blessure, dommage matériel, environnement), gravité, description, personnes concernées, photos / pièces jointes.

**FR-HSE-02 – Suivi d'incident.** Statuts : ouvert, en analyse, actions en cours, clôturé. Chaque changement de statut est horodaté et attribué.

**FR-HSE-03 – Actions correctives.** Associer à un incident des actions avec responsable et échéance.

**FR-HSE-04 – Inspections.** Créer une inspection à partir d'un modèle de checklist (les champs varient selon le type d'inspection), la remplir et la valider.

**FR-HSE-05 – Rapports.** Liste filtrable (période, type, gravité, statut) et export PDF d'un incident ou d'une inspection.

*Critères d'acceptation* : un incident clôturé ne peut plus être modifié ; une pièce jointe de plus de 10 Mo est refusée avec un message clair.

## 5. Événements, alertes et audit

**FR-EVT-01 – Journal d'audit.** Chaque création, modification ou suppression sur le stock, le HSE et les utilisateurs est enregistrée : qui, quoi, quand, avant / après.

**FR-EVT-02 – Consultation de l'audit.** L'admin filtre le journal par utilisateur, module, période.

**FR-EVT-03 – Notifications.** Les alertes (seuil de stock, incident grave) apparaissent dans l'application ; l'email est une option.

## 6. Assistant IA

**FR-AI-01 – Questions sur le stock.** L'utilisateur pose une question en langage naturel (« Combien de casques en stock au magasin principal ? ») ; l'assistant interroge le stock et répond.

**FR-AI-02 – Résumé d'incidents.** L'assistant résume les incidents d'une période et fait ressortir les récurrences.

**FR-AI-03 – Respect des droits.** L'assistant ne peut accéder qu'aux données que l'utilisateur est autorisé à voir.

**FR-AI-04 – Transparence.** Les réponses indiquent les données consultées ; l'assistant ne modifie aucune donnée dans le MVP (lecture seule).

## 7. Tableau de bord

**FR-DSH-01.** Selon le rôle : articles sous seuil, derniers mouvements, incidents ouverts, alertes récentes.

## 8. Parcours utilisateurs principaux

### Parcours A – Enregistrer une sortie de stock

1. Le magasinier se connecte.
2. Il ouvre « Stock », cherche l'article.
3. Il clique sur « Nouvelle sortie », saisit quantité et motif.
4. Le système valide, met à jour le niveau, écrit l'audit et déclenche une alerte si le seuil est franchi.

### Parcours B – Déclarer un incident

1. Le responsable HSE ouvre « Nouvel incident ».
2. Il remplit le formulaire et ajoute des photos.
3. Le système enregistre l'incident au statut « ouvert » et notifie l'admin si la gravité est élevée.
4. Il ajoute des actions correctives et suit la clôture.

### Parcours C – Interroger l'assistant

1. L'utilisateur ouvre l'assistant et pose sa question.
2. L'assistant appelle les services concernés selon les droits de l'utilisateur.
3. Il répond avec les chiffres et indique leur source.

## 9. Règles de gestion transverses

- Toutes les listes sont paginées (20 éléments par défaut) et filtrables.
- Les dates sont affichées au fuseau Africa/Brazzaville.
- Aucune suppression physique des données métier : archivage logique.
- Les messages d'erreur sont en français et explicites.

## 10. Hors MVP (rappel)

Certificats HSE du personnel, flotte, facturation, Mobile Money, mode hors ligne.
