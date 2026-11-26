# L'Arcade de l'atelier — mise à jour

Dix jeux : Ligne 1, Volt, Le Casino, Bloc Assaut, La Tour, Blast, Course de Fenwick, Dessine et devine, La Rando Folle, Loup-Garou. Un seul compte, un classement par jeu et un classement général.

## Mettre à jour le site (GitHub)

1. Sur github.com/MassimoSnh/ligne1, supprime l'ancien dossier **js** qui est à la racine :
   clique sur le dossier `js`, puis les trois points « … » en haut à droite, puis **Delete directory** et **Commit changes**.
   (Ligne 1 a maintenant son propre dossier `ligne1/js`.)
2. Sur la page d'accueil du dépôt : **Add file > Upload files**. Glisse TOUT le contenu du dossier `arcade` :
   `index.html`, `firebase-config.js`, `firestore.rules`, `database.rules.json`, `LISEZMOI.md` et les dossiers `shared`, `icons`, `ligne1`, `volt`, `casino`, `tir`, `tour`, `blast`, `fenwick`, `dessin`, plus `manifest.webmanifest` et `sw.js` à la racine.
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

## Son et appli téléphone

- Bouton haut-parleur à côté de « ← Arcade » sur chaque page (ou touche M) : coupe ou remet tout le son. Le choix est mémorisé.
- Musique 8-bit sur l'accueil : bouton « Musique » (coupée par défaut).
- Installer l'appli : sur Android (Chrome), bouton « Installer l'appli » sur l'accueil. Sur iPhone (Safari) : Partager > Sur l'écran d'accueil (le bouton de l'accueil affiche l'aide). L'arcade s'ouvre alors en plein écran avec son icône.

## Défis de la semaine et fil d'activité

- Chaque lundi, 3 défis apparaissent sur l'accueil. Ils se valident tout seuls en jouant et rapportent des points bonus au général.
- Le bandeau jaune en haut de l'accueil fait défiler les actus : qui joue à quoi, qui mène chaque jeu, les gros gains et les défis réussis.
- Sur l'accueil, le bouton « Rejoindre » à côté d'un collègue t'emmène directement dans son salon.

## Les points

| Jeu | Classement du jeu | Ce qui compte au général |
|---|---|---|
| Ligne 1 | 100 pts par étoile + bonus de vitesse | les points du jeu |
| Volt | 50 pts par niveau fini + 100 par étoile + bonus chrono | les points du jeu |
| Le Casino | coins de la semaine (100 offerts chaque lundi) | meilleur gain au-delà des 100 coins, max 3 000 |
| Bloc Assaut | solo : 100 par robot (250 les rouges), +50 tête, 250 × vague nettoyée, bonus précision | record solo ÷ 4, + 100 par victoire en multi et + 5 par élimination (bonus multi plafonné à 4 000) |
| La Tour | étages | record × 25 |
| Blast | manches gagnées, collègues piégés | 120 par partie gagnée + 15 par piège + 25 par victoire contre les robots (max 5 000) |
| Course de Fenwick | place à l'arrivée, chrono | 150 la victoire, 80 la 2e, 40 la 3e + bonus meilleur tour (max 6 000) |
| Dessine et devine | jusqu'à 100 par mot trouvé, 25 par collègue qui trouve ton dessin | la moitié des points cumulés (max 5 000) |

## Le multijoueur

- **Bloc Assaut** : « Multijoueur entre collègues » > choisis Match à mort ou Domination > **Créer un salon**. Donne le code à 5 caractères. Les autres font « Rejoindre » avec le code. Tu lances quand vous êtes au moins 2 (8 max). Tab (ou le bouton Scores sur téléphone) affiche le tableau. Armes : 1 Fusil, 2 Mitraillette, 3 Pompe, 4 Sniper (clic droit pour la lunette), 5 Pistolet, 6 Couteau (ou F pour un coup rapide), 7 Lance-briques. C pour s'accroupir. Les maisons ont un étage avec un escalier et des fenêtres ouvertes.
- **Blast, Course de Fenwick, Dessine et devine** : même principe de salon avec code. Blast se joue à 2-4 (premier à 3 manches), Fenwick à 2-8, Dessine et devine à 2-10. Blast et Fenwick ont aussi un mode solo contre des robots.
- **Blast** : 4 arènes au choix (Classique, Patinoire qui fait glisser, Usine avec tapis roulants, Portails avec téléporteurs). Nouveaux bonus : coup de pied (pousse les bombes), télécommande (R ou bouton BOUM pour tout faire sauter), bouclier (encaisse une explosion). Mode 2 contre 2 : l'hôte coche « Équipes » dans le salon (il faut 4 joueurs : le 1er et le 4e arrivés contre le 2e et le 3e). En solo : « 2 contre 2 (toi + 1 robot) ».
- **Course de Fenwick** : 4 circuits, 3 tours, objets dans les caisses arc-en-ciel, F pour un coup de fourche sur celui de devant. Dérapage turbo : tiens Maj (ou X, ou le bouton DÉRAPE) dans un virage, plus tu tiens plus le turbo est gros (étincelles bleues, orange puis violettes). Grand Prix : les 4 circuits à la suite, points 15-12-10-8-6-4-2-1, en solo ou en salon.
- **La Rando Folle** (2 à 8, ou solo contre 7 robots) : course d'obstacles en 3D avec des petites grenouilles. Manche 1 la Rivière (rondins flottants, troncs qui roulent), manche 2 la Montagne (rochers, troncs qui balancent, pont qui s'effondre), finale les Nénuphars (ils coulent sous tes pieds, le dernier debout gagne). Environ deux tiers des joueurs se qualifient à chaque manche. Espace pour sauter, Maj pour plonger.
- **Loup-Garou** (4 à 10, ou solo contre 7 robots en choisissant ton rôle) : un village la nuit vu du dessus. Les villageois font leurs tâches (puits, bois, poules, lanternes…), les loups-garous dévorent en douce (F) et peuvent lancer un brouillard (G). Un corps signalé (R) ou la cloche sonnée lance une réunion avec chat et vote. 1 loup jusqu'à 6 joueurs, 2 à partir de 7.
- **Le Saloon** (onglet du Casino) : roulette et blackjack partagés, même tirage pour tout le monde, avec la liste des présents et un chat. Nouvelle table : **roulette russe** façon cartoon (pistolet à bouchon, le chapeau s'envole). 2 à 6 joueurs, 20 coins pour s'asseoir, le dernier assis rafle le pot. Elle utilise une nouvelle règle `saloon/rr` : pense à recoller les règles.
- Sur toutes les pages, la pastille verte « N en ligne » montre qui est connecté et où.

Les anciens scores de Ligne 1 sont repris automatiquement à la première connexion.
