# TONRESTAURANT - Site vitrine + Panel Admin

Panel admin complet pour piloter un site vitrine de restaurant.

## Stack
- Front public: HTML / CSS / JS vanilla
- Admin: HTML / CSS / JS vanilla
- Back: Node.js + Express
- DB: SQLite
- Upload image: multer
- Auth: express-session + bcrypt

## Structure
- `admin/` : interface admin (login + dashboard)
- `server/` : backend Express, auth, routes, stats, DB
- `public/uploads/` : image de carte uploadée (`menu.jpg`)
- `assets/`, `css/`, `js/`, `*.html` : site vitrine public

## Installation
```bash
npm install
```

## Lancement
```bash
npm start
```

Le serveur démarre par défaut sur :
- `http://localhost:3000`

## Accès
- Site public : `http://localhost:3000/`
- Admin login : `http://localhost:3000/admin`
- Dashboard admin (protégé) : `http://localhost:3000/admin/dashboard`

## Identifiants admin par défaut
- Email : `admin@tonrestaurant.fr`
- Mot de passe : `Admin@12345`

Change ces identifiants via variables d'environnement au premier démarrage.

## Variables d'environnement (optionnel)
- `PORT` (ex: `3000`)
- `SESSION_SECRET` (fortement recommandé)
- `ADMIN_EMAIL` (création du compte admin initial)
- `ADMIN_PASSWORD` (création du compte admin initial)

Exemple:
```bash
set PORT=3000
set SESSION_SECRET=change-me
set ADMIN_EMAIL=admin@exemple.fr
set ADMIN_PASSWORD=MotDePasseFort123!
npm start
```

## APIs
### Publiques
- `GET /api/menu`
- `GET /api/info`

### Admin (session requise)
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`
- `POST /api/admin/menu/upload`
- `POST /api/admin/info`
- `GET /api/admin/stats`

## Fonctionnalités principales
- Auth admin sécurisée (bcrypt + session HTTP-only)
- Upload et remplacement de l'image de carte (`/public/uploads/menu.jpg`)
- Gestion des infos établissement (nom, adresse, téléphone, email, horaires)
- Tracking stats côté serveur (visites totales, visites du jour, vues par page, 7 derniers jours)
- Dashboard admin moderne sans rechargements inutiles (Fetch API)

## Notes
- Le routeur `/admin` n'est pas exposé dans la navigation publique.
- Le site public consomme `/api/menu` et `/api/info` pour afficher les données à jour.
