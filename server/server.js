const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');

const {
  createConnection,
  initializeDatabase,
  get,
  run,
  close,
  getInfoRecord
} = require('./db');
const { requireAuthPage, redirectIfAuthenticated } = require('./auth');
const { createStatsMiddleware } = require('./stats');
const { createAdminRouter } = require('./routes-admin');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_UPLOADS_DIR = path.join(ROOT_DIR, 'public', 'uploads');

function rootFile(relativePath) {
  return path.join(ROOT_DIR, relativePath);
}

async function getMenuPayload(db) {
  const menuFilePath = path.join(PUBLIC_UPLOADS_DIR, 'menu.jpg');
  if (!fs.existsSync(menuFilePath)) {
    return { menuImage: '/assets/images/menu.jpg' };
  }

  const menuStamp = await get(db, 'SELECT value FROM settings WHERE key = ?', ['menu_updated_at']);
  const version = menuStamp && menuStamp.value ? menuStamp.value : String(fs.statSync(menuFilePath).mtimeMs);

  return {
    menuImage: `/uploads/menu.jpg?v=${encodeURIComponent(version)}`
  };
}

async function startServer() {
  const db = createConnection();
  await initializeDatabase(db);

  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      name: 'restaurant_admin_sid',
      secret: process.env.SESSION_SECRET || 'change-this-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000
      }
    })
  );

  // Public static assets only (keeps /server files private).
  app.use('/uploads', express.static(PUBLIC_UPLOADS_DIR));
  app.use('/assets', express.static(rootFile('assets')));
  app.use('/css', express.static(rootFile('css')));
  app.use('/js', express.static(rootFile('js')));
  app.use('/admin/css', express.static(rootFile('admin/css')));
  app.use('/admin/js', express.static(rootFile('admin/js')));

  // Tracks public page visits and page views.
  app.use(createStatsMiddleware(db, run));

  app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(rootFile('index.html'));
  });

  app.get('/menu.html', (req, res) => {
    res.sendFile(rootFile('menu.html'));
  });

  app.get('/galerie.html', (req, res) => {
    res.sendFile(rootFile('galerie.html'));
  });

  app.get('/infos.html', (req, res) => {
    res.sendFile(rootFile('infos.html'));
  });

  app.get('/reservation.html', (req, res) => {
    res.sendFile(rootFile('reservation.html'));
  });

  app.get(['/admin', '/admin/', '/admin/index.html'], redirectIfAuthenticated, (req, res) => {
    res.sendFile(rootFile('admin/index.html'));
  });

  app.get(['/admin/dashboard', '/admin/dashboard.html'], requireAuthPage, (req, res) => {
    res.sendFile(rootFile('admin/dashboard.html'));
  });

  app.get('/api/menu', async (req, res) => {
    try {
      const payload = await getMenuPayload(db);
      res.json(payload);
    } catch (err) {
      console.error('Erreur /api/menu:', err);
      res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
  });

  app.get('/api/info', async (req, res) => {
    try {
      const info = await getInfoRecord(db);
      res.json(info);
    } catch (err) {
      console.error('Erreur /api/info:', err);
      res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
  });

  app.use('/api/admin', createAdminRouter(db));

  app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Route API introuvable.' });
  });

  app.use((req, res) => {
    res.status(404).send('Page introuvable.');
  });

  const server = app.listen(port, () => {
    console.log(`Serveur demarre sur http://localhost:${port}`);
  });

  async function shutdown() {
    server.close(async () => {
      try {
        await close(db);
      } catch (err) {
        console.error('Erreur fermeture DB:', err);
      } finally {
        process.exit(0);
      }
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Echec demarrage serveur:', err);
  process.exit(1);
});
