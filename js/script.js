(function () {
  const HOURS_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const HOURS_LABELS = {
    lundi: 'Lundi',
    mardi: 'Mardi',
    mercredi: 'Mercredi',
    jeudi: 'Jeudi',
    vendredi: 'Vendredi',
    samedi: 'Samedi',
    dimanche: 'Dimanche'
  };

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  function currentPageName() {
    const fromPath = window.location.pathname.split('/').pop();
    if (!fromPath) {
      return 'index.html';
    }

    return fromPath;
  }

  const currentPage = currentPageName();
  const navLinks = document.querySelectorAll('.site-nav a');

  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    }
  });

  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.querySelector('.site-nav');

  if (navToggle && siteNav) {
    const navOverlay = document.createElement('button');
    navOverlay.type = 'button';
    navOverlay.className = 'nav-overlay';
    navOverlay.setAttribute('aria-label', 'Fermer le menu');
    document.body.appendChild(navOverlay);

    function setMenuState(isOpen) {
      siteNav.classList.toggle('is-open', isOpen);
      navOverlay.classList.toggle('is-open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
      document.body.classList.toggle('menu-open', isOpen);
    }

    navToggle.addEventListener('click', function () {
      setMenuState(!siteNav.classList.contains('is-open'));
    });

    siteNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', function () {
        setMenuState(false);
      });
    });

    navOverlay.addEventListener('click', function () {
      setMenuState(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        setMenuState(false);
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 761) {
        setMenuState(false);
      }
    });
  }

  const yearNode = document.getElementById('current-year');
  if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
  }

  const lightbox = document.getElementById('lightbox');
  const lightboxImage = lightbox ? lightbox.querySelector('img') : null;
  const lightboxClose = lightbox ? lightbox.querySelector('.lightbox-close') : null;
  const zoomables = document.querySelectorAll('.zoomable');

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-visible');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (lightbox && lightboxImage && zoomables.length > 0) {
    zoomables.forEach((image) => {
      image.addEventListener('click', function () {
        const src = image.getAttribute('src');
        const alt = image.getAttribute('alt') || 'Image agrandie';
        if (!src) return;

        lightboxImage.setAttribute('src', src);
        lightboxImage.setAttribute('alt', alt);
        lightbox.classList.add('is-visible');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      });
    });

    if (lightboxClose) {
      lightboxClose.addEventListener('click', closeLightbox);
    }

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeLightbox();
      }
    });
  }

  function fillHoursTable(hours) {
    const hoursBody = document.getElementById('public-hours-body');
    if (!hoursBody || !hours || typeof hours !== 'object') {
      return;
    }

    hoursBody.innerHTML = '';

    HOURS_ORDER.forEach((day) => {
      const tr = document.createElement('tr');
      const dayCell = document.createElement('td');
      const timeCell = document.createElement('td');

      dayCell.textContent = HOURS_LABELS[day] || day;
      timeCell.textContent = hours[day] || '-';

      tr.appendChild(dayCell);
      tr.appendChild(timeCell);
      hoursBody.appendChild(tr);
    });
  }

  function mapUrl(address) {
    const query = encodeURIComponent(address || 'Paris');
    return `https://www.google.com/maps?q=${query}&output=embed`;
  }

  async function loadPublicInfo() {
    const nameNode = document.getElementById('public-info-name');
    const addressNode = document.getElementById('public-info-address');
    const phoneNode = document.getElementById('public-info-phone');
    const phoneLink = document.getElementById('public-info-phone-link');
    const emailNode = document.getElementById('public-info-email');
    const emailLink = document.getElementById('public-info-email-link');
    const mapNode = document.getElementById('public-map');

    if (!nameNode && !addressNode && !phoneNode && !emailNode && !mapNode) {
      return;
    }

    try {
      const info = await fetchJson('/api/info');

      if (nameNode && info.name) {
        nameNode.textContent = info.name;
      }

      if (addressNode && info.address) {
        addressNode.textContent = info.address;
      }

      if (phoneNode && info.phone) {
        phoneNode.textContent = info.phone;
      }

      if (phoneLink && info.phone) {
        const normalizedPhone = info.phone.replace(/\s+/g, '');
        phoneLink.setAttribute('href', `tel:${normalizedPhone}`);
      }

      if (emailNode && info.email) {
        emailNode.textContent = info.email;
      }

      if (emailLink && info.email) {
        emailLink.setAttribute('href', `mailto:${info.email}`);
      }

      if (mapNode && info.address) {
        mapNode.setAttribute('src', mapUrl(info.address));
      }

      fillHoursTable(info.hours);
    } catch (err) {
      console.warn('Info API indisponible, affichage local conservé.');
    }
  }

  async function loadPublicMenuImage() {
    const menuImage = document.getElementById('public-menu-image');
    const fullscreenLink = document.getElementById('public-menu-fullscreen');
    if (!menuImage) {
      return;
    }

    try {
      const payload = await fetchJson('/api/menu');
      if (payload && payload.menuImage) {
        menuImage.setAttribute('src', payload.menuImage);
        if (fullscreenLink) {
          fullscreenLink.setAttribute('href', payload.menuImage);
        }
      }
    } catch (err) {
      console.warn('Menu API indisponible, image locale conservée.');
    }
  }

  loadPublicMenuImage();
  loadPublicInfo();
})();
