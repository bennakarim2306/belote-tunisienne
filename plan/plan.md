# Plan — Efficacité serveur de Belote Tunisienne (audit + optimisation orientée croissance)

Belote Tunisienne est un jeu de belote mobile multijoueur en temps réel. Ce plan réduit fortement le coût serveur par joueur sans rien enlever à la réactivité ni aux fonctionnalités de l'application.

## Pour qui
Le propriétaire de l'application (coûts d'hébergement maîtrisés à mesure que les utilisateurs augmentent) et les joueurs (même qualité, batterie et données mobiles économisées).

## Constat de l'audit (d'après les statistiques observées)
- La charge absolue actuelle est faible (~0,3 requête/seconde), mais le **coût par joueur** est élevé et croît linéairement avec le nombre d'utilisateurs : c'est lui qu'il faut corriger avant la croissance. Remarque : les tableaux « 60 min » et « 24 h » affichaient les mêmes chiffres car le comptage venait de démarrer au redéploiement — il n'y a pas eu de pic anormal.
- **Amis / notifications / invitations (368 évts/h, ~8,8 par joueur et par minute)** : chaque écran interroge le serveur séparément toutes les ~7 secondes. C'est le poste n° 1.
- **États de jeu envoyés (365 évts/h, ~20 par joueur et par minute)** : chaque action (y compris chaque carte jouée par un bot) renvoie l'état complet de la partie à chaque joueur, même quand rien d'utile n'a changé pour lui.
- **Présence (150 évts/h)** et **reprise de partie (28 évts/h)** : interrogations périodiques qui continuent même quand l'application est en arrière-plan.
- **Matchmaking (~11,5 évts/joueur/min)** : vérification toutes les 1,5 s pendant toute l'attente.
- Les anciennes versions (1.1.0, 1.0.4 : 7 utilisateurs actifs) jouent encore leurs parties solo via le serveur ; elles disparaîtront d'elles-mêmes avec les mises à jour.

## Principes (qualité garantie)
- Aucune règle de jeu, aucune animation, aucun écran supprimé ; le jeu en ligne reste piloté par le serveur en temps réel.
- Les infos sociales restent **quasi temps réel (~7 s)** comme aujourd'hui — on réduit le *nombre et le poids* des appels, pas la fraîcheur.
- Compatibilité : les versions 1.2.2 et antérieures continuent de fonctionner telles quelles ; les gains s'appliquent aux joueurs qui mettent à jour.

## Expérience et fonctionnement cible
- **Un seul appel « instantané » regroupé** : au lieu de 4-6 appels séparés (amis, notifications, invitations, présence, partie en cours), l'application fait UN appel léger toutes les ~7 s qui renvoie tout — et le serveur répond « rien de nouveau » (réponse quasi vide) quand rien n'a changé. Même fraîcheur, ~70-80 % d'appels et de données en moins.
- **Silence en arrière-plan** : application minimisée ou écran éteint = zéro appel ; reprise instantanée au retour.
- **Matchmaking dégressif** : vérification rapide les 20 premières secondes, puis espacée ; un adversaire trouvé est détecté en 5 s maximum.
- **États de jeu optimisés** : le serveur n'envoie plus d'état identique deux fois et compresse les séquences de bots, sans changer ce que le joueur voit.

## Parcours joueur (inchangé en apparence)
Le joueur ouvre l'application, voit ses amis/invitations à jour, lance une partie, joue en temps réel, reçoit ses notifications — rien ne change visuellement. Seule différence mesurable : sur le tableau admin, « Évts/joueur/min » chute (objectif : amis < 2, états envoyés ≈ divisés par 2) ; sur téléphone, moins de batterie et de données consommées.

## Phases d'implémentation

### Phase 1 — MVP (construite maintenant)
1. Endpoint « instantané » regroupé + réponses « rien de nouveau » ultra-légères ; l'application l'utilise pour amis, notifications, invitations, présence et partie en cours (fraîcheur ~7 s conservée).
2. Arrêt total des appels quand l'application est en arrière-plan, reprise immédiate au premier plan.
3. Matchmaking à rythme dégressif (rapide 20 s, puis espacé).
4. Jeu : suppression des envois d'états strictement identiques et espacement raisonné pendant les séquences de bots (aucun changement visible).
5. Garde-fous serveur : limite de débit par compte (protection contre un client défaillant ou malveillant) — sans impact sur un usage normal.
6. Tableau admin : les nouvelles cibles d'efficacité restent mesurables (avant/après visibles sur « Évts/joueur/min »).

### Phase 2 — Temps réel poussé
- Un canal de notification unique par joueur connecté (connexion légère permanente) : amis, invitations et « adversaire trouvé » sont poussés instantanément → fraîcheur meilleure qu'aujourd'hui avec quasi zéro interrogation périodique.
- États de jeu différentiels (n'envoyer que ce qui a changé) pour diviser encore le volume par partie.
- Alertes automatiques sur le tableau admin si le coût par joueur dépasse un seuil.

### Phase 3 — Préparation à l'échelle
- Mise en cache des données chaudes (classement, profils publics) et revue des index de base de données.
- Archivage/purge automatique des vieilles données (métriques, parties anciennes) pour contenir la taille de la base.
- Vérification de la montée en charge multi-instances (le jeu est déjà conçu pour) et tableau de capacité : « combien de joueurs simultanés le palier actuel supporte ».

## Hypothèses retenues
- Les gains principaux passent par une **nouvelle version de l'application** (choisi) : ils bénéficient aux joueurs à jour ; les 7 utilisateurs sur vieilles versions ne cassent rien mais ne profitent pas des gains.
- Fraîcheur sociale maintenue à ~7 s (choisi « quasi temps réel ») : la réduction vient du regroupement et des réponses vides, pas du ralentissement.
- La charge actuelle ne justifie aucun changement d'hébergement : l'objectif est l'efficacité par joueur en prévision de la croissance (585 inscrits, ~300 actifs).
- Les notifications push existantes (joueurs en attente, heure de pointe) sont conservées telles quelles.
- La rétention des métriques serveur reste à 7 jours (coût négligeable : base totale 1,8 Mo).
- Aucun changement de design, de sons, de publicités ni de règles de jeu.
