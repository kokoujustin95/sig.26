# GROUPE SCIENTIFIQUE SIGMA — déploiement GitHub + Render (sans Google Apps Script)

## Contenu
- `index.html` : interface GROUPE SCIENTIFIQUE SIGMA et aides intégrées.
- L’aide utilisateur est intégrée à l’interface et accessible depuis la connexion et le tableau de bord.
- `server.js` : serveur Node.js et API de synchronisation.
- `render.yaml` : configuration du service Render et de PostgreSQL.
- `sigma_logo.png` et `screenshots/` : ressources visuelles.

## Déploiement
1. Téléverse tous les fichiers de cette archive à la racine d’un dépôt GitHub.
2. Dans Render, crée un Blueprint depuis ce dépôt et vérifie la création du service Web et de la base PostgreSQL.
3. Attends la fin du déploiement puis vérifie `https://TON-SITE.onrender.com/api/health`. Le résultat attendu est `ok: true` et `database: connected`. Le site doit être ouvert depuis le service Web Render, pas depuis GitHub Pages ni en ouvrant index.html localement : ces options ne fournissent pas l’API PostgreSQL.
4. Ouvre le site et teste le bouton « Aide » depuis l’écran de connexion puis depuis le tableau de bord.
5. Vérifie l’interface sur un ordinateur et un téléphone.

## Aide utilisateur
L’aide est intégrée directement à l’interface : les étapes d’utilisation restent accessibles depuis l’écran de connexion et le tableau de bord. Le lien vers le guide PDF distant a été retiré pour éviter une option injoignable. Les exports PDF générés par les fonctions de l’application sont conservés.

## Synchronisation et sécurité
Le serveur utilise PostgreSQL via `DATABASE_URL`. Avant d’utiliser le site avec des données réelles, l’authentification et les permissions doivent être sécurisées côté serveur. Ne publie pas de mots de passe réels dans un service dont l’API de base partagée est encore ouverte. Les données sauvegardées uniquement dans le stockage local d’un ancien navigateur ne sont pas importées automatiquement : exporte-les et importe-les via les fonctions prévues, si disponibles.


## Correction PDF introuvable

## Page 404 et mode maintenance
- `404.html` est la page de secours affichée lorsqu'une adresse du site n'existe pas (HTTP 404). Elle explique à l'utilisateur que la page est introuvable.
- Pour afficher cette page comme message de maintenance à tous les visiteurs, ouvre Render → service Web → Environment, ajoute `MAINTENANCE_MODE` avec la valeur `true`, puis redéploie/redémarre le service. Le site renverra alors HTTP 503 et conservera `/api/health` accessible pour le contrôle technique.
- Pour remettre le site en service, change `MAINTENANCE_MODE` en `false` ou supprime cette variable, puis redémarre le service.
- La page est autonome et ne dépend d'aucune image ni ressource externe.

## Mise à jour — choix des UE et accès Wi-Fi campus
- Le menu **Choix des UE (étudiants)** est placé dans la section Gestion et reste accessible aux comptes étudiants/utilisateurs. Ils peuvent cocher leurs UE, enregistrer leur sélection et exporter le récapitulatif PDF.
- Les paramètres officiels du catalogue et la limite officielle de crédits restent réservés à l’administration dans l’interface.
- Dans **Administration → Comptes utilisateurs → Modifier**, l’administrateur peut renseigner l’identifiant et le mot de passe Wi-Fi attribués par l’école/campus.
- Chaque utilisateur retrouve ces informations dans **Mon compte / Wi-Fi campus**. Il peut les afficher ou copier les identifiants, mais pas les modifier.

**Sécurité importante :** dans cette version, l’application synchronise encore une partie importante des données au moyen d’un état partagé côté navigateur. Les contrôles de rôle de l’interface ne constituent donc pas à eux seuls une protection serveur suffisante pour des secrets Wi-Fi réels. Avant d’y saisir les vrais mots de passe du campus, il faut renforcer l’API avec une authentification serveur et des autorisations par rôle/compte, afin qu’un utilisateur ne puisse jamais télécharger les identifiants des autres.


