# Plan — Expérience en ligne face à l'inactivité (Belote Tunisienne)

Les parties en ligne ne doivent plus jamais être paralysées par un joueur absent : le bot prend vite et visiblement le relais, et les absents sont écartés avant même que la partie ne démarre.

## Pour qui
Les joueurs en ligne (fini les attentes de 30 secondes à chaque tour d'un absent) et le propriétaire de l'application (meilleure rétention : une mauvaise partie en ligne fait fuir les nouveaux joueurs).

## Constat
Aujourd'hui, un joueur connecté mais inactif fait attendre la table 30 secondes à CHAQUE tour, pendant tout le match, sans jamais être remplacé. Et rien n'indique aux autres si un siège est tenu par un vrai joueur ou par un bot. Enfin, une partie peut démarrer avec des joueurs qui ne sont déjà plus devant leur écran.

## Fonctionnement cible

### Pendant la partie — temps de réflexion et relais par le bot
- Temps par tour en ligne : **20 secondes** (au lieu de 30). Si le joueur a laissé expirer son tour précédent, son tour suivant passe à **10 secondes**.
- Après **3 tours manqués de suite**, le bot prend le relais : il joue immédiatement, sans attente, pour le reste de l'absence. Un tour joué à temps remet le compteur à zéro.
- Le joueur absent **reprend sa place immédiatement** à son retour (bouton « Reprendre ma place » sur son écran) et le compteur repart de zéro.

### Transparence — qui joue vraiment ?
- Siège d'un joueur qui laisse filer ses tours : badge **« 💤 absent »** visible par toute la table.
- Siège repris par le bot : badge **« 🤖 bot »** clairement affiché tant que le bot joue.
- Messages d'ambiance dans la partie : « X est absent — un bot le remplace », « X est de retour ». Plus aucune ambiguïté sur qui joue.

### Avant la partie — vérification de présence
- Quand un match est trouvé, chaque joueur voit un bouton **« Accepter » à presser sous 10 secondes**.
- Si l'application est en arrière-plan à ce moment-là, une **notification push** est envoyée : « Partie trouvée ! Ouvre l'app pour accepter » (fonctionne sur les builds Android installés, pas sur Expo Go).
- Ceux qui acceptent repartent automatiquement **en tête de file** si un autre joueur fait défaut ; celui qui n'accepte pas est retiré de la recherche.

### Pédagogie plutôt que punition (pour l'instant)
- Le joueur écarté (non-acceptation) ou remplacé par un bot reçoit à son retour un **message d'avertissement** courtois : respecter les parties en ligne, ne pas lancer une recherche si l'on n'est pas disponible.
- Aucune sanction au premier incident. Les récidivistes seront traités en phase 2.

## Parcours joueur
Un joueur lance une recherche → match trouvé → il accepte en un tap (ou via la notification push s'il était ailleurs) → la partie démarre avec 4 joueurs réellement présents. Si quelqu'un décroche en cours de partie : 20 s, puis 10 s, puis le bot enchaîne sans attente avec un badge 🤖 visible ; le retour du joueur rend la main instantanément. La table ne subit au pire que ~50 secondes d'attente cumulée par absent, une seule fois, au lieu de 30 s à chaque tour.

## UI/UX
Aucun changement de design global : badges discrets sur les avatars (💤 / 🤖), bouton « Accepter » doré sur l'écran d'attente avec compte à rebours, bouton « Reprendre ma place » sobre pour le revenant, messages d'événements dans le fil existant de la partie. Tout est traduit (FR/AR/EN).

## Phases d'implémentation

### Phase 1 — MVP (construite maintenant)
1. Temps de tour en ligne : 20 s, puis 10 s après un tour manqué.
2. Relais par le bot après 3 tours manqués consécutifs ; reprise immédiate au retour (« Reprendre ma place »).
3. Badges 💤 / 🤖 sur les sièges + messages « absent / remplacé / de retour » visibles par toute la table.
4. Vérification de présence au match trouvé : bouton « Accepter » (10 s) + notification push si l'app est en arrière-plan ; les joueurs confirmés repassent en tête de file.
5. Message d'avertissement courtois au joueur écarté ou remplacé, à son retour.
6. Tableau admin : compteurs d'absences (tours manqués, remplacements par bot, non-acceptations) pour suivre le phénomène.

### Phase 2 — Récidivistes et équité
- Suivi de fiabilité par joueur (absences, abandons, non-acceptations sur les derniers jours).
- Récidivistes : l'absence en partie classée compte comme une **défaite avec perte d'ELO**, précédée d'un dernier avertissement clair.
- Statistiques admin enrichies (taux d'absence par jour, joueurs les moins fiables).

### Phase 3 — Fiabilité visible et matchmaking intelligent
- Indicateur de fiabilité sur le profil public (discret, non humiliant).
- Le matchmaking évite d'assembler les joueurs très fiables avec les récidivistes quand la file le permet.
- Confort : possibilité pour la table de voir l'historique de connexion du revenant (anti-abus).

## Hypothèses retenues
- « 3 tours manqués » signifie 3 tours **consécutifs** : un tour joué à temps remet le compteur à zéro.
- Les nouvelles durées (20 s / 10 s) s'appliquent aux parties **en ligne et salons privés** ; le solo contre l'IA et le tutoriel ne changent pas.
- La pause réseau existante en cas de déconnexion brutale (socket perdu) est **réduite de 60 s à 30 s** pour rester cohérente avec la nouvelle réactivité ; au-delà, le bot prend le relais comme aujourd'hui, siège toujours récupérable.
- Compatibilité anciennes versions : pour un joueur sur une ancienne version (sans bouton « Accepter »), le fait que son application interroge activement le serveur pendant la fenêtre de 10 s vaut acceptation automatique — personne n'est pénalisé pour ne pas avoir mis à jour.
- Si un joueur tape la notification push après l'expiration des 10 s, le match est déjà parti : il est remis **en tête de file** automatiquement.
- La notification push « Partie trouvée » utilise l'intégration push existante (builds Android déployés uniquement ; rien ne change pour iOS/Expo Go où seul le bouton s'applique).
- Le message d'avertissement est purement informatif en phase 1 (aucun blocage, aucune perte d'ELO) ; la règle « récidiviste = défaite ELO » arrive en phase 2 avec un seuil défini à ce moment-là.
- Le bot qui remplace un absent joue avec l'IA standard du jeu (même niveau que les bots actuels), instantanément (~1 s entre les coups pour rester lisible).
- Les gains nécessitent une mise à jour de l'application (nouveau build) ; les parties entre anciennes versions gardent l'ancien comportement.
