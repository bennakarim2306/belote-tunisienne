# Plan — Feedback joueurs par email + invitation à noter le jeu

Les joueurs de Belote Tunisienne peuvent envoyer leur avis en deux gestes depuis le profil ; chaque avis arrive par email. Au bon moment, une invitation discrète propose de noter le jeu sur les stores.

## Pour qui
Tous les joueurs (toutes langues FR/AR/EN) ; et pour vous, qui recevez chaque feedback directement par email sans ouvrir d'outil d'administration.

## Fonctionnalités clés et expérience

### 1. Feedback en deux gestes, envoyé par email
- Une entrée « Donner mon avis » dans l'écran Profil — aucun popup, zéro intrusion.
- Le formulaire tient sur un écran : trois humeurs à toucher (😞 😐 😍) + un champ message libre **optionnel**, bouton Envoyer. Possible d'envoyer l'humeur seule.
- Chaque envoi part immédiatement par email à **review-belote-tunisienne@karimbenna-itconsult.com** via votre compte Resend (expéditeur `no-reply@karimbenna-itconsult.com`, domaine déjà vérifié chez vous).
- L'email contient tout le contexte utile sans rien demander au joueur : humeur, message, pseudo, email du compte (pour répondre en « répondre à »), langue, plateforme (Android/iOS/web) et version de l'app.
- Chaque feedback est aussi conservé en base (trace de secours si l'email échoue).
- Garde-fou anti-spam discret : un envoi maximum toutes les 2 minutes par joueur.
- Message de remerciement après envoi, dans la langue du joueur.

### 2. Invitation à noter sur les stores — une fois le joueur fidèle
- Déclencheur : juste **après une victoire**, uniquement quand le joueur a terminé **au moins 5 parties** — le moment le plus positif, jamais en pleine partie.
- Utilise la **fenêtre de notation native** du téléphone (popup officielle Google Play / App Store) : 1–2 touches, sans quitter le jeu. C'est le système le moins intrusif qui existe — le téléphone peut même décider de ne pas l'afficher s'il juge le joueur trop sollicité.
- Fréquence stricte : au plus 1 tentative tous les 30 jours, 3 tentatives maximum au total, puis plus jamais. Rien n'est redemandé après une mise à jour.
- En complément, une ligne discrète « ⭐ Noter le jeu » dans le Profil, disponible à tout moment, qui ouvre la fiche du jeu sur le store.

### 3. Multilingue et cohérent
Tous les textes (formulaire, remerciement, invitation) existent en français, arabe et anglais, dans le style visuel actuel du jeu.

## Parcours joueur
1. **Feedback** : Profil → « Donner mon avis » → touche une humeur → écrit (ou pas) un message → Envoyer → remerciement. Vous recevez l'email dans la minute.
2. **Review** : le joueur gagne sa partie (≥ 5 parties jouées) → l'écran de victoire s'affiche normalement → la popup native du store apparaît par-dessus → il note en un geste ou la ferme → il n'est pas re-sollicité avant 30 jours.

## UI/UX
Aucun nouvel écran lourd : le formulaire de feedback s'ouvre en fiche par-dessus le profil, dans le thème actuel (tapis, doré, paysage). La popup de notation est celle du système — non personnalisable, par design des stores.

## Phases d'implémentation

### Phase 1 — MVP (construite maintenant, couvre 100 % de la demande)
1. Formulaire humeur + message dans le Profil, envoi backend, email Resend vers votre adresse, sauvegarde en base, anti-spam, remerciement — FR/AR/EN.
2. Invitation native à noter après une victoire (≥ 5 parties, 1×/30 jours, 3 max) + ligne « ⭐ Noter le jeu » dans le Profil.
3. Votre clé API Resend vous sera demandée via une carte sécurisée au démarrage de la construction.

### Phase 2 — Optionnel, plus tard
- Page admin des feedbacks (liste, répartition des humeurs par version/langue) ajoutée au tableau de stats existant.
- Lien direct « répondre au joueur » et marquage traité/non traité.

### Phase 3 — Optionnel, plus tard
- Capture d'écran jointe au feedback.
- Ciblage plus fin de l'invitation (ne jamais la montrer après une défaite récente ou un bug détecté).

## Hypothèses retenues
- **Une seule phase de développement** : la Phase 1 contient tout ce qui a été demandé ; les phases 2–3 sont de simples pistes, rien d'obligatoire.
- Votre domaine `karimbenna-itconsult.com` est déjà vérifié dans Resend ; seule votre **clé API Resend** est nécessaire (demandée de façon sécurisée, jamais en clair dans le chat).
- Expéditeur choisi : `no-reply@karimbenna-itconsult.com` ; le « répondre à » pointe vers l'email du compte joueur quand il existe.
- Le feedback est ouvert à tous les joueurs, y compris invités non connectés (pseudo « invité » dans l'email).
- « Fidèle » = 5 parties terminées (solo ou en ligne confondus) ; seuil ajustable à la demande.
- La popup native de notation **ne peut pas être testée dans Expo Go ni en préversion web** : elle ne fonctionne que sur l'app installée depuis le Play Store / App Store (ou en test interne Play). Le bouton « ⭐ Noter le jeu » du profil, lui, marche partout.
- Les identifiants store (lien Play Store / App Store) utilisés sont ceux du jeu publié ; si la fiche iOS n'existe pas encore, le bouton n'affiche que le lien Android en attendant.
- Aucune modification des règles du jeu, des publicités ou des notifications existantes.