## Dépannage — « Base distante inaccessible »
- Ouvre directement `https://TON-SITE.onrender.com/api/health`. Si cette adresse affiche une page 404 ou HTML, vérifie que tu utilises le domaine du service Web Render et que `server.js` a été déployé. Si le site est ouvert depuis GitHub Pages ou depuis un fichier HTML local, son API Render ne sera pas accessible à l’adresse relative `/api/...`.
- Si la réponse est HTTP 503 avec `database: unavailable`, ouvre Render → service Web → Environment et vérifie que `DATABASE_URL` est bien liée à la base PostgreSQL associée. Vérifie aussi que la base n’est pas suspendue et que les journaux du service ne montrent pas une erreur de connexion.
- Si `/api/health` répond `ok: true` mais que le site affiche encore l’erreur, force l’actualisation du navigateur (Ctrl+F5) et vérifie que le dernier déploiement est terminé.
- Le service Node démarre même si `DATABASE_URL` manque : l’interface peut s’ouvrir et `/api/health` indique alors clairement que PostgreSQL n’est pas configurée. La page de connexion affiche une indication selon le type d’erreur HTTP/réseau.


Interface : les boutons « Aide et guide utilisateur » et « Télécharger le guide en PDF » ont été retirés de l’écran de connexion et de la navigation. L’aide/guide intégré est masqué.


## Correctifs — groupes de projet et maintenance
- Le nombre de personnes par groupe est désormais un champ numérique libre, avec un minimum de 2 et sans maximum arbitraire fixé à 30 ou 100.
- Pour les projets personnalisés, la génération tente d'éviter les binômes déjà réunis dans les deux projets personnalisés précédents de la même classe et du même semestre. Si l'effectif rend cette règle impossible, l'application signale les répétitions restantes.
- La page 404 est accessible depuis Paramètres / Sauvegarde via « Prévisualiser la page 404 ».
- Le mode maintenance global se pilote par la variable Render `MAINTENANCE_MODE=true`; repassez à `false` (ou supprimez-la) pour rétablir le site. Le réglage côté Render est global à tous les appareils et évite de simuler une maintenance uniquement dans le navigateur.
- Pour éviter l'affichage du code, utilisez l'URL du service Render, pas le fichier HTML ouvert directement ni GitHub Pages. Après remplacement des fichiers, attendez la fin du déploiement puis faites `Ctrl+F5`.


## Correctifs caméra smartphone et synchronisation (version corrigée)

### Scanner QR sur téléphone
- Le scanner demande maintenant en priorité la caméra arrière (`facingMode: environment`), même lorsque le navigateur ne révèle pas le nom des caméras.
- Si cette demande échoue, l’application essaie ensuite les caméras détectées.
- Autorise l’accès à la caméra dans les paramètres du navigateur et utilise l’adresse HTTPS du service Render. Le fichier ouvert en `file://` ne peut généralement pas utiliser la caméra.

### Synchronisation entre appareils
- Les enregistrements déclenchés pendant une synchronisation en cours sont désormais mis en attente puis envoyés au serveur, au lieu d’être ignorés.
- L’application relit la base distante lorsque l’onglet redevient actif et réessaie l’envoi lorsque la connexion revient.
- Les données partagées sont conservées dans PostgreSQL via l’API du serveur.

### Configuration indispensable
1. Déployer le dépôt comme **service Web Render** (pas comme site statique GitHub Pages).
2. Créer/associer une base PostgreSQL Render et configurer `DATABASE_URL` dans les variables d’environnement du service Web. Si le Blueprint `render.yaml` ne l’a pas créée automatiquement, crée la base séparément et lie son URL interne au service.
3. Après déploiement, ouvrir `https://TON-SITE.onrender.com/api/health`. Il faut obtenir `{"ok":true,"service":"GS SIGMA","database":"connected"}`.
4. Ouvrir l’application avec le domaine Render. GitHub Pages ne lance pas `server.js` et ne peut donc pas fournir l’API `/api/shared-db`.
5. Pour vérifier la synchronisation, enregistrer une modification sur un appareil, puis recharger l’application sur un deuxième appareil connecté au même service Render.

