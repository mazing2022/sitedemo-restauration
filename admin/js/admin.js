(function () {
  const DAY_KEYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

  const loginForm = document.getElementById('admin-login-form');
  const dashboardRoot = document.getElementById('admin-dashboard');
  let lastStats = null;

  async function apiRequest(url, options) {
    const config = options || {};
    const headers = Object.assign({}, config.headers || {});

    if (config.body && !(config.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: config.method || 'GET',
      credentials: 'same-origin',
      headers,
      body: config.body || undefined
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      const message = data && data.message ? data.message : 'Erreur serveur.';
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function showFeedback(node, message, type) {
    if (!node) return;
    node.textContent = message;
    node.className = `feedback show ${type || 'success'}`;
  }

  function clearFeedback(node) {
    if (!node) return;
    node.textContent = '';
    node.className = 'feedback';
  }

  async function initLoginPage() {
    const feedbackNode = document.getElementById('login-feedback');

    loginForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearFeedback(feedbackNode);

      if (!loginForm.checkValidity()) {
        showFeedback(feedbackNode, 'Email et mot de passe requis.', 'error');
        return;
      }

      const formData = new FormData(loginForm);
      const payload = {
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || '')
      };

      try {
        await apiRequest('/api/admin/login', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        showFeedback(feedbackNode, 'Connexion reussie, redirection...', 'success');
        window.location.href = '/admin/dashboard';
      } catch (err) {
        showFeedback(feedbackNode, err.message, 'error');
      }
    });
  }

  function setupSidebarNavigation() {
    const navButtons = document.querySelectorAll('.admin-nav button[data-target]');
    navButtons.forEach((button) => {
      button.addEventListener('click', function () {
        const targetId = button.getAttribute('data-target');
        const target = targetId ? document.getElementById(targetId) : null;
        if (!target) return;

        navButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function hoursFromForm() {
    const hours = {};
    DAY_KEYS.forEach((day) => {
      const input = document.getElementById(`hours-${day}`);
      hours[day] = input ? input.value.trim() : '';
    });
    return hours;
  }

  function populateInfoForm(info) {
    const name = document.getElementById('info-name');
    const email = document.getElementById('info-email');
    const phone = document.getElementById('info-phone');
    const address = document.getElementById('info-address');

    if (name) name.value = info.name || '';
    if (email) email.value = info.email || '';
    if (phone) phone.value = info.phone || '';
    if (address) address.value = info.address || '';

    const hours = info.hours || {};
    DAY_KEYS.forEach((day) => {
      const input = document.getElementById(`hours-${day}`);
      if (input) {
        input.value = hours[day] || '';
      }
    });
  }

  async function loadPublicInfoInAdmin() {
    const info = await apiRequest('/api/info');
    populateInfoForm(info);
  }

  async function loadMenuPreview() {
    const data = await apiRequest('/api/menu');
    const preview = document.getElementById('menu-preview');
    if (preview && data && data.menuImage) {
      preview.src = data.menuImage;
    }
  }

  function drawVisitsChart(points) {
    const canvas = document.getElementById('visits-chart');
    if (!canvas) return;

    const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : canvas.clientWidth;
    const width = Math.max(parentWidth - 10, 220);
    const height = 260;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 22, right: 14, bottom: 42, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.fillStyle = '#101a2b';
    ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

    const maxValue = Math.max(1, ...points.map((point) => point.visits));
    const barCount = points.length;
    const slotWidth = chartWidth / Math.max(barCount, 1);
    const barWidth = Math.min(42, slotWidth * 0.65);

    ctx.strokeStyle = '#3b4e6c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    ctx.font = '12px Barlow';

    points.forEach((point, index) => {
      const ratio = maxValue === 0 ? 0 : point.visits / maxValue;
      const barHeight = Math.max(2, chartHeight * ratio);
      const x = padding.left + index * slotWidth + (slotWidth - barWidth) / 2;
      const y = padding.top + chartHeight - barHeight;

      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, '#4f6c8f');
      gradient.addColorStop(1, '#354e6d');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = '#c7d3e5';
      ctx.textAlign = 'center';
      ctx.fillText(String(point.visits), x + barWidth / 2, y - 6);
      ctx.fillStyle = '#95a5be';
      ctx.fillText(point.label, x + barWidth / 2, padding.top + chartHeight + 16);
    });
  }

  function populateStats(stats) {
    lastStats = stats;

    const totalNode = document.getElementById('stat-total-visits');
    const todayNode = document.getElementById('stat-today-visits');
    const pageViewsNode = document.getElementById('stat-page-views');

    if (totalNode) totalNode.textContent = String(stats.totalVisits || 0);
    if (todayNode) todayNode.textContent = String(stats.todayVisits || 0);
    if (pageViewsNode) pageViewsNode.textContent = String(stats.totalPageViews || 0);

    drawVisitsChart(Array.isArray(stats.visitsByDay) ? stats.visitsByDay : []);

    const tableBody = document.getElementById('page-views-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    const rows = Array.isArray(stats.pageViews) ? stats.pageViews : [];

    if (rows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 2;
      td.textContent = 'Aucune donnee de visite pour le moment.';
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const pageCell = document.createElement('td');
      const viewsCell = document.createElement('td');

      pageCell.textContent = row.path || '-';
      viewsCell.textContent = String(row.views || 0);

      tr.appendChild(pageCell);
      tr.appendChild(viewsCell);
      tableBody.appendChild(tr);
    });
  }

  async function loadStats(feedbackNode) {
    try {
      const stats = await apiRequest('/api/admin/stats');
      populateStats(stats);

      if (feedbackNode) {
        showFeedback(feedbackNode, 'Statistiques actualisees.', 'success');
      }
    } catch (err) {
      if (err.status === 401) {
        window.location.href = '/admin';
        return;
      }

      if (feedbackNode) {
        showFeedback(feedbackNode, err.message, 'error');
      }
    }
  }

  async function ensureSession() {
    try {
      const data = await apiRequest('/api/admin/session');
      const emailNode = document.getElementById('admin-user-email');
      if (emailNode) {
        emailNode.textContent = data.email || '-';
      }
    } catch (err) {
      window.location.href = '/admin';
      throw err;
    }
  }

  function bindMenuUpload() {
    const form = document.getElementById('menu-upload-form');
    const feedbackNode = document.getElementById('menu-upload-feedback');
    const preview = document.getElementById('menu-preview');

    if (!form) return;

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearFeedback(feedbackNode);

      const fileInput = document.getElementById('menu-image');
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showFeedback(feedbackNode, 'Selectionnez une image.', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('menuImage', fileInput.files[0]);

      try {
        const result = await apiRequest('/api/admin/menu/upload', {
          method: 'POST',
          body: formData
        });

        if (preview && result.menuImage) {
          preview.src = result.menuImage;
        }

        showFeedback(feedbackNode, result.message || 'Image mise a jour.', 'success');
        form.reset();
      } catch (err) {
        showFeedback(feedbackNode, err.message, 'error');
      }
    });
  }

  function bindInfoSave() {
    const form = document.getElementById('info-form');
    const feedbackNode = document.getElementById('info-feedback');

    if (!form) return;

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearFeedback(feedbackNode);

      if (!form.checkValidity()) {
        showFeedback(feedbackNode, 'Tous les champs sont requis.', 'error');
        return;
      }

      const payload = {
        name: String(document.getElementById('info-name').value || '').trim(),
        address: String(document.getElementById('info-address').value || '').trim(),
        phone: String(document.getElementById('info-phone').value || '').trim(),
        email: String(document.getElementById('info-email').value || '').trim(),
        hours: hoursFromForm()
      };

      const hasMissingHours = DAY_KEYS.some((day) => !payload.hours[day]);
      if (hasMissingHours) {
        showFeedback(feedbackNode, 'Renseignez tous les horaires.', 'error');
        return;
      }

      try {
        const result = await apiRequest('/api/admin/info', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        showFeedback(feedbackNode, result.message || 'Informations sauvegardees.', 'success');
      } catch (err) {
        showFeedback(feedbackNode, err.message, 'error');
      }
    });
  }

  function bindLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async function () {
      try {
        await apiRequest('/api/admin/logout', { method: 'POST' });
      } catch (err) {
        console.error(err);
      } finally {
        window.location.href = '/admin';
      }
    });
  }

  function bindStatsRefresh() {
    const button = document.getElementById('stats-refresh-btn');
    const feedbackNode = document.getElementById('stats-feedback');

    if (!button) return;

    button.addEventListener('click', function () {
      clearFeedback(feedbackNode);
      loadStats(feedbackNode);
    });
  }

  async function initDashboardPage() {
    try {
      await ensureSession();
      setupSidebarNavigation();
      bindLogout();
      bindMenuUpload();
      bindInfoSave();
      bindStatsRefresh();

      await Promise.all([loadMenuPreview(), loadPublicInfoInAdmin(), loadStats()]);
    } catch (err) {
      console.error(err);
    }
  }

  if (loginForm) {
    initLoginPage();
  }

  if (dashboardRoot) {
    initDashboardPage();

    window.addEventListener('resize', function () {
      if (lastStats && Array.isArray(lastStats.visitsByDay)) {
        drawVisitsChart(lastStats.visitsByDay);
      }
    });
  }
})();
