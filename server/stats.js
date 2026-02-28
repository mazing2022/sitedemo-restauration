const TRACKED_PAGES = new Set([
  '/index.html',
  '/menu.html',
  '/galerie.html',
  '/infos.html',
  '/reservation.html'
]);

function localDateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function normalizeTrackedPath(pathname) {
  if (pathname === '/') {
    return '/index.html';
  }

  return pathname.toLowerCase();
}

async function recordVisit(db, run, pathname) {
  const day = localDateKey();

  // One row per day for fast "today" and "last 7 days" queries.
  await run(
    db,
    `INSERT INTO stats_visits(day, visits)
     VALUES(?, 1)
     ON CONFLICT(day) DO UPDATE SET visits = visits + 1`,
    [day]
  );

  await run(
    db,
    `INSERT INTO stats_pages(path, views)
     VALUES(?, 1)
     ON CONFLICT(path) DO UPDATE SET views = views + 1`,
    [pathname]
  );
}

function createStatsMiddleware(db, run) {
  return async function statsMiddleware(req, res, next) {
    try {
      if (req.method !== 'GET') {
        next();
        return;
      }

      const normalizedPath = normalizeTrackedPath(req.path);
      if (!TRACKED_PAGES.has(normalizedPath)) {
        next();
        return;
      }

      // Count only real vitrine pages (not APIs or assets).
      await recordVisit(db, run, normalizedPath);
      next();
    } catch (err) {
      console.error('Erreur tracking stats:', err);
      next();
    }
  };
}

function buildLast7Days() {
  const days = [];
  const today = new Date();

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localDateKey(d);
    const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });
    days.push({ key, label, visits: 0 });
  }

  return days;
}

async function getAdminStats(db, get, all) {
  const totals = await get(db, 'SELECT COALESCE(SUM(visits), 0) AS total FROM stats_visits');
  const today = await get(db, 'SELECT COALESCE(visits, 0) AS visits FROM stats_visits WHERE day = ?', [localDateKey()]);
  const pageRows = await all(db, 'SELECT path, views FROM stats_pages ORDER BY views DESC');

  const lastDays = buildLast7Days();
  const lastDaysMap = new Map(lastDays.map((item) => [item.key, item]));

  const dbRows = await all(db, 'SELECT day, visits FROM stats_visits WHERE day >= ? ORDER BY day ASC', [lastDays[0].key]);
  dbRows.forEach((row) => {
    const target = lastDaysMap.get(row.day);
    if (target) {
      target.visits = row.visits;
    }
  });

  const totalPageViews = pageRows.reduce((sum, row) => sum + row.views, 0);

  return {
    totalVisits: totals ? totals.total : 0,
    todayVisits: today ? today.visits : 0,
    totalPageViews,
    visitsByDay: lastDays,
    pageViews: pageRows
  };
}

module.exports = {
  TRACKED_PAGES,
  localDateKey,
  createStatsMiddleware,
  getAdminStats
};
