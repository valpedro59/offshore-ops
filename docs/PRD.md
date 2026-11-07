# Offshore Ops – PRD

*Product Requirements Document · Version 0.1 · Auteur : Val Clancy Pedro*

## 1. Contexte

À Pointe-Noire, les entreprises parapétrolières et les sous-traitants des opérateurs offshore gèrent leur activité avec un mélange d'Excel, de papier, de WhatsApp et de logiciels isolés. Le stock du magasin, la conformité HSE du personnel, la flotte de véhicules et la facturation des prestations vivent dans des outils séparés, sans lien entre eux.

**Offshore Ops** est une plateforme SaaS B2B tout-en-un qui regroupe ces besoins dans une seule application.

## 2. Problème à résoudre

- Les ruptures de stock et les écarts d'inventaire ne sont détectés qu'après coup.
- Les certificats HSE du personnel (BOSIET, visite médicale, habilitations) expirent sans alerte, ce qui bloque des embarquements ou expose l'entreprise à des non-conformités.
- Les incidents et inspections HSE sont consignés sur papier, difficiles à retrouver et à analyser.
- La facturation des prestations est manuelle, source d'oublis et de retards de paiement.
- Le client doit jongler entre plusieurs outils.

## 3. Objectifs

| # | Objectif | Indicateur de succès |
| --- | --- | --- |
| O1 | Donner une vue fiable du stock en temps réel | Écart d'inventaire < 2 % après 3 mois d'usage |
| O2 | Éviter les expirations de certificats non anticipées | 100 % des expirations notifiées 30 jours avant |
| O3 | Centraliser incidents et inspections HSE | Rapport créé en moins de 3 minutes |
| O4 | Accélérer la facturation | Facture générée à partir d'une prestation en 1 clic |
| O5 | Une seule plateforme au lieu de plusieurs outils | Un seul compte, un seul tableau de bord |

## 4. Utilisateurs cibles (personas)

- **Responsable magasin / logistique** : suit les entrées, sorties et seuils d'alerte.
- **Responsable HSE** : gère le personnel, les certificats, les incidents et les inspections.
- **Responsable flotte** : suit les véhicules, l'entretien et les affectations.
- **Comptable / administratif** : émet et suit les factures.
- **Direction / admin société** : consulte les tableaux de bord et gère les accès.

Client type : PME de sous-traitance ou de services parapétroliers à Pointe-Noire (10 à 200 employés).

## 5. Périmètre

### MVP (inclus)

- Authentification, sociétés (multi-tenant) et rôles.
- Module **Stock** : articles, entrepôts, mouvements, seuils d'alerte.
- Module **HSE** : incidents, inspections, rapports.
- Journal d'audit.
- Alertes (seuil de stock franchi).
- Assistant IA (résumé d'incidents, questions sur le stock).

### Phase 2 (hors MVP)

- Suivi des certificats HSE du personnel avec alertes d'expiration.
- Module **Flotte**.
- Module **Facturation**.
- Paiement Mobile Money, application mobile, mode hors ligne.

### Hors périmètre

- Comptabilité générale complète, paie, RH.
- Intégration directe avec les systèmes des opérateurs pétroliers.

## 6. Exigences produit de haut niveau

| ID | Exigence | Priorité |
| --- | --- | --- |
| P-01 | Un utilisateur se connecte de façon sécurisée et ne voit que les données de sa société | Must |
| P-02 | Le magasinier enregistre une entrée ou une sortie de stock en moins de 30 secondes | Must |
| P-03 | Le système alerte quand un article passe sous son seuil | Must |
| P-04 | Le responsable HSE déclare un incident avec pièces jointes | Must |
| P-05 | Toute action sensible est tracée dans un journal d'audit | Must |
| P-06 | L'assistant IA répond à des questions sur le stock et résume des incidents | Should |
| P-07 | Export CSV / PDF des listes et rapports | Should |
| P-08 | Tableau de bord synthétique par rôle | Should |
| P-09 | Interface utilisable sur mobile (responsive) | Should |
| P-10 | Alertes d'expiration de certificats | Could (phase 2) |

## 7. Exigences non fonctionnelles (résumé)

- **Sécurité** : données isolées par société, mots de passe hachés, accès par rôle.
- **Performance** : pages principales chargées en moins de 2 secondes sur connexion 4G.
- **Disponibilité** : objectif 99 % pour le MVP.
- **Connectivité** : l'interface doit rester légère, la connexion étant parfois instable.
- **Langue** : français en priorité, anglais en option.

Le détail figure dans le TRD.

## 8. Hypothèses et risques

| Risque / hypothèse | Impact | Mitigation |
| --- | --- | --- |
| Les clients utilisent déjà Excel et résistent au changement | Adoption faible | Import CSV, interface très simple |
| Connectivité instable | Frustration | Interface légère, mode hors ligne en phase 2 |
| Périmètre trop large pour un développeur seul | Retard | MVP limité à 3 modules, livraison par sprints |
| Confidentialité des données des clients | Perte de confiance | Isolation par société, journal d'audit |

## 9. Jalons

| Jalon | Contenu | Cible |
| --- | --- | --- |
| M1 | Auth + Stock + gateway | Sprint 2 |
| M2 | Front + HSE + événements | Sprint 4 |
| M3 | CI/CD + Kubernetes | Sprint 6 |
| M4 | Assistant IA + finition + démo | Sprint 8 |

## 10. Questions ouvertes

- Quel modèle de tarification (par utilisateur, par module, forfait) ?
- Quel premier client pilote pour valider le besoin ?
- Quelles réglementations HSE locales faut-il intégrer précisément ?
