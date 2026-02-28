const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');

const {
  UPLOADS_DIR,
  run,
  get,
  all,
  getInfoRecord
} = require('./db');
const {
  requireAuth,
  regenerateSession,
  destroySession
} = require('./auth');
const { getAdminStats } = require('./stats');

const MAX_UPLOAD_SIZE = 6 * 1024 * 1024;

function safeString(value) {
  return String(value || '').trim();
}

function parseHoursPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const expectedDays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const parsed = {};

  for (const day of expectedDays) {
    const val = safeString(payload[day]);
    if (!val) {
      return null;
    }
    parsed[day] = val;
  }

  return parsed;
}

function createUploadMiddleware() {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      cb(null, UPLOADS_DIR);
    },
    filename(req, file, cb) {
      cb(null, 'menu.jpg');
    }
  });

  return multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_SIZE },
    fileFilter(req, file, cb) {
      if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        cb(new Error('Le fichier doit etre une image.'));
        return;
      }
      cb(null, true);
    }
  });
}

function createAdminRouter(db) {
  const router = express.Router();
  const upload = createUploadMiddleware();

  router.post('/login', async (req, res) => {
    try {
      const email = safeString(req.body.email).toLowerCase();
      const password = safeString(req.body.password);

      if (!email || !password) {
        res.status(400).json({ message: 'Email et mot de passe requis.' });
        return;
      }

      const admin = await get(db, 'SELECT id, email, password_hash FROM admins WHERE email = ?', [email]);
      if (!admin) {
        res.status(401).json({ message: 'Identifiants invalides.' });
        return;
      }

      const validPassword = await bcrypt.compare(password, admin.password_hash);
      if (!validPassword) {
        res.status(401).json({ message: 'Identifiants invalides.' });
        return;
      }

      await regenerateSession(req);
      req.session.userId = admin.id;
      req.session.userEmail = admin.email;

      res.json({ message: 'Connexion reussie.', email: admin.email });
    } catch (err) {
      console.error('Erreur login admin:', err);
      res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
  });

  router.post('/logout', async (req, res) => {
    try {
      if (!req.session) {
        res.json({ message: 'Deconnecte.' });
        return;
      }

      await destroySession(req);
      res.clearCookie('restaurant_admin_sid');
      res.json({ message: 'Deconnecte.' });
    } catch (err) {
      console.error('Erreur logout admin:', err);
      res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
  });

  router.get('/session', requireAuth, (req, res) => {
    res.json({
      authenticated: true,
      email: req.session.userEmail || ''
    });
  });

  router.post('/menu/upload', requireAuth, (req, res) => {
    upload.single('menuImage')(req, res, async (err) => {
      if (err) {
        res.status(400).json({ message: err.message || 'Upload impossible.' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: 'Aucun fichier fourni.' });
        return;
      }

      try {
        const now = new Date().toISOString();
        await run(
          db,
          `INSERT INTO settings(key, value)
           VALUES('menu_updated_at', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [now]
        );

        const imageUrl = `/uploads/menu.jpg?v=${Date.now()}`;
        res.json({
          message: 'Image de la carte mise a jour.',
          menuImage: imageUrl
        });
      } catch (saveErr) {
        console.error('Erreur sauvegarde menu:', saveErr);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
      }
    });
  });

  router.post('/info', requireAuth, async (req, res) => {
    try {
      const name = safeString(req.body.name);
      const address = safeString(req.body.address);
      const phone = safeString(req.body.phone);
      const email = safeString(req.body.email);
      const hours = parseHoursPayload(req.body.hours);

      if (!name || !address || !phone || !email || !hours) {
        res.status(400).json({ message: 'Tous les champs infos sont requis.' });
        return;
      }

      await run(
        db,
        `UPDATE info
         SET name = ?, address = ?, phone = ?, email = ?, hours_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`,
        [name, address, phone, email, JSON.stringify(hours)]
      );

      const updated = await getInfoRecord(db);
      res.json({ message: 'Informations mises a jour.', info: updated });
    } catch (err) {
      console.error('Erreur sauvegarde infos:', err);
      res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
  });

  router.get('/stats', requireAuth, async (req, res) => {
    try {
      const stats = await getAdminStats(db, get, all);
      res.json(stats);
    } catch (err) {
      console.error('Erreur lecture stats:', err);
      res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
  });

  return router;
}

module.exports = {
  createAdminRouter
};
