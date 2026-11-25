# L'Arcade de l'atelier — mise à jour

Cinq jeux : Ligne 1, Volt, Le Casino, Bloc Assaut, La Tour. Un seul compte, un classement par jeu et un classement général.

## Mettre à jour le site (GitHub)

1. Sur github.com/MassimoSnh/ligne1, supprime l'ancien dossier **js** qui est à la racine :
   clique sur le dossier `js`, puis les trois points « … » en haut à droite, puis **Delete directory** et **Commit changes**.
   (Ligne 1 a maintenant son propre dossier `ligne1/js`.)
2. Sur la page d'accueil du dépôt : **Add file > Upload files**. Glisse TOUT le contenu du dossier `arcade` :
   `index.html`, `firebase-config.js`, `firestore.rules`, `database.rules.json`, `LISEZMOI.md` et les dossiers `shared`, `ligne1`, `volt`, `casino`, `tir`, `tour`.
   GitHub remplace les anciens fichiers. Clique **Commit changes**.
3. Attends 1 à 2 minutes, puis ouvre le site avec Ctrl+F5.

## Mettre à jour les règles Firebase (obligatoire)

Console Firebase > Firestore Database > onglet **Règles** : efface tout, colle le contenu du nouveau `firestore.rules`, puis **Publier**.

## Activer la base temps réel (obligatoire pour le multi, le Saloon et « en ligne »)

1. Console Firebase, projet **ligne1** > menu de gauche **Build > Realtime Database** > **Créer une base de données**.
2. Emplacement : **Belgique (europe-west1)**. Mode : **verrouillé**. Valide.
3. En haut de la page, l'adresse de la base s'affiche. Elle doit être exactement
   `https://ligne1-default-rtdb.europe-west1.firebasedatabase.app`.
   Si elle est différente, recopie-la dans `firebase-config.js` (ligne `databaseURL`) avant l'envoi sur GitHub.
4. Onglet **Règles** de la Realtime Database : efface tout, colle le contenu de `database.rules.json`, puis **Publier**.

C'est gratuit : la formule Spark couvre largement une équipe (100 connexions simultanées).

## Facultatif : renommer le site en « arcade »

Dans le dépôt GitHub : **Settings**, champ **Repository name**, remplace `ligne1` par `arcade`, puis **Rename**.
L'adresse devient `https://massimosnh.github.io/arcade/`. Rien à changer dans Firebase (même domaine).
Pense juste à renvoyer le nouveau lien d'invitation à tes collègues.

## Les points

| Jeu | Classement du jeu | Ce qui compte au général |
|---|---|---|
| Ligne 1 | 100 pts par étoile + bonus de vitesse | les points du jeu |
| Volt | 50 pts par niveau fini + 100 par étoile + bonus chrono | les points du jeu |
| Le Casino | coins de la semaine (100 offerts chaque lundi) | meilleur gain au-delà des 100 coins, max 3 000 |
| Bloc Assaut | solo : 100 par robot (250 les rouges), +50 tête, 250 × vague nettoyée, bonus précision | record solo ÷ 4, + 100 par victoire en multi et + 5 par élimination (bonus multi plafonné à 4 000) |
| La Tour | étages | record × 25 |

## Le multijoueur

- **Bloc Assaut** : « Multijoueur entre collègues » > choisis Match à mort ou Domination > **Créer un salon**. Donne le code à 5 caractères. Les autres font « Rejoindre » avec le code. Tu lances quand vous êtes au moins 2 (8 max). Tab (ou le bouton Scores sur téléphone) affiche le tableau.
- **Le Saloon** (onglet du Casino) : roulette et blackjack partagés, même tirage pour tout le monde, avec la liste des présents et un chat.
- Sur toutes les pages, la pastille verte « N en ligne » montre qui est connecté et où.

Les anciens scores de Ligne 1 sont repris automatiquement à la première connexion.
