# Ligne 1 — mise en ligne

Le dossier contient tout le jeu. Deux étapes : créer la base Firebase (classement, pseudos), puis héberger le jeu sur GitHub Pages (gratuit).

## 1. Firebase (environ 10 min)

1. Va sur https://console.firebase.google.com avec ton compte Google, clique **Créer un projet**, nomme-le `ligne1`, désactive Google Analytics, puis **Créer**.
2. Sur la page du projet, clique l'icône **Web** `</>`. Nomme l'appli `ligne1-web`, ne coche pas Hosting, puis **Enregistrer l'application**.
3. Firebase affiche un bloc `const firebaseConfig = { apiKey: ..., ... }`. Ouvre `firebase-config.js` et remplace les valeurs par les tiennes (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
4. Menu de gauche **Créer > Authentication > Commencer**. Dans l'onglet **Mode de connexion**, active **Anonyme**, puis **Google** (choisis ton e-mail d'assistance) et enregistre.
5. Menu **Créer > Firestore Database > Créer une base de données**. Emplacement : `eur3 (europe-west)`. Mode : **production**. Puis **Créer**.
6. Onglet **Règles** de Firestore : efface tout, colle le contenu du fichier `firestore.rules`, puis **Publier**.

## 2. GitHub Pages

7. Sur https://github.com (crée un compte si besoin), clique **New repository**. Nom : `ligne1`, visibilité **Public**, puis **Create repository**.
8. Clique **uploading an existing file**. Glisse TOUT le contenu du dossier (index.html, firebase-config.js, firestore.rules, le dossier js…), puis **Commit changes**.
9. Dans le dépôt : **Settings > Pages**. Source : **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**. Après 1 à 2 minutes, le jeu est en ligne sur `https://TON-NOM-GITHUB.github.io/ligne1/`.
10. Retour dans Firebase : **Authentication > Paramètres > Domaines autorisés > Ajouter un domaine** et mets `TON-NOM-GITHUB.github.io` (sinon la connexion Google est refusée).

## Inviter les collègues

Crée ton pseudo (bouton jaune sur la carte), va dans ton **Profil** et copie ton lien d'invitation. Tes collègues l'ouvrent, créent leur pseudo, et vous êtes reliés.

## Bon à savoir

- La clé `apiKey` de Firebase n'est pas un secret : c'est normal qu'elle soit dans le fichier. La sécurité, ce sont les règles Firestore.
- Les points sont calculés dans le navigateur : un petit malin avec les outils développeur pourrait tricher. Entre collègues, ça suffit.
- Pour une mise à jour du jeu, il suffit de re-déposer les fichiers modifiés sur GitHub.
