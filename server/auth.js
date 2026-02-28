function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
    return;
  }

  res.status(401).json({ message: 'Authentification requise.' });
}

function requireAuthPage(req, res, next) {
  if (req.session && req.session.userId) {
    next();
    return;
  }

  res.redirect('/admin');
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    res.redirect('/admin/dashboard');
    return;
  }

  next();
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

module.exports = {
  requireAuth,
  requireAuthPage,
  redirectIfAuthenticated,
  regenerateSession,
  destroySession
};
