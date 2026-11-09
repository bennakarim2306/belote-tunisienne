# Plan — Des bots qui jouent comme un vrai partenaire de Belote

Amélioration de l'intelligence des bots de Belote Tunisienne pendant le jeu de la carte : gestion de l'atout, coopération avec le partenaire, reconnaissance du Capot et fin de manche. Les annonces restent inchangées ; c'est leur exploitation pendant le jeu qui s'améliore.

## Pour qui
Tous les joueurs : en solo hors-ligne, en Duo contre IA, dans les salons avec bots, dans le mode Apprenti (conseils du Coach) et lorsqu'un bot relaie un joueur absent en ligne.

## Précision importante sur l'architecture (réponse à votre question)
Le jeu possède **deux moteurs de bots identiques** :
- sur le **téléphone** pour le solo hors-ligne (le jeu marche sans connexion) ;
- sur le **serveur** pour tout le jeu en ligne (Duo contre IA, salons, remplacement d'un absent) — c'est volontaire : en ligne, le serveur reste l'arbitre pour empêcher la triche et pour que la partie continue même si un joueur coupe sa connexion.
Les deux moteurs sont déjà des copies strictes l'un de l'autre, et le resteront : **chaque amélioration est appliquée aux deux**, le comportement des bots sera identique partout. Le Coach du mode Apprenti, qui s'appuie sur la même logique, donnera automatiquement de meilleurs conseils.

## Ce qui existe déjà (et sera réutilisé, pas réécrit)
- Les annonces (90–130, soutien du partenaire) : jugées satisfaisantes, non modifiées.
- Une mémoire publique par bot : cartes déjà jouées, joueurs « coupés » dans une couleur, nombre d'atouts sortis, détection des cartes maîtresses.
- Des heuristiques de base : tirer l'atout quand l'équipe a le contrat, encaisser les maîtres, protéger les 10 secs, signaux indirects, jeu de fin de manche simple.
Les améliorations sont des extensions légères de ces briques — pas de moteur probabiliste, pas de simulation Monte-Carlo.

## Cœur des améliorations

### 1. Gestion de l'atout en équipe
Le bot estime en continu : atouts sortis / restants, sa propre force à l'atout, la force probable du partenaire (déduite des annonces), et si les adversaires en ont probablement encore. Si l'équipe contrôle l'atout et que les adversaires en détiennent encore, le bot **continue de faire tomber l'atout** quand cela protège ses futures cartes maîtresses — sans règle aveugle « fort à l'atout = toujours jouer atout » : préserver l'atout reste possible quand c'est meilleur.

### 2. Exploiter les annonces pendant le jeu
L'historique des enchères reste disponible pendant la carte. Exemple : le partenaire a annoncé 90 Cœur et a été soutenu → le bot raisonne en **contrôle d'atout d'équipe** : même faible à l'atout, il peut ouvrir atout pour faire dépenser les adversaires et laisser son partenaire prendre.

### 3. Estimation du partenaire sans jamais tricher
L'estimation du partenaire exclut toujours les cartes que le bot a en main et celles déjà jouées. S'il tient lui-même Valet + 9 d'atout alors que le partenaire a annoncé fort, la force du partenaire est forcément ailleurs : longueur d'atout, As, 10 protégés, belles couleurs annexes. Estimation de force globale, jamais une main exacte inventée.

### 4. Reconnaissance du Capot
Pas de règle du type « 90 → 100 → 110 = Capot ». Le potentiel de Capot est évalué à partir de : ma main réelle + force estimée du partenaire + cartes déjà tombées. Il devient plausible quand l'équipe contrôle l'atout, peut assécher celui des adversaires, et couvre les autres couleurs sans pli perdant inévitable. **Dès qu'un adversaire prend un pli, le mode Capot s'éteint immédiatement.** Quand le potentiel est très élevé, le bot privilégie la sécurisation de chaque pli plutôt que les points immédiats.

### 5. Fin de manche : raisonner sur l'ORDRE des cartes
Sur les 2-3 derniers plis, le bot distingue « maître de sa couleur » et « maître sûr » (imprenable compte tenu des atouts restants), puis choisit l'ordre qui sécurise le plus :
- garder l'atout maître pour le dernier pli (+10) quand le dépenser ferait perdre la dernière levée ;
- ou au contraire jouer l'atout maître D'ABORD pour assécher le dernier atout adverse, puis encaisser tranquillement la carte devenue imprenable.
À exactement 2 cartes, le bot **compare explicitement les deux ordres possibles** (A→B contre B→A) : plis garantis, chance de tout prendre, protection contre la coupe, bonus du dernier pli, points.

### 6. Connaissance mise à jour à chaque pli
Après chaque pli : atouts restants, cartes connues, qui peut encore couper, maîtres par couleur, estimation du partenaire, contrôle d'équipe, potentiel de Capot. Uniquement à partir d'informations publiques — le bot ne voit jamais les mains cachées.

## Parcours joueur
Rien ne change dans l'interface. La différence se sent à la table : les bots assèchent l'atout au bon moment, laissent la main au partenaire annoncé fort, ne gaspillent plus leur atout maître en fin de manche, et savent viser (ou défendre) un Capot. Le Coach donne des conseils alignés sur cette logique.

## UI/UX
Aucun changement visuel, sonore ou de règles. Aucune nouvelle option.

## Phases d'implémentation

### Phase 1 — MVP (construite maintenant)
1. Helpers réutilisables ajoutés aux deux moteurs (mêmes noms, même logique) : estimation du partenaire depuis les annonces (en excluant cartes vues/tenues), atouts restants, contrôle d'atout d'équipe, décision « tirer l'atout ou pas », distinction maître de couleur / maître sûr, potentiel de Capot avec extinction au premier pli perdu.
2. Intégration dans la sélection de carte existante : poursuite du tirage d'atout, ouverture d'atout faible vers le partenaire fort, protection des maîtres vulnérables, priorité « tous les plis » en mode Capot.
3. Fin de manche : évaluation d'ordre sur les 2-3 dernières cartes, comparaison explicite des deux ordres à 2 cartes.
4. Les 8 scénarios de test demandés, reproduits à l'identique sur les DEUX moteurs + vérification de parité Python/TypeScript (mêmes décisions sur les mêmes donnes).
5. Le Coach profite automatiquement de la nouvelle logique (même code).

### Phase 2 — Réglage par la télémétrie
- Suivi anonyme des performances des bots (taux de contrats réussis, Capots tentés/réussis) pour ajuster les seuils des heuristiques.
- Fichier de paramètres ajustable sans nouvelle version de l'app pour les bots côté serveur.

### Phase 3 — Niveaux de difficulté
- Profils de bots (débutant / normal / expert) en modulant les heuristiques (mémoire partielle, prudence Capot), choix du niveau en solo.

## Hypothèses retenues
- Les améliorations s'appliquent partout (deux moteurs identiques) : solo hors-ligne, Duo contre IA, salons, relais d'absent — conformément à la contrainte de parité existante du projet.
- Le Coach du mode Apprenti conseille avec la nouvelle logique (votre choix) ; les leçons scriptées du tutoriel ne changent pas.
- Les annonces elles-mêmes ne sont pas modifiées (consigne) ; seul leur usage pendant le jeu est ajouté.
- Approche strictement heuristique et légère (consigne) : pas de Monte-Carlo, pas de refonte, pas de code dupliqué — extension de la mémoire et de la sélection de carte existantes.
- Aucune modification de l'interface, des règles, des sons ou des publicités.
- La force accrue des bots vaut pour tous les matchs actuels (pas d'option pour garder « l'ancienne IA ») ; les niveaux de difficulté arrivent en phase 3.
- Les joueurs profitent du nouveau comportement hors-ligne après mise à jour de l'app ; en ligne (bots serveur), dès le redéploiement.