**Attention :** les données présentes uniquement dans le stockage local d’un ancien navigateur ne peuvent pas être récupérées automatiquement par PostgreSQL. Il faut les exporter/importer dans l’application avant de considérer la migration terminée. Le stockage partagé actuel ne remplace pas une authentification et des autorisations sécurisées côté serveur.

## Correctifs caméra, import et synchronisation (version 26/10/2026)
- Le scanner privilégie maintenant la caméra arrière (`environment`) sur les smartphones, avec une solution de repli si le navigateur n'accepte pas la sélection exacte.
- Dans « Présences enregistrées », le bouton « Importer les présences Excel » accepte `.xlsx`, `.xls`, `.xlsm`, `.xlsb` et `.csv`. Colonnes recommandées : `Nom` ou `Code QR`, `Date`, `Heure`, `Événement`.
- Lors de l'ajout d'un étudiant, sélectionne sa classe dans « Classe / service » avant d'enregistrer.
- Identifiants et mots de passe sont désormais comparés en respectant les majuscules/minuscules. Il faut donc saisir exactement la casse enregistrée.
- Pour partager les données entre appareils, le site doit être servi par le serveur Node/Express de Render et relié à PostgreSQL. Publier seulement `index.html` sur GitHub Pages ne permet pas la synchronisation : GitHub Pages est un hébergement statique et ne fournit pas l'API `/api/shared-db`.
- Dans Render, vérifie que le service utilise `npm install` / `npm start` et que la variable `DATABASE_URL` pointe vers la base PostgreSQL du même environnement. Après déploiement, ouvre `/api/health` sur le domaine Render : la réponse attendue est `ok: true` et `database: connected`. Si la base n'est pas connectée, la synchronisation partagée ne peut pas fonctionner.
- L'accès caméra nécessite HTTPS et l'autorisation de caméra dans le navigateur du smartphone. Si la caméra a été bloquée auparavant, ouvre les autorisations du site dans le navigateur et autorise la caméra, puis recharge la page.

## Module Gestion de laboratoire
La version actuelle ajoute au menu de gestion le module « Gestion de laboratoire » (administrateur). Il permet d'enregistrer les laboratoires, de tenir l'inventaire du matériel, de suivre les contrôles/états des équipements, de planifier des TP/réservations et de consigner les interventions de maintenance. Les données sont enregistrées dans la base de l'application (`laboratories`, `labEquipment`, `labActivities`), avec sauvegarde locale immédiate et synchronisation vers le serveur Render/PostgreSQL si celui-ci est configuré et accessible. Un export CSV permet de récupérer le répertoire et l'inventaire.


### Gestion de laboratoire — étiquettes QR et stock

Le module de laboratoire comprend les étiquettes imprimables avec pictogrammes et QR codes par produit, les fiches de stock, les dates d’approvisionnement et de péremption, le fournisseur, les lots, les seuils d’alerte, ainsi que l’historique des sorties et réapprovisionnements. Pour ouvrir les fiches en scannant les QR sur plusieurs appareils, déployer le site en HTTPS et conserver l’API de base de données partagée active. La génération QR nécessite une connexion Internet pour charger la bibliothèque QR.


### Étiquettes PDF, pictogrammes JPEG et accès utilisateur au laboratoire
- Dans l’inventaire, sélectionne un pictogramme prédéfini ou importe un fichier JPEG (.jpg/.jpeg) pour le produit. L’image est conservée avec sa fiche et apparaît sur l’étiquette PDF. Utilise de préférence une petite image carrée (300 × 300 px, moins de 1,2 Mo) afin de ne pas alourdir la base partagée.
- Le bouton « Étiquette PDF » télécharge une étiquette par produit ; « Télécharger toutes les étiquettes en PDF » crée une planche A4 de plusieurs étiquettes. Le QR code renvoie à la fiche du produit dans l’application. Les bibliothèques PDF/QR chargées depuis un CDN nécessitent une connexion Internet.
- Pour gérer les droits : ouvre « Comptes utilisateurs », clique sur « Modifier » ou utilise le bouton d’accès laboratoire. Coche/décoche « Autoriser l’accès à la gestion de laboratoire » puis enregistre. Les comptes administrateurs gardent toujours cet accès ; la suppression des données reste réservée à l’administrateur.


