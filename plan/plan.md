# Solo 100 % hors-ligne & réduction des coûts serveur

Le mode Solo contre l'IA tourne déjà entièrement sur le téléphone ; ce plan réduit les derniers appels serveur inutiles pendant ces parties et organise l'extinction progressive de l'ancien circuit serveur encore utilisé par les anciennes versions de l'app.

## Pour qui
- Le propriétaire du jeu : moins de ressources serveur consommées, donc moins de coûts.
- Les joueurs : aucun changement visible — le jeu reste identique.

## Constat (état actuel)
- Le Solo (1 joueur contre 3 IA) est déjà 100 % hors-ligne dans la version actuelle : moteur de jeu sur le téléphone, aucun appel serveur pendant la partie.
- Le coût observé vient principalement des **anciennes versions de l'app** encore installées, qui créent toujours leurs parties solo sur le serveur via l'ancien point d'entrée.
- Pendant une partie hors-ligne, la version actuelle envoie encore de petits appels périodiques : signal de présence (point vert « en ligne » pour les amis) toutes les 30 s et compteur « des joueurs attendent en ligne » toutes les 30 s — deux appels séparés. L'écran d'accueil, lui, interroge le serveur toutes les 5 s.

## Décisions actées
- L'ancien point d'entrée solo serveur **reste actif** pendant la transition ; le coût fond à mesure que les joueurs mettent à jour.
- La partie finale du tutoriel (avec le Coach) **reste sur le serveur** (jouée une seule fois par joueur).
- Un salon privé démarré seul (sièges remplis par l'IA) **reste sur le serveur**.
- Le Duo contre IA reste sur le serveur par nature (deux téléphones à synchroniser).

## Fonctionnalités et expérience
- Parties solo hors-ligne inchangées pour le joueur : lancement instantané, reprise après fermeture, sons, pubs de fin de match, statistiques.
- Appels serveur pendant une partie hors-ligne divisés par plus de deux : présence et compteur de joueurs fusionnés en un seul appel, espacé à 60 s.
- Écran d'accueil moins bavard : rafraîchissement des compteurs toutes les 15 s au lieu de 5 s.
- L'incitation « des joueurs attendent une partie en ligne » reste affichée pendant les parties solo.

## Parcours utilisateur
Identique à aujourd'hui : Accueil → Jouer → Solo → la partie se joue sur le téléphone → fin de match (pub, scores, rejouer / accueil). Rien ne change à l'écran ; seuls les échanges réseau en arrière-plan sont allégés.

## Apparence
Aucun changement visuel : même thème doré « Luxe Tunisien », mêmes écrans, mêmes textes.

## Phases de réalisation

### Phase 1 — construite maintenant (MVP)
- Fusion du signal de présence et du compteur « joueurs en attente » en un seul appel serveur.
- Espacement de cet appel à 60 s pendant les parties solo hors-ligne (au lieu de 2 appels / 30 s).
- Espacement du rafraîchissement de l'écran d'accueil à 15 s (au lieu de 5 s).
- Aucune modification de l'ancien point d'entrée solo serveur, du tutoriel ni des salons privés.

### Phase 2 — suivi de la transition
- Ligne dédiée dans le tableau de bord admin : nombre de parties solo encore créées sur le serveur par les anciennes versions, semaine par semaine, pour voir le coût résiduel fondre et décider du bon moment pour couper.

### Phase 3 — extinction définitive
- Coupure de l'ancien point d'entrée solo serveur une fois son trafic proche de zéro.
- En option à ce moment-là : bascule hors-ligne de la partie finale du tutoriel et du salon privé démarré seul, si le coût résiduel le justifie.

## Hypothèses
- Le mode Solo actuel étant déjà hors-ligne, aucune refonte du moteur de jeu n'est nécessaire ; le travail porte uniquement sur les appels réseau périphériques.
- Le signal de présence est conservé (sinon les amis ne verraient plus le point vert « en ligne ») mais regroupé avec le compteur de joueurs.
- La télémétrie de fin de partie solo (une seule petite requête par match, qui alimente les statistiques admin) est conservée : coût négligeable.
- L'espacement du rafraîchissement de l'accueil retarde d'au plus ~15 s l'apparition de la pastille « reprendre la partie » et des invitations duo : jugé acceptable.
- Ces allègements sont côté app : ils prennent effet chez les joueurs après publication d'un nouveau build (APK) ; les anciennes versions restent inchangées.
- Aucun changement de règles du jeu : la parité des moteurs Python / TypeScript n'est pas touchée.