## Choix du module à la connexion et droits laboratoire

L’écran de connexion propose désormais deux choix : « Présences & planning » et « Gestion de laboratoire ». Après authentification, l’application ouvre le module choisi. Si un compte utilisateur n’a pas reçu l’autorisation laboratoire, la connexion vers ce module est refusée avec un message explicatif.

Pour autoriser ou retirer l’accès d’un compte : connecte-toi en administrateur, ouvre « Comptes utilisateurs », puis utilise la case « Autoriser l’accès à la gestion de laboratoire » lors de la modification du compte ou le bouton d’activation/désactivation dans la liste des comptes. Les administrateurs conservent toujours l’accès.

## Connexion avec OTP facultatif, sans e-mail

La connexion standard se fait avec l'identifiant et le mot de passe, sans confirmation par e-mail. Le champ OTP à 6 chiffres est visible mais facultatif : laisser ce champ vide permet de se connecter normalement. Si un compte possède déjà un secret TOTP configuré dans PostgreSQL, son titulaire peut aussi saisir le code de son application d'authentification pour ajouter cette vérification. Cette option n'impose pas l'OTP aux utilisateurs et ne lance pas de nouvelle configuration OTP automatiquement.

Aucune variable `SMTP_*` n'est nécessaire pour la connexion. Le site doit être déployé comme service Web Render avec PostgreSQL, puis ouvert depuis le domaine Render afin que les routes API fonctionnent. Vérifie `/api/health` et que `database` vaut `connected`. Le code OTP est contrôlé côté serveur uniquement lorsqu'un code est saisi. Comme l'OTP est facultatif, il ne constitue pas une obligation de double authentification pour tous les comptes.

### Notes et relevés

- Les enseignants et administrateurs autorisés saisissent, modifient et suppriment les notes.
- Les étudiants et utilisateurs simples consultent uniquement les résultats associés à leur fiche. L'administrateur doit faire correspondre le nom ou l'e-mail du compte avec une fiche étudiant.
- Import : première feuille Excel avec des colonnes équivalentes à Étudiant/Nom, Code UE, Intitulé, Semestre, Note, Crédits, Coefficient, Session, Date, Observation. Formats Excel courants et CSV/ODS pris en charge par SheetJS.
- Export XLSX/CSV, impression du relevé semestriel ou annuel via la boîte d'impression du navigateur (choisir « Enregistrer au format PDF » pour télécharger le PDF).
- La règle de validation affichée par défaut est 10/20. Les compensations, seuils et décisions de jury doivent suivre le règlement pédagogique officiel.

### Droits d’accès

La rubrique **Droits et fonctionnalités** est réservée à l’administrateur principal. Elle permet de configurer la visibilité des principales fonctionnalités par rôle. Le droit de modifier les notes est limité aux enseignants et administrateurs autorisés.

## Interface de connexion, aide et déconnexion automatique
- Le document HTML se termine maintenant par des balises `</body>` et `</html>` correctes afin d’éviter l’affichage de fragments de source en bas de page. Après remplacement sur Render, effectue un redéploiement et recharge avec `Ctrl+F5`.
- Le titre « Groupe Scientifique SIGMA » apparaît sous le logo de l’écran de connexion.
- L’administrateur principal peut modifier le titre, le texte de présentation, les lignes d’information et la durée d’inactivité dans **Paramètres → Général → Interface de connexion et sécurité**.
- Le bouton **Aide utilisateur** est accessible depuis la connexion, et le bouton **Aide** depuis l’application.
- La déconnexion automatique est réglée par défaut à 15 minutes sans interaction. L’administrateur principal peut choisir 5, 10, 15, 20, 30, 45 ou 60 minutes, ou désactiver cette fonction.
