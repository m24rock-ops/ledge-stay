const ROUTE_PATHS = {
  home: '/',
  browse: '/browse',
  listings: '/browse',
  detail: '/browse',
  wishlist: '/wishlist',
  login: '/login',
  post: '/post',
  dashboard: '/dashboard',
  admin: '/admin',
  'reset-password': '/reset-password'
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled error:', event.reason);
});

let selectedReviewRating = 0;
let editingListingId = null;
let savedListingIds = new Set();
const WISHLIST_STORAGE_KEY = 'wishlist';
const WISHLIST_LEGACY_STORAGE_KEY = 'wishlist_listing_ids';
let appConfig = {
  mapsEmbedApiKey: ''
};
let nearbySearchState = {
  active: false,
  lat: null,
  lng: null,
  radiusKm: 10
};
let selectedRole = 'tenant';
let authState = {
  loginMode: 'phone',
  otpSent: false,
  otpPhone: '',
  loginRole: 'tenant'
};
const HOME_REVIEWS = document.getElementById('home-reviews');
const HOME_REVIEW_ITEMS = Array.isArray(window.HOME_REVIEW_ITEMS) ? window.HOME_REVIEW_ITEMS : [];
const HOME_LOCATIONS = [
  {
    area: 'Koramangala 📍',
    city: 'Bengaluru',
    count: '20+ stays',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900&q=80'
  },
  {
    area: 'Rajaji Nagar 📍',
    city: 'Bengaluru',
    count: '10+ stays',
    image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&q=80'
  },
  {
    area: 'Vijaynagara 📍',
    city: 'Bengaluru',
    count: '20+ stays',
    image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=900&q=80'
  },
  {
    area: 'Hebbal📍',
    city: 'Bengaluru',
    count: '15+ stays',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900&q=80'
  }
];


function normalizePageName(page) {
  const aliases = {
    browse: 'listings'
  };

  return aliases[page] || page;
}

function resolvePathForPage(page) {
  return ROUTE_PATHS[normalizePageName(page)] || '/';
}

function navigateToPath(page, replace = false) {
  const path = resolvePathForPage(page);
  const method = replace ? 'replaceState' : 'pushState';

  if (window.location.pathname !== path) {
    window.history[method]({ page }, '', path);
  } else if (replace) {
    window.history.replaceState({ page }, '', path);
  }
}

function showPage(page, options = {}) {
  const { updateHistory = true, replaceHistory = false, skipReset = false } = options;
  const normalizedPage = normalizePageName(page);
  closeMenu();

  if (!ensurePageAccess(normalizedPage)) {
    return;
  }

  if (normalizedPage === 'post' && !skipReset && !editingListingId) {
    resetListingForm();
  }

  document.querySelectorAll('.page').forEach((section) => {
    section.style.display = 'none';
  });

  const activePage = document.getElementById(`page-${normalizedPage}`);
  if (activePage) activePage.style.display = 'block';

  const siteNav = document.querySelector('.site-nav');
  if (siteNav) {
    siteNav.style.display = '';
  }

  // Reset auth UI whenever switching between auth pages.
  if (normalizedPage === 'login') {
    resetAuthFlow({ preserveMode: true });
    bindLoginUiEvents();
    bindRegisterEvents();
  }

  if (updateHistory) {
    navigateToPath(normalizedPage, replaceHistory);
  }

  if (normalizedPage === 'listings') { currentListingsPage = 1; loadListings(); }
  if (normalizedPage === 'home') loadFeaturedListings();
  if (normalizedPage === 'dashboard') loadOwnerDashboard();
  if (normalizedPage === 'admin') loadAdminPanel();
  if (normalizedPage === 'wishlist') loadWishlistPage();
}

function ensurePageAccess(page) {
  const user = getUser();

  if (page === 'dashboard' || page === 'post') {
    if (!user) {
      showPage('login', { updateHistory: true, replaceHistory: true });
      document.getElementById('login-error').textContent = 'Please login as an owner to continue.';
      return false;
    }

    if (user.role !== 'owner') {
      alert('Only property owners can access this section.');
      showPage('home', { updateHistory: true, replaceHistory: true });
      return false;
    }
  }

  if (page === 'wishlist') {
    if (!user) {
      showPage('login', { updateHistory: true, replaceHistory: true });
      document.getElementById('login-error').textContent = 'Please login as a tenant to continue.';
      return false;
    }

    if (user.role !== 'tenant') {
      alert('Only tenants can access saved listings.');
      showPage('home', { updateHistory: true, replaceHistory: true });
      return false;
    }
  }

  if (page === 'admin') {
    if (!user) {
      showPage('login', { updateHistory: true, replaceHistory: true });
      document.getElementById('login-error').textContent = 'Please login as an admin to continue.';
      return false;
    }

    if (user.role !== 'admin') {
      alert('Only admins can access this section.');
      showPage('home', { updateHistory: true, replaceHistory: true });
      return false;
    }
  }

  return true;
}

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  return JSON.parse(localStorage.getItem('user') || 'null');
}

function updateNav() {
  const user = getUser();
  const navAuth = document.getElementById('nav-auth');
  const navUser = document.getElementById('nav-user');
  const wishlistLink = document.getElementById('nav-wishlist-link');
  const dashboardLink = document.getElementById('nav-dashboard-link');
  const postLink = document.getElementById('nav-post-link');
  const adminLink = document.getElementById('nav-admin-link');

  navAuth.style.display = user ? 'none' : 'inline-flex';
  navUser.style.display = user ? 'inline-flex' : 'none';
  if (!user) closeProfileMenu();

  if (wishlistLink) wishlistLink.style.display = user ? 'inline-flex' : 'none';
  if (dashboardLink) dashboardLink.style.display = user && user.role === 'owner' ? 'inline-flex' : 'none';
  if (postLink) postLink.style.display = user && user.role === 'owner' ? 'inline-flex' : 'none';
  if (adminLink) adminLink.style.display = user && user.role === 'admin' ? 'inline-flex' : 'none';
}

function attachNavbarListeners() {
  document.querySelectorAll('[data-page-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const page = event.currentTarget.getAttribute('data-page-link');
      showPage(page);
    });
  });

  document.querySelectorAll('[data-action-link="logout"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  });
}

function toggleProfileMenu() {
  const dropdown = document.getElementById('nav-profile-dropdown');
  const btn = document.getElementById('nav-profile-btn');
  if (!dropdown) return;
  const isOpen = dropdown.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', String(isOpen));
}

function closeProfileMenu() {
  const dropdown = document.getElementById('nav-profile-dropdown');
  const btn = document.getElementById('nav-profile-btn');
  if (!dropdown) return;
  dropdown.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// no-op kept for compatibility (hamburger removed)
function toggleMenu() {}

function closeMenu() {
  closeProfileMenu();
}

function heroSearch() {
  const city = document.getElementById('hero-search').value.trim();
  if (!city) {
    return;
  }

  syncLocationInputs(city);
  document.getElementById('filter-max').value = '';
  nearbySearchState.active = false;
  updateNearbyResultsBanner();
  showPage('listings');
}

function setNearMeStatus(message, isError = false) {
  const statusEl = document.getElementById('near-me-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('is-error', isError);
}

function useNearMe() {
  if (!navigator.geolocation) {
    setNearMeStatus('Please allow location access to use Near Me.', true);
    return;
  }

  setNearMeStatus('Finding stays near your current location...');

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const searchInput = document.getElementById('hero-search');
      if (searchInput && !searchInput.value.trim()) {
        searchInput.value = 'Nearby';
      }

      nearbySearchState = {
        active: true,
        lat: Number(coords.latitude),
        lng: Number(coords.longitude),
        radiusKm: 10
      };
      setNearMeStatus('Location found. Opening nearby listings now.');
      showPage('listings');
    },
    () => {
      setNearMeStatus('Location was not available. Please search by college, area, or city.', true);
    },
    { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
  );
}

function renderStars(rating) {
  const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function syncLocationInputs(location) {
  const safeLocation = typeof location === 'string' ? location : '';
  const filterInput = document.getElementById('filter-city');
  const heroInput = document.getElementById('hero-search');

  if (filterInput) filterInput.value = safeLocation;
  if (heroInput) heroInput.value = safeLocation;
}

function buildSearchRedirectUrl(location) {
  return `/search?location=${encodeURIComponent(location)}`;
}

function formatLocationSuggestion(suggestion) {
  if (typeof suggestion === 'string') return suggestion;
  if (!suggestion || typeof suggestion !== 'object') return '';

  const parts = [suggestion.name, suggestion.city, suggestion.state]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return parts.join(', ');
}

function highlightLocationMatch(text, query) {
  const source = String(text ?? '');
  const safeQuery = String(query ?? '').trim();
  if (!safeQuery) return escapeHtml(source);

  const matcher = new RegExp(`(${escapeRegex(safeQuery)})`, 'ig');
  return source
    .split(matcher)
    .filter(Boolean)
    .map((segment) => (
      segment.toLowerCase() === safeQuery.toLowerCase()
        ? `<span class="location-suggestion-match">${escapeHtml(segment)}</span>`
        : escapeHtml(segment)
    ))
    .join('');
}

function renderLocationSuggestions(dropdown, suggestions, query) {
  if (!dropdown) return;

  if (!suggestions.length) {
    dropdown.innerHTML = '<div class="location-autocomplete-empty">No locations found.</div>';
    dropdown.classList.add('is-open');
    return;
  }

  dropdown.innerHTML = suggestions.map((suggestion) => {
    const formattedSuggestion = formatLocationSuggestion(suggestion);
    return `
    <button type="button" class="location-suggestion" data-location-value="${escapeHtml(formattedSuggestion)}">
      ${highlightLocationMatch(formattedSuggestion, query)}
    </button>
  `;
  }).join('');
  dropdown.classList.add('is-open');
}

function setupLocationAutocomplete(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  let activeRequest = 0;

  const hideDropdown = () => {
    dropdown.classList.remove('is-open');
    dropdown.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
  };

  const fetchSuggestions = debounce(async () => {
    const query = input.value.trim();
    if (!query) {
      hideDropdown();
      return;
    }

    const requestId = ++activeRequest;

    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search request failed.');

      const suggestions = await response.json();
      if (requestId !== activeRequest) return;

      renderLocationSuggestions(dropdown, Array.isArray(suggestions) ? suggestions : [], query);
      input.setAttribute('aria-expanded', 'true');
    } catch (err) {
      if (requestId !== activeRequest) return;
      dropdown.innerHTML = '<div class="location-autocomplete-empty">Unable to load suggestions.</div>';
      dropdown.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
    }
  }, 300);

  input.addEventListener('input', fetchSuggestions);
  input.addEventListener('focus', () => {
    if (input.value.trim()) fetchSuggestions();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideDropdown();
  });

  dropdown.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  dropdown.addEventListener('click', (event) => {
    const button = event.target.closest('[data-location-value]');
    if (!button) return;

    const location = button.getAttribute('data-location-value') || '';
    syncLocationInputs(location);
    hideDropdown();
    window.location.assign(buildSearchRedirectUrl(location));
  });

  document.addEventListener('click', (event) => {
    if (event.target === input || dropdown.contains(event.target)) return;
    hideDropdown();
  });
}

// ── PHOTO CAROUSEL ──────────────────────────────────────────────────────────

function renderPhotoCarousel(photos) {
  if (!photos || photos.length === 0) {
    return '<div class="no-image detail-no-image">No photo available</div>';
  }

  const slides = photos.map((src, i) => `
    <div class="carousel-slide ${i === 0 ? 'is-active' : ''}" data-index="${i}">
      <img src="${src}" alt="Listing photo ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" onclick="openCarouselModal(this, ${i})">
    </div>`).join('');

  const dots = photos.length > 1
    ? `<div class="carousel-dots">
        ${photos.map((_, i) => `<button class="carousel-dot ${i === 0 ? 'is-active' : ''}" aria-label="Photo ${i + 1}" onclick="carouselGoTo(this,${i})"></button>`).join('')}
       </div>`
    : '';

  const arrows = photos.length > 1
    ? `<button class="carousel-arrow carousel-arrow--prev" aria-label="Previous photo" onclick="carouselStep(this,-1)">&#8592;</button>
       <button class="carousel-arrow carousel-arrow--next" aria-label="Next photo"     onclick="carouselStep(this, 1)">&#8594;</button>`
    : '';

  const thumbs = photos.length > 1
    ? `<div class="carousel-thumbs">
        ${photos.map((src, i) => `<img src="${src}" class="carousel-thumb ${i === 0 ? 'is-active' : ''}" alt="Thumb ${i + 1}" loading="lazy" decoding="async" onclick="carouselGoTo(this,${i})">`).join('')}
       </div>`
    : '';

  const modalDots = photos.length > 1
    ? `<div class="carousel-modal-dots">
        ${photos.map((_, i) => `<button class="carousel-modal-dot ${i === 0 ? 'is-active' : ''}" aria-label="Open photo ${i + 1}" onclick="carouselModalGoTo(this,${i})"></button>`).join('')}
      </div>`
    : '';

  return `
    <div class="carousel" data-current="0" tabindex="0"
         onkeydown="carouselKey(event, this)">
      <div class="carousel-track">${slides}</div>
      ${arrows}
      ${dots}
      <button type="button" class="carousel-open-viewer" aria-label="Open fullscreen gallery" onclick="openCarouselModal(this, carouselCurrentIndex(carouselRoot(this)))">View Fullscreen</button>
    </div>
    ${thumbs}
    <div class="carousel-modal" aria-hidden="true" onclick="closeCarouselModal(event)">
      <button class="carousel-modal-close" type="button" aria-label="Close fullscreen gallery" onclick="closeCarouselModal(event)">×</button>
      <div class="carousel-modal-stage">
        ${photos.length > 1 ? `<button class="carousel-arrow carousel-arrow--prev carousel-modal-arrow" type="button" aria-label="Previous photo" onclick="carouselStep(this,-1)">&#8592;</button>` : ''}
        <img class="carousel-modal-image" src="${photos[0]}" alt="Fullscreen listing photo" decoding="async">
        ${photos.length > 1 ? `<button class="carousel-arrow carousel-arrow--next carousel-modal-arrow" type="button" aria-label="Next photo" onclick="carouselStep(this,1)">&#8594;</button>` : ''}
      </div>
      <div class="carousel-modal-footer">
        <div class="carousel-modal-counter">1 / ${photos.length}</div>
        ${modalDots}
      </div>
    </div>`;
}

function carouselRoot(el) {
  return el.closest('.detail-photos');
}

function getCarouselElements(root) {
  if (!root) return null;

  const carousel = root.querySelector('.carousel');
  if (!carousel) return null;

  const slides   = carousel.querySelectorAll('.carousel-slide');
  const dots     = root.querySelectorAll('.carousel-dot');
  const thumbs   = root.querySelectorAll('.carousel-thumb');
  const modal    = root.querySelector('.carousel-modal');
  const modalImage = root.querySelector('.carousel-modal-image');
  const modalDots = root.querySelectorAll('.carousel-modal-dot');
  const modalCounter = root.querySelector('.carousel-modal-counter');
  const total    = slides.length;

  return {
    root,
    carousel,
    slides,
    dots,
    thumbs,
    modal,
    modalImage,
    modalDots,
    modalCounter,
    total
  };
}

function setCarouselIndex(root, index) {
  const elements = getCarouselElements(root);
  if (!elements || !elements.total) return;

  const next = ((index % elements.total) + elements.total) % elements.total;

  const activeSlideImage = elements.slides[next]?.querySelector('img');
  const activeImageSrc = activeSlideImage?.getAttribute('src') || '';
  const activeImageAlt = activeSlideImage?.getAttribute('alt') || 'Listing photo';

  elements.carousel.dataset.current = next;
  elements.slides.forEach((slide, i) => slide.classList.toggle('is-active', i === next));
  elements.dots.forEach((dot, i) => dot.classList.toggle('is-active', i === next));
  elements.thumbs.forEach((thumb, i) => thumb.classList.toggle('is-active', i === next));
  elements.modalDots.forEach((dot, i) => dot.classList.toggle('is-active', i === next));

  if (elements.modalImage && activeImageSrc) {
    elements.modalImage.setAttribute('src', activeImageSrc);
    elements.modalImage.setAttribute('alt', activeImageAlt);
  }

  if (elements.modalCounter) {
    elements.modalCounter.textContent = `${next + 1} / ${elements.total}`;
  }
}

function sanitizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '');
}

function ensureLoginUiElements() {
  const loginCard = document.querySelector('#page-login .login-card');
  if (!loginCard) return null;

  const submitButton = document.getElementById('login-submit-btn') 
    || loginCard.querySelector('.login-btn');
  if (!submitButton) return null;

  const tabs = loginCard.querySelectorAll('.tabs button');
  const phoneTab = tabs[0] || null;
  const emailTab = tabs[1] || null;

  const roleButtons = loginCard.querySelectorAll('.role-toggle button');
  const tenantButton = roleButtons[0] || null;
  const ownerButton = roleButtons[1] || null;

  let phoneInput = document.getElementById('login-phone')
    || loginCard.querySelector('input[type="tel"]')
    || loginCard.querySelector('input[placeholder*="Phone" i]')
    || loginCard.querySelector(':scope > input[type="text"]');
  if (phoneInput && !phoneInput.id) phoneInput.id = 'login-phone';

  let emailInput = document.getElementById('login-email')
    || loginCard.querySelector('input[type="email"]')
    || null;

  const passwordField = loginCard.querySelector('.password-field') || null;
  const passwordInput = document.getElementById('login-password')
    || passwordField?.querySelector('input')
    || null;
  if (passwordInput && !passwordInput.id) passwordInput.id = 'login-password';

  let phoneFields = document.getElementById('auth-phone-fields');
  if (!phoneFields) {
    phoneFields = document.createElement('div');
    phoneFields.id = 'auth-phone-fields';
    if (phoneInput) {
      phoneInput.parentNode?.insertBefore(phoneFields, phoneInput);
      phoneFields.appendChild(phoneInput);
    } else {
      loginCard.insertBefore(phoneFields, passwordField || submitButton);
    }
  }

  if (phoneInput && phoneInput.parentElement !== phoneFields) {
    phoneFields.insertBefore(phoneInput, phoneFields.firstChild);
  }

  let emailFields = document.getElementById('auth-email-fields');
  if (!emailFields) {
    emailFields = document.createElement('div');
    emailFields.id = 'auth-email-fields';
    loginCard.insertBefore(emailFields, submitButton);
  }

  if (!emailInput) {
    emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'login-email';
    emailInput.placeholder = 'Email address';
  }

  if (emailInput.parentElement !== emailFields) {
    emailFields.appendChild(emailInput);
  }

  if (passwordField && passwordField.parentElement !== emailFields) {
    emailFields.appendChild(passwordField);
  }

  let otpSection = document.getElementById('phone-otp-section');
  if (!otpSection) {
    otpSection = document.createElement('div');
    otpSection.id = 'phone-otp-section';
    otpSection.style.display = 'none';
    otpSection.innerHTML = `
      <input type="text" id="login-otp" placeholder="Enter 6-digit OTP" inputmode="numeric" maxlength="6">
      <input type="text" id="login-name" placeholder="Full name (for new users)">
    `;
    phoneFields.appendChild(otpSection);
  }

  let errorField = document.getElementById('login-error');
  if (!errorField) {
    errorField = document.createElement('p');
    errorField.id = 'login-error';
    submitButton.insertAdjacentElement('afterend', errorField);
  }

  errorField.style.color = '#dc2626';
  errorField.style.marginTop = '10px';

  return {
    loginCard,
    submitButton,
    phoneTab,
    emailTab,
    tenantButton,
    ownerButton,
    phoneInput,
    emailInput,
    passwordField,
    passwordInput,
    phoneFields,
    emailFields,
    otpSection,
    otpInput: document.getElementById('login-otp'),
    nameInput: document.getElementById('login-name'),
    errorField
  };
}

function setLoginError(message = '') {
  const ui = ensureLoginUiElements();
  if (!ui?.errorField) return;
  ui.errorField.textContent = message;
}

function applyRoleToggleState() {
  const ui = ensureLoginUiElements();
  if (!ui) return;

  if (ui.tenantButton) ui.tenantButton.classList.toggle('active', selectedRole === 'tenant');
  if (ui.ownerButton) ui.ownerButton.classList.toggle('active', selectedRole === 'owner');
}

function applyAuthModeState(nextMode = authState.loginMode) {
  const ui = ensureLoginUiElements();
  if (!ui) return;

  const mode = nextMode === 'email' ? 'email' : 'phone';
  authState.loginMode = mode;

  if (ui.phoneTab) ui.phoneTab.classList.toggle('active', mode === 'phone');
  if (ui.emailTab) ui.emailTab.classList.toggle('active', mode === 'email');

  if (ui.phoneFields) ui.phoneFields.style.display = mode === 'phone' ? '' : 'none';
  if (ui.emailFields) ui.emailFields.style.display = mode === 'email' ? '' : 'none';

  // Password is only used for email login mode.
  if (ui.passwordField) ui.passwordField.style.display = mode === 'email' ? '' : 'none';

  if (mode === 'phone') {
    if (ui.otpSection) ui.otpSection.style.display = authState.otpSent ? '' : 'none';
    if (ui.submitButton) ui.submitButton.textContent = authState.otpSent ? 'Verify OTP' : 'Send OTP';
  } else {
    authState.otpSent = false;
    authState.otpPhone = '';
    if (ui.otpSection) ui.otpSection.style.display = 'none';
    if (ui.submitButton) ui.submitButton.textContent = 'Login';
  }
}

function setSelectedRole(role) {
  selectedRole = role === 'owner' ? 'owner' : 'tenant';
  authState.loginRole = selectedRole;
  applyRoleToggleState();
}

function resetAuthFlow(options = {}) {
  const { preserveMode = false } = options;
  const ui = ensureLoginUiElements();
  if (!ui) return;

  [ui.phoneInput, ui.emailInput, ui.passwordInput, ui.otpInput, ui.nameInput].forEach((input) => {
    if (input) input.value = '';
  });

  authState.otpSent = false;
  authState.otpPhone = '';

  if (!preserveMode) {
    authState.loginMode = 'phone';
  }

  setSelectedRole('tenant');
  setLoginError('');
  applyAuthModeState(authState.loginMode);
}

async function sendOtpForPhoneLogin() {
  const ui = ensureLoginUiElements();
  if (!ui) return;

  setLoginError('');
  const phone = sanitizePhone(ui.phoneInput?.value || '');
  if (!/^\d{10}$/.test(phone)) {
    setLoginError('Please enter a valid 10-digit phone number.');
    return;
  }

  ui.submitButton.disabled = true;
  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Unable to send OTP.');
    }

    authState.otpSent = true;
    authState.otpPhone = phone;
    if (ui.otpSection) ui.otpSection.style.display = '';
    applyAuthModeState('phone');
  } catch (err) {
    setLoginError(err.message || 'Unable to send OTP.');
  } finally {
    ui.submitButton.disabled = false;
  }
}

async function verifyPhoneOtpLogin() {
  const ui = ensureLoginUiElements();
  if (!ui) return;

  setLoginError('');
  const phone = sanitizePhone(ui.phoneInput?.value || authState.otpPhone || '');
  const otp = String(ui.otpInput?.value || '').trim();
  const name = String(ui.nameInput?.value || '').trim();

  if (!/^\d{10}$/.test(phone)) {
    setLoginError('Please enter a valid 10-digit phone number.');
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    setLoginError('Please enter a valid 6-digit OTP.');
    return;
  }

  ui.submitButton.disabled = true;
  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, name, role: selectedRole })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'OTP verification failed.');
    }

    await completeAuthSession(data, { redirectPage: 'home' });
  } catch (err) {
    setLoginError(err.message || 'OTP verification failed.');
  } finally {
    ui.submitButton.disabled = false;
  }
}

async function loginWithEmailPassword() {
  const ui = ensureLoginUiElements();
  if (!ui) return;

  setLoginError('');
  const email = String(ui.emailInput?.value || '').trim();
  const password = String(ui.passwordInput?.value || '').trim();

  if (!email) {
    setLoginError('Please enter your email address.');
    return;
  }

  if (!password) {
    setLoginError('Please enter your password.');
    return;
  }

  ui.submitButton.disabled = true;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: selectedRole })
    });
    const data = await res.json();

    if (!res.ok || !data?.token || !data?.user) {
      throw new Error(data.message || 'Login failed.');
    }

    await completeAuthSession(data, { redirectPage: 'home' });
  } catch (err) {
    setLoginError(err.message || 'Login failed.');
  } finally {
    ui.submitButton.disabled = false;
  }
}

async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  setLoginError('');

  if (authState.loginMode === 'phone') {
    if (authState.otpSent) {
      await verifyPhoneOtpLogin();
      return;
    }
    await sendOtpForPhoneLogin();
    return;
  }

  await loginWithEmailPassword();
}

function bindLoginUiEvents() {
  const ui = ensureLoginUiElements();
  if (!ui || ui.loginCard.dataset.authBound === 'true') return;

  ui.phoneTab?.addEventListener('click', () => {
    authState.otpSent = false;
    authState.otpPhone = '';
    applyAuthModeState('phone');
    setLoginError('');
  });

  ui.emailTab?.addEventListener('click', () => {
    applyAuthModeState('email');
    setLoginError('');
  });

  ui.tenantButton?.addEventListener('click', () => {
    setSelectedRole('tenant');
  });

  ui.ownerButton?.addEventListener('click', () => {
    setSelectedRole('owner');
  });

  ui.submitButton?.addEventListener('click', handleLoginSubmit);

  ui.loginCard.querySelectorAll('input').forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        handleLoginSubmit(event);
      }
    });
  });

  ui.loginCard.dataset.authBound = 'true';
}

async function completeAuthSession(data, options = {}) {
  const { redirectPage = 'home' } = options;
  if (!data?.token || !data?.user) {
    throw new Error('Invalid login response from server.');
  }

  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  await loadWishlistState();
  updateNav();
  showPage(redirectPage);
}

// ── REGISTRATION FLOW ────────────────────────────────────────────────────────

let registerRole = 'tenant';

function showRegisterForm() {
  // Hide login elements
  document.querySelector('.tabs').style.display = 'none';
  document.getElementById('auth-phone-fields').style.display = 'none';
  document.getElementById('auth-email-fields').style.display = 'none';
  document.querySelector('.role-toggle').style.display = 'none';
  document.getElementById('login-submit-btn').style.display = 'none';
  document.getElementById('show-register-link').style.display = 'none';

  // Show register elements
  document.getElementById('register-fields').style.display = 'block';
  document.getElementById('show-login-link').style.display = 'inline';
}

function showLoginForm() {
  // Hide register elements
  document.getElementById('register-fields').style.display = 'none';
  document.getElementById('show-login-link').style.display = 'none';

  // Show login elements
  document.querySelector('.tabs').style.display = '';
  document.querySelector('.role-toggle').style.display = '';
  document.getElementById('login-submit-btn').style.display = '';
  document.getElementById('show-register-link').style.display = 'inline';

  applyAuthModeState(authState.loginMode);
}

function bindRegisterEvents() {
  if (window.__registerBound) return;
  window.__registerBound = true;

  document.getElementById('show-register-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });

  document.getElementById('show-login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });

  document.getElementById('register-tenant-btn')?.addEventListener('click', () => {
    registerRole = 'tenant';
    document.getElementById('register-tenant-btn').classList.add('active');
    document.getElementById('register-owner-btn').classList.remove('active');
  });

  document.getElementById('register-owner-btn')?.addEventListener('click', () => {
    registerRole = 'owner';
    document.getElementById('register-owner-btn').classList.add('active');
    document.getElementById('register-tenant-btn').classList.remove('active');
  });

  document.getElementById('register-submit-btn')?.addEventListener('click', handleRegisterSubmit);
}

async function handleRegisterSubmit() {
  const name = document.getElementById('register-name')?.value.trim() || '';
  const emailOrPhone = document.getElementById('register-email')?.value.trim() || '';
  const password = document.getElementById('register-password')?.value || '';
  const errorEl = document.getElementById('register-error');
  const btn = document.getElementById('register-submit-btn');

  errorEl.textContent = '';

  if (!name) { errorEl.textContent = 'Please enter your full name.'; return; }
  if (!emailOrPhone) { errorEl.textContent = 'Please enter your email or phone number.'; return; }
  if (!password) { errorEl.textContent = 'Please enter a password.'; return; }
  if (password.length < 8) {
    errorEl.textContent = 'Password must be at least 8 characters with letters and numbers.';
    return;
  }

  // Detect if phone or email
  const isPhone = /^\d{10}$/.test(emailOrPhone.replace(/[^\d]/g, ''));

  btn.disabled = true;
  btn.textContent = 'Creating account...';

  try {
    let res;
    let data;

    if (isPhone) {
      // Phone registration — send OTP first, then let OTP flow handle it
      errorEl.style.color = '#2563eb';
      errorEl.textContent = 'Phone detected — switching to OTP flow...';

      setTimeout(() => {
        showLoginForm();
        const phoneInput = document.getElementById('login-phone');
        if (phoneInput) phoneInput.value = emailOrPhone;
        applyAuthModeState('phone');
        errorEl.textContent = '';
      }, 1000);
      return;
    }

    // Email registration
    res = await fetch('/api/auth/register-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email: emailOrPhone,
        password,
        role: registerRole
      })
    });

    data = await res.json();

    if (!res.ok) {
      errorEl.style.color = '#dc2626';
      errorEl.textContent = data.message || 'Registration failed.';
      return;
    }

    await completeAuthSession(data, { redirectPage: 'home' });
  } catch (err) {
    errorEl.style.color = '#dc2626';
    errorEl.textContent = err.message || 'Something went wrong. Please try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

function carouselGoTo(triggerEl, index) {
  const root = carouselRoot(triggerEl);
  setCarouselIndex(root, index);
}

function carouselModalGoTo(triggerEl, index) {
  const root = carouselRoot(triggerEl);
  setCarouselIndex(root, index);
}

function openCarouselModal(triggerEl, index) {
  const root = carouselRoot(triggerEl);
  const elements = getCarouselElements(root);
  if (!elements?.modal) return;

  setCarouselIndex(root, index);
  elements.modal.classList.add('is-open');
  elements.modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeCarouselModal(event) {
  const target = event?.currentTarget || event?.target;
  const modal = target?.closest ? target.closest('.carousel-modal') : null;
  if (!modal) return;
  if (event?.target === modal || event?.target?.closest('.carousel-modal-close')) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }
}

function carouselCurrentIndex(root) {
  const elements = getCarouselElements(root);
  if (!elements) return 0;
  return parseInt(elements.carousel.dataset.current || '0', 10);
}

function carouselStep(triggerEl, dir) {
  const root = carouselRoot(triggerEl);
  const current = carouselCurrentIndex(root);
  setCarouselIndex(root, current + dir);
}

function carouselKey(event, carouselEl) {
  const root = carouselRoot(carouselEl);
  if (!root) return;

  if (event.key === 'ArrowLeft') setCarouselIndex(root, carouselCurrentIndex(root) - 1);
  if (event.key === 'ArrowRight') setCarouselIndex(root, carouselCurrentIndex(root) + 1);
  if (event.key === 'Enter') openCarouselModal(carouselEl, carouselCurrentIndex(root));
}

function bindCarouselSwipe(root) {
  const elements = getCarouselElements(root);
  if (!elements) return;

  const swipeTargets = [elements.carousel, root.querySelector('.carousel-modal-stage')].filter(Boolean);

  swipeTargets.forEach((target) => {
    if (target.dataset.swipeBound === 'true') return;

    let startX = 0;
    let startY = 0;

    target.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });

    target.addEventListener('touchend', (event) => {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) {
        return;
      }

      if (deltaX < 0) {
        setCarouselIndex(root, carouselCurrentIndex(root) + 1);
      } else {
        setCarouselIndex(root, carouselCurrentIndex(root) - 1);
      }
    }, { passive: true });

    target.dataset.swipeBound = 'true';
  });
}

function initializeDetailCarousels(scope = document) {
  scope.querySelectorAll('.detail-photos').forEach((root) => {
    setCarouselIndex(root, carouselCurrentIndex(root));
    bindCarouselSwipe(root);
  });
}

// ────────────────────────────────────────────────────────────────────────────

function renderListingImage(listing, altText) {
  if (listing.photos && listing.photos.length > 0) {
    return `<img src="${listing.photos[0]}" alt="${altText}" loading="lazy" decoding="async">`;
  }

  return '<div class="no-image">Home</div>';
}

function isListingOwner(listing) {
  const user = getUser();
  if (!user || user.role !== 'owner') return false;

  const ownerId = typeof listing.owner === 'object' ? listing.owner?._id || listing.owner?.id : listing.owner;
  return String(ownerId || '') === String(user.id);
}

function renderOwnerListingActions(listing, options = {}) {
  if (!isListingOwner(listing)) return '';

  const { detail = false } = options;
  const actionClass = detail ? 'owner-listing-actions detail-owner-actions' : 'owner-listing-actions';

  return `
    <div class="${actionClass}" onclick="event.stopPropagation()">
      <button class="owner-action-button" onclick="openEditListingForm('${listing._id}')">Edit</button>
      <button class="owner-action-button is-danger" onclick="deleteListing('${listing._id}', { source: '${detail ? 'detail' : 'listings'}' })">Delete</button>
    </div>
  `;
}

function normalizePhoneForWhatsApp(raw) {
  if (!raw) return null;
  let digits = String(raw).trim().replace(/[^0-9+]/g, '');

  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }

  // If only local 10-digit, add India code 91.
  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }

  if (digits.length > 0) {
    return digits;
  }

  return null;
}

function buildWhatsAppContactUrl(phone, message) {
  const normalizedPhone = normalizePhoneForWhatsApp(phone);
  if (!normalizedPhone) return null;

  const safeMessage = String(message || '').trim();
  return `https://wa.me/${encodeURIComponent(normalizedPhone)}${safeMessage ? `?text=${encodeURIComponent(safeMessage)}` : ''}`;
}

function renderWhatsAppButton(listing) {
  const contact = normalizePhoneForWhatsApp(listing.contact || listing.owner?.phone || listing.owner?.mobile || '');
  if (!contact) return '';

  const title = getSafeListingTitle(listing.title, 'this property');
  const location = getSafeListingLocation(
    [listing.address, listing.city],
    getSafeListingText(listing.city, {
      fallback: 'the listed location',
      minLength: 3,
      maxLength: 60
    })
  );
  const message = `Hi, I'm interested in your property: ${title}, located at ${location}. Please share details.`;
  const url = buildWhatsAppContactUrl(contact, message);
  if (!url) return '';

  return `<a href="${url}" target="_blank" rel="noopener" class="btn btn-whatsapp" onclick="event.stopPropagation()">Chat on whatsapp</a>`;
}

function renderStickyListingCta(listing) {
  const contact = normalizePhoneForWhatsApp(listing.contact || listing.owner?.phone || listing.owner?.mobile || '');
  if (!contact) return '';

  const title = getSafeListingTitle(listing.title, 'this property');
  const location = getSafeListingLocation(
    [listing.address, listing.city],
    getSafeListingText(listing.city, {
      fallback: 'the listed location',
      minLength: 3,
      maxLength: 60
    })
  );
  const message = `Hi, I'm interested in your property: ${title}, located at ${location}. Please share details.`;
  const url = buildWhatsAppContactUrl(contact, message);
  if (!url) return '';

  return `
    <div class="sticky-listing-cta">
      <div class="sticky-listing-cta-inner">
        <a
          href="${url}"
          target="_blank"
          rel="noopener"
          class="sticky-whatsapp-button"
        >
          Contact Owner
        </a>
      </div>
    </div>
  `;
}

function scrollToDetailSummary() {
  const summary = document.querySelector('.detail-summary');
  if (!summary) return;

  summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function canUseWishlist() {
  return true;
}

function canSyncWishlist() {
  const user = getUser();
  return Boolean(user && getToken());
}

function canSendEnquiry() {
  const user = getUser();
  return Boolean(user && user.role === 'tenant');
}

function isListingSaved(listingId) {
  return savedListingIds.has(String(listingId));
}

function normalizeWishlistListingId(listingId) {
  return String(listingId || '').trim();
}

function getWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY) || localStorage.getItem(WISHLIST_LEGACY_STORAGE_KEY);
    if (!raw) {
      console.debug('[wishlist] getWishlist: empty');
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.debug('[wishlist] getWishlist: invalid payload');
      return new Set();
    }
    const ids = new Set(parsed.map((id) => String(id)).filter(Boolean));
    console.debug('[wishlist] getWishlist:', [...ids]);
    return ids;
  } catch (err) {
    console.warn('wishlist storage read failed:', err);
    return new Set();
  }
}

function saveWishlist(ids = savedListingIds) {
  try {
    const uniqueIds = [...new Set([...ids].map((id) => String(id)).filter(Boolean))];
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(uniqueIds));
    localStorage.removeItem(WISHLIST_LEGACY_STORAGE_KEY);
    console.debug('[wishlist] saveWishlist:', uniqueIds);
  } catch (err) {
    console.warn('wishlist storage write failed:', err);
  }
}

function updateWishlistButtonElement(button, saved) {
  if (!button) return;

  button.classList.toggle('is-saved', saved);
  button.classList.toggle('active', saved);
  button.setAttribute('aria-pressed', saved ? 'true' : 'false');
  button.setAttribute('aria-label', saved ? 'Remove from wishlist' : 'Save to wishlist');
}

function applyWishlistUI(targetListingId = null, forcedSavedState = null) {
  const normalizedTargetId = targetListingId ? normalizeWishlistListingId(targetListingId) : null;

  document.querySelectorAll('.wishlist-btn[data-wishlist-id]').forEach((button) => {
    const listingId = normalizeWishlistListingId(
      button.getAttribute('data-wishlist-id')
      || button.getAttribute('data-id')
      || button.closest('[data-id]')?.getAttribute('data-id')
    );
    if (!listingId) return;
    if (normalizedTargetId && normalizedTargetId !== listingId) return;

    const saved = typeof forcedSavedState === 'boolean'
      ? forcedSavedState
      : savedListingIds.has(listingId);

    updateWishlistButtonElement(button, saved);
    console.debug('[wishlist] applyWishlistUI:', { listingId, saved });
  });
}

function getStoredWishlistIds() {
  return getWishlist();
}

function persistWishlistIds(ids = savedListingIds) {
  saveWishlist(ids);
}

function applyWishlistStateToButtons() {
  applyWishlistUI();
}

function updateWishlistButtons(listingId, saved) {
  applyWishlistUI(listingId, saved);
}

function handleWishlistClick(event, listingId, source = 'listing') {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const normalizedId = normalizeWishlistListingId(listingId);
  if (!normalizedId) {
    console.error('[wishlist] click ignored: missing listing id');
    return;
  }

  console.debug('[wishlist] click fired:', { listingId: normalizedId, source });
  void toggleWishlist(normalizedId, { source });
}

function initWishlistEventDelegation() {
  if (window.__wishlistDelegationBound) return;
  window.__wishlistDelegationBound = true;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;

    const btn = e.target.closest('.wishlist-btn, [data-wishlist-id]');
    if (!btn) return;

    const listingId = btn.getAttribute('data-wishlist-id')
      || btn.getAttribute('data-id')
      || btn.closest('[data-id]')?.getAttribute('data-id');

    const source = btn.getAttribute('data-wishlist-source') || 'listing';
    handleWishlistClick(e, listingId, source);
  });
}

function renderWishlistHeartIcon(saved) {
  return `
    <svg class="wishlist-heart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20.4 10.55 19.08C5.4 14.42 2 11.34 2 7.5 2 5.01 3.99 3 6.45 3c1.74 0 3.41.81 4.55 2.09A6 6 0 0 1 15.55 3C18.01 3 20 5.01 20 7.5c0 3.84-3.4 6.92-8.55 11.58Z"></path>
    </svg>
  `;
}

function renderWishlistHeart(listingId, options = {}) {
  if (!canUseWishlist()) return '';

  const saved = isListingSaved(listingId);
  const variant = options.variant === 'inline' ? 'inline' : 'card';
  const className = `wishlist-heart wishlist-btn wishlist-heart--${variant} ${saved ? 'is-saved active' : ''}`;
  const source = options.source || 'listing';

  return `
    <button
      class="${className}"
      data-wishlist-id="${listingId}"
      data-id="${listingId}"
      data-wishlist-source="${source}"
      aria-pressed="${saved ? 'true' : 'false'}"
      aria-label="${saved ? 'Remove from wishlist' : 'Save to wishlist'}"
      type="button"
      onclick="handleWishlistClick(event, '${listingId}', '${source}')"
    >
      ${renderWishlistHeartIcon(saved)}
    </button>
  `;
}

function renderWishlistButton(listing, options = {}) {
  if (!canUseWishlist()) return '';

  const { detail = false } = options;
  const wrapperClass = detail ? 'wishlist-actions detail-wishlist-actions' : 'wishlist-actions';

  return `
    <div class="${wrapperClass}" onclick="event.stopPropagation()">
      ${renderWishlistHeart(listing._id, { source: detail ? 'detail' : 'listing', variant: 'inline' })}
    </div>
  `;
}

function apiUrl(path) {
  // If running locally (file:// protocol), use deployed API
  if (window.location.protocol === 'file:') {
    return `https://ledge-stay.up.railway.app${path}`;
  }
  return path;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanDisplayValue(value, options = {}) {
  const {
    fallback = '',
    minLength = 2,
    allowShort = false,
    maxLength = 0
  } = options;

  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return fallback;

  const lowered = normalized.toLowerCase();
  const invalidValues = new Set([
    'null',
    'undefined',
    'n/a',
    'na',
    'none',
    'nil',
    '--',
    '-',
    'ss',
    'nn'
  ]);

  if (invalidValues.has(lowered)) return fallback;
  if (!allowShort && normalized.length < minLength) return fallback;
  if (maxLength > 0 && normalized.length > maxLength) {
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }

  return normalized;
}

function safeText(value, options = {}) {
  return escapeHtml(cleanDisplayValue(value, options));
}

function sanitizeAssetUrl(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';

  if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith('/')) {
    return normalized;
  }

  return '';
}

function normalizeListingTags(amenities) {
  const source = Array.isArray(amenities)
    ? amenities
    : String(amenities || '')
      .split(',')
      .map((value) => value.trim());

  const unique = [];
  const seen = new Set();

  source.forEach((item) => {
    const cleaned = cleanDisplayValue(item, { fallback: '', minLength: 2 });
    if (!cleaned) return;

    const normalizedKey = cleaned.toLowerCase();
    if (seen.has(normalizedKey)) return;

    seen.add(normalizedKey);
    unique.push(cleaned);
  });

  return unique.slice(0, 4);
}

function formatListingPriceDisplay(price) {
  const safePrice = Number(price);
  if (!Number.isFinite(safePrice) || safePrice <= 0) {
    return 'Price on request';
  }

  return `\u20B9${safePrice.toLocaleString('en-IN')}/month`;
}

function getSafeListingTitle(value, fallback = 'Untitled listing') {
  return cleanDisplayValue(value, {
    fallback,
    minLength: 3,
    maxLength: 50
  });
}

function getSafeListingLocation(parts, fallback = 'Location details unavailable') {
  const joined = Array.isArray(parts)
    ? parts.filter(Boolean).join(', ')
    : String(parts || '');

  return cleanDisplayValue(joined, {
    fallback,
    minLength: 3,
    maxLength: 60
  });
}

function getSafeListingText(value, options = {}) {
  return cleanDisplayValue(value, options);
}

function formatListingPriceSafe(price) {
  const safePrice = Number(price);
  if (!Number.isFinite(safePrice) || safePrice <= 0) {
    return 'Price on request';
  }

  return `₹${safePrice.toLocaleString('en-IN')}/month`;
}

function formatListingPrice(price) {
  const safePrice = Number(price);
  if (!Number.isFinite(safePrice) || safePrice <= 0) {
    return 'Price on request';
  }

  return `₹${safePrice.toLocaleString('en-IN')}/month`;
}

function buildListingCardData(listing = {}) {
  const city = getSafeListingText(listing.city, {
    fallback: 'Location unavailable',
    minLength: 3,
    maxLength: 30
  });
  const title = getSafeListingTitle(listing.title);
  const address = getSafeListingText(listing.address, {
    fallback: 'Location details will be shared on request',
    minLength: 4,
    maxLength: 60
  });
  const tags = normalizeListingTags(listing.amenities);
  const location = getSafeListingLocation(
    [
      address !== 'Location details will be shared on request' ? address : '',
      city !== 'Location unavailable' ? city : ''
    ],
    city !== 'Location unavailable' ? city : 'Location details unavailable'
  );
  const distanceKm = typeof listing.distanceKm === 'number' && Number.isFinite(listing.distanceKm)
    ? `${listing.distanceKm.toFixed(1)} km away`
    : '';
  const price = formatListingPriceDisplay(listing.price);
  const ownerPhone = listing.contact || listing.owner?.whatsapp || listing.owner?.phone || listing.owner?.mobile || '';
  const averageRating = Number(listing.averageRating);
  const reviewCount = Math.max(0, Number(listing.reviewCount || 0));
  const rating = Number.isFinite(averageRating) && averageRating > 0
    ? {
        value: averageRating.toFixed(1),
        count: reviewCount,
        stars: '★'.repeat(Math.round(averageRating)) + '☆'.repeat(5 - Math.round(averageRating))
      }
    : null;

  const badges = [];
  if (listing.noBrokerage) badges.push('<span class="img-badge badge-green">No Brokerage</span>');
  if (listing.verified) badges.push('<span class="img-badge badge-teal">Verified</span>');
  if (listing.is_featured) badges.push('<span class="img-badge badge-gold">Best Deal</span>');

  const whatsappMessage = `Hi, I'm interested in your property: ${title}, located at ${location}. Please share details.`;
  const whatsappUrl = buildWhatsAppContactUrl(ownerPhone, whatsappMessage);
  const imageUrl = sanitizeAssetUrl(listing.photos?.[0] || '');
  const imageHtml = imageUrl
    ? `<img src="${imageUrl}" alt="${escapeHtml(title)}" loading="lazy">`
    : `
      <div class="no-image card-image-fallback" aria-label="No listing image available">
        <span class="card-image-fallback-icon" aria-hidden="true">Home</span>
        <span class="card-image-fallback-text">Image unavailable</span>
      </div>
    `;

  return {
    id: listing._id,
    city,
    title,
    address,
    location,
    tags,
    verified: Boolean(listing.verified),
    distanceKm,
    price,
    rating,
    badges,
    whatsappUrl,
    imageHtml,
    ownerActions: renderOwnerListingActions(listing)
  };
}

function renderListingCard(listing) {
  const card = buildListingCardData(listing);
  const amenityTags = (card.tags.length ? card.tags : ['WiFi', 'AC', 'Meals']).slice(0, 3);
  const amenityMarkup = amenityTags
    .map((tag) => `<span class="listing-amenity-pill" title="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`)
    .join('');

  return `
    <article class="listing-card listing-card--premium" id="listing-card-${card.id}" data-id="${card.id}" onclick="showDetail('${card.id}')">
      <div class="card-img-wrap">
        ${card.verified ? `
          <div class="listing-verified-badge" aria-label="Verified listing">
            <span class="listing-verified-dot" aria-hidden="true"></span>
            <span>Verified</span>
          </div>
        ` : ''}
        ${card.imageHtml}
        ${renderWishlistHeart(card.id, { source: 'listing' })}
      </div>
      <div class="card-body">
        <div class="card-meta-row">
          <p class="card-city-label" title="${escapeHtml(card.city)}">${escapeHtml(card.city)}</p>
          <span class="card-quick-tag">Easy view</span>
        </div>
        <h3 class="card-title" title="${escapeHtml(card.title)}">${escapeHtml(card.title)}</h3>
        <div class="listing-amenity-row" aria-label="Amenities">${amenityMarkup}</div>
        <div class="listing-card-divider" aria-hidden="true"></div>
        <div class="card-footer">
          <div class="listing-price-block">
            <span class="listing-price-label">Starting from</span>
            <div class="price" title="${escapeHtml(card.price)}">${escapeHtml(card.price)}</div>
          </div>
          <div class="card-actions" onclick="event.stopPropagation()">
            ${card.whatsappUrl ? `<a href="${card.whatsappUrl}" target="_blank" rel="noopener" class="btn-whatsapp btn-whatsapp--card" onclick="event.stopPropagation()">WhatsApp</a>` : ''}
            <button class="btn-details" onclick="event.stopPropagation();showDetail('${card.id}')">See details</button>
          </div>
        </div>
      </div>
    </article>`;
}

async function loadAppConfig() {
  try {
    const data = await apiFetchJson('/api/config');
    appConfig = {
      mapsEmbedApiKey: data.mapsEmbedApiKey || ''
    };
  } catch (err) {
    console.error('config load error:', err);
    appConfig = { mapsEmbedApiKey: '' };
  }
}

function hasMapCoordinates(listing) {
  return Number.isFinite(Number(listing?.lat)) && Number.isFinite(Number(listing?.lng));
}

function buildGoogleMapEmbedUrl(listing) {
  if (!appConfig.mapsEmbedApiKey) return '';

  let query = '';
  if (hasMapCoordinates(listing)) {
    query = `${Number(listing.lat)},${Number(listing.lng)}`;
  } else {
    const addressParts = [listing?.address, listing?.city].filter(Boolean);
    if (!addressParts.length) return '';
    query = addressParts.join(', ');
  }

  return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(appConfig.mapsEmbedApiKey)}&q=${encodeURIComponent(query)}`;
}

function renderMapSection(listing) {
  const embedUrl = buildGoogleMapEmbedUrl(listing);
  if (!embedUrl) return '';

  return `
    <section class="map-section">
      <div class="map-section-header">
        <div>
          <h2>Location</h2>
          <p class="reviews-subtitle">See where this property sits before you decide to enquire or visit.</p>
        </div>
      </div>
      <div class="map-frame-wrap">
        <iframe
          class="listing-map-frame"
          src="${embedUrl}"
          loading="lazy"
          allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
          title="Map showing ${escapeHtml(listing.title)}"
        ></iframe>
      </div>
    </section>
  `;
}

async function readJsonSafely(response) {
  const rawText = await response.text();
  if (!rawText) {
    return { data: null, rawText: '' };
  }

  try {
    return { data: JSON.parse(rawText), rawText };
  } catch (err) {
    return { data: null, rawText };
  }
}

async function apiFetchJson(path, options = {}) {
  console.log('api request:', path, options?.method || 'GET');
  const response = await fetch(apiUrl(path), options);
  console.log('api response status:', path, response.status);
  const { data, rawText } = await readJsonSafely(response);
  console.log('api response data:', path, data ?? rawText);

  if (!response.ok) {
    throw new Error(data?.message || `API error ${response.status}`);
  }

  if (data === null) {
    throw new Error(rawText ? 'Invalid JSON response from server.' : 'Empty response from server.');
  }

  return data;
}

async function loadWishlistState() {
  if (!canUseWishlist()) {
    savedListingIds = new Set();
    return;
  }

  const localIds = getStoredWishlistIds();
  savedListingIds = new Set(localIds);

  if (!canSyncWishlist()) {
    persistWishlistIds(savedListingIds);
    applyWishlistStateToButtons();
    return;
  }

  try {
    const data = await apiFetchJson('/api/wishlist', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const remoteIds = new Set((data.listingIds || []).map((id) => String(id)));
    const merged = new Set([...remoteIds, ...localIds]);
    savedListingIds = merged;
    persistWishlistIds(merged);

    const toAdd = [...merged].filter((id) => !remoteIds.has(id));
    if (toAdd.length > 0) {
      await Promise.allSettled(toAdd.map((id) => apiFetchJson('/api/wishlist', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ listingId: id })
      })));
    }
  } catch (err) {
    console.error('wishlist load error:', err);
  } finally {
    applyWishlistStateToButtons();
  }
}

async function loadWishlistPage() {
  const wishlistGrid = document.getElementById('wishlist-grid');
  if (!wishlistGrid || !canUseWishlist()) return;

  if (!canSyncWishlist()) {
    wishlistGrid.innerHTML = '<div class="featured-empty">Please login to see your saved listings.</div>';
    return;
  }

  wishlistGrid.innerHTML = '<div class="featured-empty">Loading your saved listings...</div>';

  try {
    const data = await apiFetchJson('/api/wishlist', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    savedListingIds = new Set((data.listingIds || []).map((id) => String(id)));
    persistWishlistIds(savedListingIds);
    const listings = Array.isArray(data.wishlist) ? data.wishlist : [];

    if (listings.length === 0) {
      wishlistGrid.innerHTML = '<div class="featured-empty">No saved listings yet. Tap the heart on any listing to add it here.</div>';
      return;
    }

    wishlistGrid.innerHTML = listings.map((listing) => `
      <article class="featured-card" id="wishlist-card-${listing._id}" data-id="${listing._id}">
        <div class="featured-image-wrap">
          ${renderWishlistHeart(listing._id, { source: 'wishlist' })}
          ${renderListingImage(listing, listing.title)}
        </div>
        <div class="featured-card-body">
          <p class="featured-location">${listing.city}</p>
          <h3>${listing.title}</h3>
          <p class="featured-address">${listing.address}</p>
          <div class="featured-card-footer">
            <div class="featured-price">Rs ${Number(listing.price).toLocaleString()}/month</div>
            <div class="featured-card-actions">
              ${renderWhatsAppButton(listing)}
              <button class="featured-view-button" onclick="showDetail('${listing._id}')">View</button>
            </div>
          </div>
        </div>
      </article>
    `).join('');
  } catch (err) {
    wishlistGrid.innerHTML = `<div class="featured-empty">${err.message || 'Unable to load your wishlist right now.'}</div>`;
  }
}

async function toggleWishlist(listingId, options = {}) {
  if (!canUseWishlist()) {
    console.debug('[wishlist] toggle ignored: unavailable');
    return;
  }

  const normalizedId = normalizeWishlistListingId(listingId);
  if (!normalizedId) {
    console.debug('[wishlist] toggle ignored: missing id');
    return;
  }

  const wasSaved = savedListingIds.has(normalizedId);
  const nextSaved = !wasSaved;

  if (nextSaved) {
    savedListingIds.add(normalizedId);
  } else {
    savedListingIds.delete(normalizedId);
  }

  persistWishlistIds(savedListingIds);
  updateWishlistButtons(normalizedId, nextSaved);
  console.debug('[wishlist] toggled:', { listingId: normalizedId, saved: nextSaved, total: savedListingIds.size });

  if (options.source === 'wishlist' || window.location.pathname === '/wishlist') {
    const wishlistCard = document.getElementById(`wishlist-card-${normalizedId}`);
    if (wishlistCard && !nextSaved) {
      wishlistCard.remove();
    }

    const wishlistGrid = document.getElementById('wishlist-grid');
    if (wishlistGrid && !wishlistGrid.querySelector('.featured-card')) {
      wishlistGrid.innerHTML = '<div class="featured-empty">No saved listings yet. Tap the heart on any listing to add it here.</div>';
    }
  }

  if (!canSyncWishlist()) {
    console.debug('[wishlist] local-only mode');
    return;
  }

  try {
    if (nextSaved) {
      await apiFetchJson('/api/wishlist', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ listingId: normalizedId })
      });
    } else {
      await apiFetchJson(`/api/wishlist/${normalizedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
    }
  } catch (err) {
    if (nextSaved) {
      savedListingIds.delete(normalizedId);
    } else {
      savedListingIds.add(normalizedId);
    }
    persistWishlistIds(savedListingIds);
    updateWishlistButtons(normalizedId, !nextSaved);
    alert(err.message || 'Unable to update your saved listings.');
  }
}

function resetListingForm() {
  editingListingId = null;
  document.getElementById('post-form-title').textContent = 'Post a Listing';
  document.getElementById('post-submit-button').textContent = 'Post Listing';
  document.getElementById('post-title').value = '';
  document.getElementById('post-type').value = 'pg';
  document.getElementById('post-city').value = '';
  document.getElementById('post-address').value = '';
  document.getElementById('post-contact').value = '';
  document.getElementById('post-lat').value = '';
  document.getElementById('post-lng').value = '';
  document.getElementById('post-price').value = '';
  document.getElementById('post-gender').value = 'any';
  document.getElementById('post-description').value = '';
  document.getElementById('post-amenities').value = '';
  document.getElementById('post-available').checked = true;
  document.getElementById('post-featured').checked = false;
  document.getElementById('post-photos').value = '';
  document.getElementById('post-error').textContent = '';
}

function renderDashboardEnquiries(enquiries = [], unreadCount = 0) {
  const enquiryList = document.getElementById('dashboard-enquiries-list');
  if (!enquiryList) return;

  if (!Array.isArray(enquiries) || enquiries.length === 0) {
    enquiryList.innerHTML = '<div class="dashboard-empty">No enquiries yet.</div>';
    return;
  }

  enquiryList.innerHTML = enquiries.map((enquiry) => `
    <article class="dashboard-enquiry-card ${enquiry.isRead ? 'is-read' : 'is-unread'}">
      <div class="dashboard-enquiry-top">
        <div>
          <p class="dashboard-enquiry-listing">${escapeHtml(enquiry.listing?.title || 'Listing unavailable')}</p>
          <h3>${escapeHtml(enquiry.name)}</h3>
          <p class="dashboard-enquiry-meta">${escapeHtml(enquiry.email)} · ${new Date(enquiry.createdAt).toLocaleDateString()}</p>
        </div>
        <div class="dashboard-enquiry-status-wrap">
          <span class="dashboard-chip ${enquiry.isRead ? 'is-read' : 'is-unread'}">${enquiry.isRead ? 'Read' : 'Unread'}</span>
          <button class="dashboard-action-button" onclick="toggleEnquiryRead('${enquiry._id}', ${!enquiry.isRead})">
            Mark as ${enquiry.isRead ? 'Unread' : 'Read'}
          </button>
        </div>
      </div>
      ${enquiry.listing?.address ? `<p class="dashboard-enquiry-location">${escapeHtml(enquiry.listing.address)}, ${escapeHtml(enquiry.listing.city || '')}</p>` : ''}
      <p class="dashboard-enquiry-message">${escapeHtml(enquiry.message)}</p>
    </article>
  `).join('');

  const unreadNode = document.getElementById('dashboard-unread-enquiries');
  if (unreadNode) {
    unreadNode.textContent = unreadCount;
  }
}

function renderOwnerNotifications(notifications = []) {
  const container = document.getElementById('dashboard-notifications-list');
  if (!container) return;

  if (!Array.isArray(notifications) || notifications.length === 0) {
    container.innerHTML = '<div class="dashboard-empty">No admin updates yet. Listing approvals and rejections will appear here.</div>';
    return;
  }

  container.innerHTML = notifications.map((notification) => `
    <article class="dashboard-enquiry-card ${notification.isRead ? 'is-read' : 'is-unread'}">
      <div class="dashboard-enquiry-top">
        <div>
          <p class="dashboard-enquiry-listing">${escapeHtml(notification.title)}</p>
          <h3>${escapeHtml(notification.listing?.title || 'Listing update')}</h3>
          <p class="dashboard-enquiry-meta">${new Date(notification.createdAt).toLocaleDateString()}</p>
        </div>
        <div class="dashboard-enquiry-status-wrap">
          <span class="dashboard-chip ${notification.isRead ? 'is-read' : 'is-unread'}">${notification.isRead ? 'Seen' : 'New'}</span>
          ${notification.isRead ? '' : `<button class="dashboard-action-button" onclick="markNotificationRead('${notification._id}')">Mark as read</button>`}
        </div>
      </div>
      <p class="dashboard-enquiry-message">${escapeHtml(notification.message)}</p>
    </article>
  `).join('');
}

function renderApprovalChip(status) {
  const normalizedStatus = status || 'pending';
  const label = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
  return `<div class="dashboard-chip is-status-${normalizedStatus}">${label}</div>`;
}

function populateListingForm(listing) {
  editingListingId = listing._id;
  document.getElementById('post-form-title').textContent = 'Edit Listing';
  document.getElementById('post-submit-button').textContent = 'Save Changes';
  document.getElementById('post-title').value = listing.title || '';
  document.getElementById('post-type').value = listing.type || 'pg';
  document.getElementById('post-city').value = listing.city || '';
  document.getElementById('post-address').value = listing.address || '';
  document.getElementById('post-contact').value = listing.contact || '';
  document.getElementById('post-price').value = listing.price || '';
  document.getElementById('post-gender').value = listing.gender || 'any';
  document.getElementById('post-description').value = listing.description || '';
  document.getElementById('post-amenities').value = Array.isArray(listing.amenities) ? listing.amenities.join(', ') : '';
  document.getElementById('post-available').checked = Boolean(listing.available);
  document.getElementById('post-featured').checked = Boolean(listing.is_featured);
  document.getElementById('post-photos').value = '';
  document.getElementById('post-error').textContent = '';
}

function openCreateListingForm() {
  resetListingForm();
  showPage('post');
}

async function openEditListingForm(listingId) {
  try {
    const listing = await apiFetchJson(`/api/listings/${listingId}`);
    populateListingForm(listing);
    showPage('post', { skipReset: true });
  } catch (err) {
    alert(err.message || 'Unable to load this listing.');
    return;
  }
}

async function loadFeaturedListings() {
  const featuredGrid = document.getElementById('featured-grid');
  if (!featuredGrid) return;

  featuredGrid.innerHTML = '<div class="featured-empty">Loading featured listings...</div>';

  try {
    const listings = await apiFetchJson('/api/listings?featured=true&limit=6');

    if (!Array.isArray(listings) || listings.length === 0) {
      featuredGrid.innerHTML = '<div class="featured-empty">No featured listings yet. Add <code>is_featured: true</code> to a listing to highlight it here.</div>';
      return;
    }

    featuredGrid.innerHTML = listings.map((listing) => `
      <article class="featured-card featured-card--hero" data-id="${listing._id}">
        <div class="featured-image-wrap">
          <div class="featured-card-badge-row">
            <span class="featured-card-badge">Verified</span>
          </div>
          ${renderWishlistHeart(listing._id, { source: 'featured' })}
          ${renderListingImage(listing, listing.title)}
        </div>
        <div class="featured-card-body">
          <div class="featured-meta-row">
            <p class="featured-location">${listing.city}</p>
            <span class="featured-rating-pill">Easy view</span>
          </div>
          <h3 class="featured-title">${listing.title}</h3>
          <p class="featured-address featured-description">${listing.address}</p>
          <div class="featured-card-footer">
            <div class="featured-price">Rs ${Number(listing.price).toLocaleString()}/month</div>
            <div class="featured-card-actions">
              ${renderWhatsAppButton(listing)}
              <button class="featured-view-button" onclick="showDetail('${listing._id}')">See Details</button>
            </div>
          </div>
        </div>
      </article>
    `).join('');
    applyWishlistStateToButtons();
  } catch (err) {
    featuredGrid.innerHTML = '<div class="featured-empty">Unable to load featured listings right now.</div>';
  }
}

function renderPopularLocations() {
  const grid = document.getElementById('popular-locations-grid');
  if (!grid) return;

  grid.innerHTML = HOME_LOCATIONS.map((location) => `
    <article class="location-card" onclick="applyPopularLocation('${escapeHtml(location.area)}')">
      <img src="${location.image}" alt="PG rooms in ${escapeHtml(location.area)} ${escapeHtml(location.city)}" loading="lazy" decoding="async">
      <div class="location-card-overlay"></div>
      <div class="location-card-copy">
        <span class="location-card-city">${escapeHtml(location.city)}</span>
        <h3 class="location-card-name">${escapeHtml(location.area)}</h3>
        <span class="location-card-count">${escapeHtml(location.count)}</span>
      </div>
    </article>
  `).join('');
}

function renderHomeReviews() {
  if (!HOME_REVIEWS) return;

  if (!HOME_REVIEW_ITEMS.length) {
    HOME_REVIEWS.innerHTML = '<p class="home-reviews-placeholder">Be the first to share your experience!</p>';
    return;
  }

  HOME_REVIEWS.innerHTML = HOME_REVIEW_ITEMS.map((review) => `
    <article class="home-review-card">
      <div class="home-review-stars">★★★★★</div>
      <p class="home-review-quote">"${escapeHtml(review.quote)}"</p>
      <div class="home-review-author">${escapeHtml(review.name)}</div>
      <div class="home-review-meta">${escapeHtml(review.meta)}</div>
    </article>
  `).join('');
}

function applyPopularLocation(area) {
  syncLocationInputs(area);
  showPage('listings');
}

let currentListingsPage = 1;
const LISTINGS_PER_PAGE = 12;

function buildListingsQuery(page) {
  const city     = document.getElementById('filter-city').value;
  const type     = document.getElementById('filter-type').value;
  const gender   = document.getElementById('filter-gender').value;
  const minPrice = document.getElementById('filter-min').value;
  const maxPrice = document.getElementById('filter-max').value;
  const sort     = document.getElementById('filter-sort').value;

  const query = new URLSearchParams();
  if (city)     query.append('city', city);
  if (type)     query.append('type', type);
  if (gender)   query.append('gender', gender);
  if (minPrice) query.append('minPrice', minPrice);
  if (maxPrice) query.append('maxPrice', maxPrice);
  if (sort)     query.append('sort', sort);
  query.append('page',  page);
  query.append('limit', LISTINGS_PER_PAGE);
  return query;
}

function buildNearbyListingsQuery(page) {
  const query = buildListingsQuery(page);
  query.append('lat', nearbySearchState.lat);
  query.append('lng', nearbySearchState.lng);
  query.append('radiusKm', nearbySearchState.radiusKm);
  return query;
}

function updateNearbyResultsBanner(total = null, radiusKm = null) {
  const banner = document.getElementById('nearby-results-banner');
  const title = document.getElementById('nearby-results-title');
  const copy = document.getElementById('nearby-results-copy');
  if (!banner || !title || !copy) return;

  if (!nearbySearchState.active) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';
  title.textContent = 'Showing stays near you';

  if (typeof total === 'number') {
    const safeRadius = radiusKm || nearbySearchState.radiusKm;
    copy.textContent = `${total} nearby listing${total === 1 ? '' : 's'} found within ${safeRadius} km.`;
  } else {
    copy.textContent = 'Nearby listings are sorted by distance from your location.';
  }
}

function clearNearMeSearch() {
  nearbySearchState = {
    active: false,
    lat: null,
    lng: null,
    radiusKm: 10
  };
  updateNearbyResultsBanner();
  currentListingsPage = 1;
  loadListings();
}

function toggleBrowseFilters() {
  const panel = document.getElementById('browse-filters');
  const btn = document.getElementById('filter-toggle-btn');
  const open = panel.classList.toggle('open');
  btn.classList.toggle('active', open);
}

function selectChip(el, filterType) {
  const chips = document.querySelectorAll(`.filter-chip[data-filter="${filterType}"]`);
  chips.forEach(c => c.classList.remove('active'));
  el.classList.add('active');

  const value = el.dataset.value;

  if (filterType === 'type') {
    document.getElementById('filter-type').value = value;
  } else if (filterType === 'gender') {
    document.getElementById('filter-gender').value = value;
  } else if (filterType === 'sort') {
    document.getElementById('filter-sort').value = value;
  } else if (filterType === 'budget') {
    if (value === '') {
      document.getElementById('filter-min').value = '';
      document.getElementById('filter-max').value = '';
    } else if (value === '5000') {
      document.getElementById('filter-min').value = '';
      document.getElementById('filter-max').value = '5000';
    } else if (value === '10000') {
      document.getElementById('filter-min').value = '5000';
      document.getElementById('filter-max').value = '10000';
    } else if (value === '99999') {
      document.getElementById('filter-min').value = '10000';
      document.getElementById('filter-max').value = '';
    }
  }

  loadListings();
}

function renderPagination(currentPage, totalPages) {
  if (totalPages <= 1) return '';

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    const active = i === currentPage ? 'pagination-btn--active' : '';
    pages.push(`<button class="pagination-btn ${active}" onclick="goToListingsPage(${i})">${i}</button>`);
  }

  return `
    <div class="pagination">
      <button class="pagination-btn" onclick="goToListingsPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&#8592; Prev</button>
      ${pages.join('')}
      <button class="pagination-btn" onclick="goToListingsPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next &#8594;</button>
    </div>`;
}

async function goToListingsPage(page) {
  currentListingsPage = page;
  await loadListings();
  document.getElementById('page-listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadOwnerDashboard() {
  return loadOwnerDashboardImpl();
}

function renderListingsMarkup(listings) {
  return listings.map((listing) => renderListingCard(listing)).join('');
}

async function loadListings() {
  const query = nearbySearchState.active
    ? buildNearbyListingsQuery(currentListingsPage)
    : buildListingsQuery(currentListingsPage);
  const endpoint = nearbySearchState.active ? '/api/listings/nearby' : '/api/listings';
  const grid = document.getElementById('listings-grid');
  let paginationEl = document.getElementById('listings-pagination');

  if (!paginationEl) {
    paginationEl = document.createElement('div');
    paginationEl.id = 'listings-pagination';
    grid.insertAdjacentElement('afterend', paginationEl);
  }

  grid.innerHTML = '<p style="padding:20px;color:#888">Loading...</p>';
  paginationEl.innerHTML = '';
  updateNearbyResultsBanner();

  try {
    const data = await apiFetchJson(`${endpoint}?${query.toString()}`);
    const listings = Array.isArray(data) ? data : data.listings;
    const totalPages = data.totalPages || 1;
    const total = Array.isArray(data) ? listings.length : Number(data.total || listings.length);

    if (!Array.isArray(listings) || listings.length === 0) {
      updateNearbyResultsBanner(0, data.radiusKm);
      grid.innerHTML = `<p style="padding:20px;color:#888">${nearbySearchState.active ? 'No nearby listings found for this location.' : 'No listings found.'}</p>`;
      return;
    }

    grid.innerHTML = renderListingsMarkup(listings);
    applyWishlistStateToButtons();
    updateNearbyResultsBanner(total, data.radiusKm);
    paginationEl.innerHTML = renderPagination(currentListingsPage, totalPages);
  } catch (err) {
    updateNearbyResultsBanner();
    grid.innerHTML = `<p style="padding:20px;color:#c0392b">${err.message || 'Unable to load listings.'}</p>`;
  }
}

async function loadOwnerDashboardImpl() {
  const user = getUser();
  const dashboardList = document.getElementById('dashboard-listings');
  if (!user || user.role !== 'owner' || !dashboardList) return;

  dashboardList.innerHTML = '<div class="dashboard-empty">Loading your listings...</div>';
  const enquiryList = document.getElementById('dashboard-enquiries-list');
  const notificationList = document.getElementById('dashboard-notifications-list');
  if (enquiryList) {
    enquiryList.innerHTML = '<div class="dashboard-empty">Loading enquiries...</div>';
  }
  if (notificationList) {
    notificationList.innerHTML = '<div class="dashboard-empty">Loading notifications...</div>';
  }

  try {
    const headers = { Authorization: `Bearer ${getToken()}` };
    const [listingData, enquiryData, notificationData] = await Promise.all([
      apiFetchJson('/api/listings/mine', { headers }),
      apiFetchJson('/api/enquiries/owner', { headers }),
      apiFetchJson('/api/notifications/mine', { headers })
    ]);

    document.getElementById('dashboard-total-listings').textContent = listingData.summary.totalListings;
    document.getElementById('dashboard-total-enquiries').textContent = enquiryData.summary.totalEnquiries;
    const unreadNode = document.getElementById('dashboard-unread-enquiries');
    if (unreadNode) unreadNode.textContent = enquiryData.summary.unreadEnquiries;

    renderOwnerNotifications(notificationData.notifications);
    renderDashboardEnquiries(enquiryData.enquiries, enquiryData.summary.unreadEnquiries);

    if (!Array.isArray(listingData.listings) || listingData.listings.length === 0) {
      dashboardList.innerHTML = `
        <div class="dashboard-empty">
          You have not added any listings yet.
          <button class="dashboard-empty-button" onclick="openCreateListingForm()">Add your first listing</button>
        </div>
      `;
      return;
    }

    dashboardList.innerHTML = listingData.listings.map((listing) => `
      <article class="dashboard-listing-card">
        <div class="dashboard-listing-main">
          <div class="dashboard-listing-copy">
            <h3>${safeText(listing.title, { fallback: 'Untitled listing', minLength: 3, maxLength: 50 })}</h3>
            <p>${safeText([listing.address, listing.city].filter(Boolean).join(', '), { fallback: 'Location details unavailable', minLength: 3, maxLength: 60 })}</p>
            ${listing.rejectionNote ? `<p class="dashboard-status-note">Rejection note: ${escapeHtml(listing.rejectionNote)}</p>` : ''}
          </div>
          <div class="dashboard-listing-metrics">
            <div class="dashboard-chip ${listing.available ? 'is-active' : 'is-inactive'}">
              ${listing.available ? 'Active' : 'Unavailable'}
            </div>
            ${renderApprovalChip(listing.approvalStatus)}
            ${listing.is_featured ? '<div class="dashboard-chip is-featured">Featured</div>' : ''}
            <div class="dashboard-enquiries">${Number(listing.enquiryCount || 0)} enquiries</div>
          </div>
        </div>
        <div class="dashboard-listing-actions">
          <button class="dashboard-action-button" onclick="openEditListingForm('${listing._id}')">Edit</button>
          <button class="dashboard-action-button is-danger" onclick="deleteListing('${listing._id}')">Delete</button>
        </div>
      </article>
    `).join('');

  } catch (err) {
    dashboardList.innerHTML = '<div class="dashboard-empty">Unable to load your dashboard right now.</div>';
    if (enquiryList) {
      enquiryList.innerHTML = '<div class="dashboard-empty">Unable to load enquiries right now.</div>';
    }
    if (notificationList) {
      notificationList.innerHTML = '<div class="dashboard-empty">Unable to load notifications right now.</div>';
    }
  }
}

async function showDetail(id) {
  try {
    const listing = await apiFetchJson(`/api/listings/${id}`);
    selectedReviewRating = 0;
    const detailTitle = getSafeListingTitle(listing.title);
    const detailLocation = getSafeListingLocation([listing.address, listing.city], 'Location details unavailable');
    const detailAmenities = normalizeListingTags(listing.amenities);
    const detailRatingValue = Number(listing.averageRating);
    const detailReviewCount = Math.max(0, Number(listing.reviewCount || 0));
    const detailRating = Number.isFinite(detailRatingValue) && detailRatingValue > 0
      ? `⭐ ${detailRatingValue.toFixed(1)} (${detailReviewCount})`
      : '⭐ New listing';
    const detailRent = formatListingPriceDisplay(listing.price);
    const rawDeposit = Number(listing.deposit ?? listing.securityDeposit ?? 0);
    const detailDeposit = Number.isFinite(rawDeposit) && rawDeposit > 0
      ? `₹${rawDeposit.toLocaleString('en-IN')}`
      : 'Not specified';
    const detailAvailability = listing.available === false ? 'Unavailable' : 'Available now';
    const ownerName = getSafeListingText(listing.owner?.name, { fallback: 'Verified owner', minLength: 2, maxLength: 50 });
    const ownerPhone = getSafeListingText(listing.contact || listing.owner?.phone || listing.owner?.mobile, { fallback: 'Shared after contact', minLength: 6, allowShort: true, maxLength: 20 });
    const amenityIconFor = (amenity) => {
      const key = String(amenity || '').toLowerCase();
      if (key.includes('wifi') || key.includes('wi-fi') || key.includes('internet')) return '📶';
      if (key.includes('bed') || key.includes('room')) return '🛏️';
      if (key.includes('water')) return '💧';
      return '✓';
    };

    document.getElementById('detail-content').innerHTML = `
    <section class="detail-hero-media">
      ${renderPhotoCarousel(listing.photos)}
    </section>
    <div class="detail-info detail-trust-layout">
      <div class="detail-summary" id="detail-summary">
        <div class="detail-headline-row">
          <h1>${escapeHtml(detailTitle)}</h1>
          <div class="detail-headline-price" title="${escapeHtml(detailRent)}">${escapeHtml(detailRent)}</div>
        </div>
        <div class="detail-location-rating">
          <span class="detail-location-pill">📍 ${escapeHtml(detailLocation)}</span>
          <span class="detail-rating-pill">${escapeHtml(detailRating)}</span>
        </div>

        <div class="detail-key-info" aria-label="Key information">
          <article class="detail-key-info-card">
            <p>Rent</p>
            <strong>${escapeHtml(detailRent)}</strong>
          </article>
          <article class="detail-key-info-card">
            <p>Deposit</p>
            <strong>${escapeHtml(detailDeposit)}</strong>
          </article>
          <article class="detail-key-info-card">
            <p>Availability</p>
            <strong>${escapeHtml(detailAvailability)}</strong>
          </article>
        </div>

        ${(detailAmenities.length > 0) ? `
          <div class="detail-amenities" aria-label="Amenities">
            ${detailAmenities.slice(0, 8).map((amenity) => `
              <span class="detail-amenity-pill" title="${escapeHtml(amenity)}">
                <span class="detail-amenity-icon" aria-hidden="true">${amenityIconFor(amenity)}</span>
                <span class="detail-amenity-text">${escapeHtml(amenity)}</span>
              </span>
            `).join('')}
          </div>
        ` : `
          <div class="detail-amenities" aria-label="Amenities">
            <span class="detail-amenity-pill"><span class="detail-amenity-icon" aria-hidden="true">📶</span><span class="detail-amenity-text">WiFi</span></span>
            <span class="detail-amenity-pill"><span class="detail-amenity-icon" aria-hidden="true">🛏️</span><span class="detail-amenity-text">Bed</span></span>
            <span class="detail-amenity-pill"><span class="detail-amenity-icon" aria-hidden="true">💧</span><span class="detail-amenity-text">Water</span></span>
          </div>
        `}

        <section class="detail-owner-trust" aria-label="Owner details">
          <div class="detail-owner-trust-head">
            <h3>Owner</h3>
            <span class="detail-verified-badge">Verified</span>
          </div>
          <p class="detail-owner-name">${escapeHtml(ownerName)}</p>
          <p class="detail-owner-contact">${escapeHtml(ownerPhone)}</p>
        </section>
      </div>

      <div class="detail-side-actions">
        ${renderWishlistButton(listing, { detail: true })}
        ${renderOwnerListingActions(listing, { detail: true })}
        <button onclick="showPage('listings')" class="back-button">Back</button>
      </div>

      ${renderMapSection(listing)}

      <div class="distance-card">
        <h3 class="distance-title">How far is this from your place?</h3>
        <p class="distance-subtitle">Enter your college or workplace to see commute time</p>
        <div class="distance-form">
          <input
            type="text"
            id="distance-input"
            placeholder="e.g. bengaluru University, Bengaluru"
            class="distance-input"
          >
          <button
            id="distance-btn"
            onclick="calculateDistance('${listing._id}')"
            class="distance-button"
          >
            Calculate
          </button>
        </div>
        <div id="distance-result"></div>
      </div>

      <section id="reviews-section" class="reviews-section">
        <div class="reviews-loading">Loading reviews...</div>
      </section>
    </div>
    ${renderStickyListingCta(listing)}
  `;

    initializeDetailCarousels(document.getElementById('detail-content'));
    loadReviews(id);
    showPage('detail', { updateHistory: true });
  } catch (err) {
    alert(err.message || 'Unable to load the listing.');
  }
}

function closeActiveCarouselModal() {
  const modal = document.querySelector('.carousel-modal.is-open');
  if (!modal) return false;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  return true;
}

function getActiveCarouselRoot() {
  const modal = document.querySelector('.carousel-modal.is-open');
  return modal ? modal.closest('.detail-photos') : null;
}

function renderPhotoCarousel(photos) {
  if (!photos || photos.length === 0) {
    return '<div class="no-image detail-no-image">No photo available</div>';
  }

  const slides = photos.map((src, i) => `
    <div class="carousel-slide ${i === 0 ? 'is-active' : ''}" data-index="${i}">
      <img src="${src}" alt="Listing photo ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" onclick="openCarouselModal(this, ${i})">
    </div>`).join('');

  const dots = photos.length > 1
    ? `<div class="carousel-dots">
        ${photos.map((_, i) => `<button class="carousel-dot ${i === 0 ? 'is-active' : ''}" aria-label="Photo ${i + 1}" onclick="carouselGoTo(this,${i})"></button>`).join('')}
       </div>`
    : '';

  const arrows = photos.length > 1
    ? `<button class="carousel-arrow carousel-arrow--prev" aria-label="Previous photo" onclick="carouselStep(this,-1)">&#10094;</button>
       <button class="carousel-arrow carousel-arrow--next" aria-label="Next photo" onclick="carouselStep(this,1)">&#10095;</button>`
    : '';

  const thumbs = photos.length > 1
    ? `<div class="carousel-thumbs">
        ${photos.map((src, i) => `<img src="${src}" class="carousel-thumb ${i === 0 ? 'is-active' : ''}" alt="Thumbnail ${i + 1}" loading="lazy" decoding="async" onclick="carouselGoTo(this,${i})">`).join('')}
       </div>`
    : '';

  const modalDots = photos.length > 1
    ? `<div class="carousel-modal-dots">
        ${photos.map((_, i) => `<button class="carousel-modal-dot ${i === 0 ? 'is-active' : ''}" aria-label="Open photo ${i + 1}" onclick="carouselModalGoTo(this,${i})"></button>`).join('')}
      </div>`
    : '';

  return `
    <div class="carousel" data-current="0" tabindex="0" onkeydown="carouselKey(event, this)">
      <div class="carousel-track">${slides}</div>
      ${arrows}
      ${dots}
      <button type="button" class="carousel-open-viewer" aria-label="Open fullscreen gallery" onclick="openCarouselModal(this, carouselCurrentIndex(carouselRoot(this)))">View Fullscreen</button>
    </div>
    ${thumbs}
    <div class="carousel-modal" aria-hidden="true" onclick="closeCarouselModal(event)">
      <button class="carousel-modal-close" type="button" aria-label="Close fullscreen gallery" onclick="closeCarouselModal(event)">&times;</button>
      <div class="carousel-modal-stage">
        ${photos.length > 1 ? `<button class="carousel-arrow carousel-arrow--prev carousel-modal-arrow" type="button" aria-label="Previous photo" onclick="carouselStep(this,-1)">&#10094;</button>` : ''}
        <img class="carousel-modal-image" src="${photos[0]}" alt="Fullscreen listing photo" decoding="async">
        ${photos.length > 1 ? `<button class="carousel-arrow carousel-arrow--next carousel-modal-arrow" type="button" aria-label="Next photo" onclick="carouselStep(this,1)">&#10095;</button>` : ''}
      </div>
      <div class="carousel-modal-footer">
        <div class="carousel-modal-counter">1 / ${photos.length}</div>
        ${modalDots}
      </div>
    </div>`;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  savedListingIds = getStoredWishlistIds();
  applyWishlistStateToButtons();
  editingListingId = null;
  resetListingForm();
  resetAuthFlow();
  updateNav();
  closeMenu();
  showPage('home');
}

async function saveListing() {
  console.log('[listing] saveListing called', { editingListingId });
  const user = getUser();
  const errorField = document.getElementById('post-error');
  const submitButton = document.getElementById('post-submit-button');
  if (!user) {
    console.warn('[listing] save blocked: user not logged in');
    showPage('login');
    return;
  }

  if (user.role !== 'owner') {
    console.warn('[listing] save blocked: non-owner user', user);
    errorField.textContent = 'Only owners can post listings.';
    return;
  }

  errorField.textContent = '';

  const titleInput = document.getElementById('post-title');
  const typeInput = document.getElementById('post-type');
  const cityInput = document.getElementById('post-city');
  const addressInput = document.getElementById('post-address');
  const contactInput = document.getElementById('post-contact');
  const latInput = document.getElementById('post-lat');
  const lngInput = document.getElementById('post-lng');
  const priceInput = document.getElementById('post-price');
  const genderInput = document.getElementById('post-gender');
  const descriptionInput = document.getElementById('post-description');
  const availableInput = document.getElementById('post-available');
  const featuredInput = document.getElementById('post-featured');
  const amenitiesInput = document.getElementById('post-amenities');
  const photosInput = document.getElementById('post-photos');

  const title = titleInput?.value?.trim() || '';
  const type = typeInput?.value || 'pg';
  const city = cityInput?.value?.trim() || '';
  const address = addressInput?.value?.trim() || '';
  const contact = contactInput?.value?.trim() || '';
  const lat = latInput?.value?.trim() || '';
  const lng = lngInput?.value?.trim() || '';
  const price = priceInput?.value?.trim() || '';
  const gender = genderInput?.value || 'any';
  const description = descriptionInput?.value?.trim() || '';
  const available = Boolean(availableInput?.checked);
  const isFeatured = Boolean(featuredInput?.checked);

  if (!title || !city || !address || !price) {
    errorField.textContent = 'Title, city, address, and monthly rent are required.';
    console.warn('[listing] save blocked: missing required fields', { title, city, address, price });
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('type', type);
  formData.append('city', city);
  formData.append('address', address);
  formData.append('contact', contact);
  formData.append('lat', lat);
  formData.append('lng', lng);
  formData.append('price', price);
  formData.append('gender', gender);
  formData.append('description', description);
  formData.append('available', String(available));
  formData.append('is_featured', String(isFeatured));

  const amenities = (amenitiesInput?.value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  amenities.forEach((amenity) => formData.append('amenities', amenity));

  const photos = photosInput?.files || [];
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024;

  if (photos.length > 10) {
    errorField.textContent = 'You can upload a maximum of 10 photos.';
    return;
  }
  for (const photo of photos) {
    if (!ALLOWED_TYPES.includes(photo.type)) {
      errorField.textContent = `"${photo.name}" is not a supported type. Use JPG, PNG or WebP.`;
      return;
    }
    if (photo.size > MAX_SIZE) {
      errorField.textContent = `"${photo.name}" exceeds the 5 MB limit.`;
      return;
    }
    formData.append('photos', photo);
  }

  const isEditing = Boolean(editingListingId);
  const endpoint = isEditing ? `/api/listings/${editingListingId}` : '/api/listings';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    if (submitButton) submitButton.disabled = true;
    console.log('[listing] submitting request', {
      endpoint,
      method,
      title,
      type,
      city,
      address,
      hasToken: Boolean(getToken()),
      photoCount: photos.length
    });

    await apiFetchJson(endpoint, {
      method,
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    });

    alert(isEditing ? 'Listing updated successfully!' : 'Listing submitted for admin review.');
    resetListingForm();
    showPage('dashboard');
  } catch (err) {
    console.error('[listing] save failed', err);
    errorField.textContent = err.message || 'Unable to save listing.';
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function deleteListing(listingId, options = {}) {
  const confirmed = window.confirm('Delete this listing? This action cannot be undone.');
  if (!confirmed) return;

  try {
    await apiFetchJson(`/api/listings/${listingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
  } catch (err) {
    alert(err.message || 'Unable to delete listing.');
    return;
  }

  if (editingListingId === listingId) {
    resetListingForm();
  }

  const listingCard = document.getElementById(`listing-card-${listingId}`);
  if (listingCard) {
    listingCard.remove();
    const listingsGrid = document.getElementById('listings-grid');
    if (listingsGrid && !listingsGrid.querySelector('.listing-card')) {
      listingsGrid.innerHTML = '<p style="padding:20px;color:#888">No listings found.</p>';
    }
  }

  if (options.source === 'detail') {
    showPage('listings');
    return;
  }

  loadFeaturedListings();
  loadOwnerDashboard();
}

async function calculateDistance(listingId, listingAddress, listingCity) {
  const from = document.getElementById('distance-input').value.trim();
  if (!from) { alert('Please enter your college or workplace address!'); return; }

  const button = document.getElementById('distance-btn');
  button.textContent = 'Calculating...';
  button.disabled = true;

  try {
    const data = await apiFetchJson(`/api/listings/${listingId}/distance?from=${encodeURIComponent(from)}`);
    const km = parseFloat(data.distanceKm);
    const bike = Math.round((km / 25) * 60);
    const walk = Math.round((km / 5) * 60);
    const auto = Math.round((km / 15) * 60);
    const car  =  Math.round((km / 40) * 60);

    const data2 = await apiFetchJson(`/api/listings/${listingId}`);
    const toAddress = encodeURIComponent(`${data2.address}, ${data2.city}, India`);
    const fromAddress = encodeURIComponent(from);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${fromAddress}&destination=${toAddress}&travelmode=two-wheeler`;
    document.getElementById('distance-result').innerHTML = `
      <div class="distance-result-card">
        <div class="distance-km">${data.distanceKm} km away</div>
        <div class="distance-modes">
          <span class="distance-mode-pill">🚲 Bike ~${bike} min</span>
          <span class="distance-mode-pill">🚶 Walk ~${walk} min</span>
          <span class="distance-mode-pill">🛺 Auto ~${auto} min</span>
        </div>
        <a class="distance-maps-btn" href="${mapsUrl}" target="_blank" rel="noopener">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          Open in Google Maps
        </a>
      </div>`;
  } catch (err) {
    document.getElementById('distance-result').innerHTML = `<p style="color:red;margin-top:12px;">${err.message || 'Could not calculate distance'}</p>`;
  }

  button.textContent = 'Calculate';
  button.disabled = false;
}

async function submitEnquiry(listingId) {
  const user = getUser();
  const feedbackField = document.getElementById('enquiry-feedback');
  const nameField = document.getElementById('enquiry-name');
  const emailField = document.getElementById('enquiry-email');
  const messageField = document.getElementById('enquiry-message');

  if (!feedbackField || !nameField || !emailField || !messageField) return;

  const name = nameField.value.trim();
  const email = emailField.value.trim();
  const message = messageField.value.trim();

  feedbackField.textContent = '';
  feedbackField.className = 'review-message';

  if (!user || user.role !== 'tenant') {
    feedbackField.textContent = 'Please login as a tenant to send an enquiry.';
    feedbackField.className = 'review-message review-message-error';
    return;
  }

  if (!name || !email || !message) {
    feedbackField.textContent = 'Name, email, and message are required.';
    feedbackField.className = 'review-message review-message-error';
    return;
  }

  try {
    await apiFetchJson('/api/enquiries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ listingId, name, email, message })
    });

    messageField.value = '';
    feedbackField.textContent = 'Your enquiry has been sent to the owner.';
    feedbackField.className = 'review-message review-message-success';
  } catch (err) {
    feedbackField.textContent = err.message || 'Unable to send enquiry right now.';
    feedbackField.className = 'review-message review-message-error';
  }
}

async function toggleEnquiryRead(enquiryId, isRead) {
  try {
    await apiFetchJson(`/api/enquiries/${enquiryId}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ isRead })
    });

    loadOwnerDashboard();
  } catch (err) {
    alert(err.message || 'Unable to update enquiry status.');
  }
}

async function markNotificationRead(notificationId) {
  try {
    await apiFetchJson(`/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    loadOwnerDashboard();
  } catch (err) {
    alert(err.message || 'Unable to update notification.');
  }
}

async function loadAdminPanel(status = null) {
  const user = getUser();
  const adminList = document.getElementById('admin-listings');
  const adminLog = document.getElementById('admin-action-log');
  if (!user || user.role !== 'admin' || !adminList || !adminLog) return;

  const activeFilter = status || document.querySelector('.admin-filter-button.is-active')?.dataset.adminFilter || 'pending';
  adminList.innerHTML = '<div class="dashboard-empty">Loading listings...</div>';
  adminLog.innerHTML = '<div class="dashboard-empty">Loading admin activity...</div>';

  document.querySelectorAll('.admin-filter-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.adminFilter === activeFilter);
  });

  try {
    const data = await apiFetchJson(`/api/admin/listings?status=${encodeURIComponent(activeFilter)}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    document.getElementById('admin-count-all').textContent = data.counts.all;
    document.getElementById('admin-count-pending').textContent = data.counts.pending;
    document.getElementById('admin-count-approved').textContent = data.counts.approved;
    document.getElementById('admin-count-rejected').textContent = data.counts.rejected;

    const listings = Array.isArray(data.listings) ? data.listings : [];
    if (listings.length === 0) {
      adminList.innerHTML = '<div class="dashboard-empty">No listings match this filter right now.</div>';
    } else {
      adminList.innerHTML = listings.map((listing) => `
        <article class="dashboard-listing-card">
          <div class="dashboard-listing-main">
            <div class="dashboard-listing-copy">
              <h3>${escapeHtml(listing.title)}</h3>
              <p>Owner: ${escapeHtml(listing.owner?.name || 'Unknown owner')}</p>
              <p>Submitted: ${new Date(listing.createdAt).toLocaleDateString()}</p>
              ${listing.rejectionNote ? `<p class="dashboard-status-note">Rejection note: ${escapeHtml(listing.rejectionNote)}</p>` : ''}
            </div>
            <div class="dashboard-listing-metrics">
              ${renderApprovalChip(listing.approvalStatus)}
            </div>
          </div>
          <div class="dashboard-listing-actions">
            <button class="dashboard-action-button admin-approve-button" onclick="reviewListing('${listing._id}', 'approve')">Approve</button>
            <button class="dashboard-action-button is-danger" onclick="reviewListing('${listing._id}', 'reject')">Reject</button>
          </div>
        </article>
      `).join('');
    }

    const logs = Array.isArray(data.logs) ? data.logs : [];
    if (logs.length === 0) {
      adminLog.innerHTML = '<div class="dashboard-empty">No admin actions logged yet.</div>';
    } else {
      adminLog.innerHTML = logs.map((log) => `
        <article class="dashboard-enquiry-card">
          <div class="dashboard-enquiry-top">
            <div>
              <p class="dashboard-enquiry-listing">${escapeHtml(log.action)}</p>
              <h3>${escapeHtml(log.listing?.title || 'Listing')}</h3>
              <p class="dashboard-enquiry-meta">
                ${escapeHtml(log.admin?.name || 'Admin')} · ${new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <p class="dashboard-enquiry-message">
            ${escapeHtml(log.owner?.name || 'Owner')} was ${escapeHtml(log.action)}.${log.note ? ` Note: ${escapeHtml(log.note)}` : ''}
          </p>
        </article>
      `).join('');
    }
  } catch (err) {
    adminList.innerHTML = '<div class="dashboard-empty">Unable to load admin listings right now.</div>';
    adminLog.innerHTML = '<div class="dashboard-empty">Unable to load admin activity right now.</div>';
  }
}

async function reviewListing(listingId, action) {
  const note = action === 'reject'
    ? window.prompt('Add a rejection note for the owner:', '') ?? ''
    : '';

  if (action === 'reject' && !note.trim()) {
    alert('Please add a rejection note so the owner knows what to fix.');
    return;
  }

  try {
    await apiFetchJson(`/api/admin/listings/${listingId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ action, note })
    });

    loadAdminPanel();
  } catch (err) {
    alert(err.message || 'Unable to review listing right now.');
  }
}

async function loadReviews(listingId) {
  const container = document.getElementById('reviews-section');
  if (!container) return;

  container.innerHTML = '<div class="reviews-loading">Loading reviews...</div>';

  try {
    const data = await apiFetchJson(`/api/reviews?listingId=${encodeURIComponent(listingId)}`);

    const user = getUser();
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    const averageRating = Number(data.averageRating || 0);
    const totalReviews = Number(data.totalReviews || 0);

    container.innerHTML = `
      <div class="reviews-header">
        <div>
          <h2>Reviews & Ratings</h2>
          <p class="reviews-subtitle">Average score and feedback from people who stayed here.</p>
        </div>
        <div class="rating-summary">
          <div class="rating-value">${totalReviews ? averageRating.toFixed(1) : '0.0'}</div>
          <div class="rating-stars">${renderStars(averageRating)}</div>
          <div class="rating-count">${totalReviews} review${totalReviews === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div class="review-form-card">
        <h3>Write a Review</h3>
        <div class="review-form-grid">
          <div class="review-form-field">
            <label for="review-name">Name</label>
            <input
              id="review-name"
              class="review-input"
              type="text"
              value="${user ? user.name : ''}"
              placeholder="${user ? 'Your name' : 'Login required'}"
              ${user ? 'readonly' : 'disabled'}
            >
          </div>
          <div class="review-form-field">
            <label>Your Rating</label>
            <div class="review-stars" role="group" aria-label="Select a rating">
              ${[1, 2, 3, 4, 5].map((star) => `
                <button
                  type="button"
                  class="star-button ${selectedReviewRating >= star ? 'active' : ''}"
                  id="star-${star}"
                  onclick="setRating(${star})"
                  ${user ? '' : 'disabled'}
                >
                  ★
                </button>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="review-form-field">
          <label for="review-comment">Comment</label>
          <textarea
            id="review-comment"
            class="review-input review-textarea"
            placeholder="${user ? 'Share your honest experience with this property' : 'Login to add a comment'}"
            ${user ? '' : 'disabled'}
          ></textarea>
        </div>
        <button class="review-submit" onclick="submitReview('${listingId}')" ${user ? '' : 'disabled'}>
          Submit Review
        </button>
        <p id="review-error" class="review-message review-message-error"></p>
        ${user ? '' : '<p class="review-message">Login to submit a review and rating.</p>'}
      </div>

      <div class="reviews-list">
        ${reviews.length === 0
          ? '<div class="empty-reviews">No reviews yet. Be the first person to rate this listing.</div>'
          : reviews.map((review) => `
            <article class="review-card">
              <div class="review-card-top">
                <div>
                  <h4>${review.user?.name || 'Anonymous User'}</h4>
                  <p class="review-date">${new Date(review.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="review-rating">
                  <span class="review-rating-stars">${renderStars(review.rating)}</span>
                  <span>${review.rating}/5</span>
                </div>
              </div>
              <p class="review-comment">${review.comment}</p>
              ${user && review.user && review.user._id === user.id
                ? `<button class="review-delete" onclick="deleteReview('${review._id}', '${listingId}')">Delete Review</button>`
                : ''}
            </article>
          `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<div class="review-error-box">Unable to load reviews right now.</div>';
  }
}

function setRating(rating) {
  selectedReviewRating = rating;

  for (let star = 1; star <= 5; star += 1) {
    const starButton = document.getElementById(`star-${star}`);
    if (starButton) {
      starButton.classList.toggle('active', star <= rating);
    }
  }
}

async function submitReview(listingId) {
  const user = getUser();
  const nameField = document.getElementById('review-name');
  const commentField = document.getElementById('review-comment');
  const errorField = document.getElementById('review-error');

  if (!errorField) return;

  const name = nameField ? nameField.value.trim() : '';
  const comment = commentField ? commentField.value.trim() : '';
  const rating = selectedReviewRating;

  errorField.textContent = '';

  if (!user) {
    errorField.textContent = 'Please login before submitting a review.';
    return;
  }

  if (!name) {
    errorField.textContent = 'Name is required.';
    return;
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errorField.textContent = 'Please choose a rating from 1 to 5 stars.';
    return;
  }

  if (!comment) {
    errorField.textContent = 'Please enter a comment.';
    return;
  }

  try {
    await apiFetchJson('/api/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ listingId, rating, comment })
    });

    selectedReviewRating = 0;
    loadReviews(listingId);
  } catch (err) {
    errorField.textContent = err.message || 'Unable to submit review.';
  }
}

async function deleteReview(reviewId, listingId) {
  try {
    await apiFetchJson(`/api/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    loadReviews(listingId);
  } catch (err) {
    alert(err.message || 'Unable to delete review.');
  }
}

function bootFromPath() {
  const path = window.location.pathname;
  const locationQuery = new URLSearchParams(window.location.search).get('location')?.trim() || '';
  if (path === '/dashboard') {
    showPage('dashboard', { updateHistory: false, replaceHistory: true });
    return;
  }

  if (path === '/admin') {
    showPage('admin', { updateHistory: false, replaceHistory: true });
    return;
  }

  if (path === '/browse') {
    if (locationQuery) syncLocationInputs(locationQuery);
    showPage('browse', { updateHistory: false, replaceHistory: true });
    return;
  }

  if (path === '/search') {
    syncLocationInputs(locationQuery);
    nearbySearchState.active = false;
    updateNearbyResultsBanner();
    showPage('browse', { updateHistory: false, replaceHistory: true });
    return;
  }

  if (path === '/login') {
    showPage('login', { updateHistory: false, replaceHistory: true });
    return;
  }

  if (path === '/register') {
    showPage('login', { updateHistory: false, replaceHistory: true });
    return;
  }

  if (path === '/post') {
    showPage('post', { updateHistory: false, replaceHistory: true });
    return;
  }

  if (path === '/wishlist') {
    showPage('wishlist', { updateHistory: false, replaceHistory: true });
    return;
  }

  if (path === '/reset-password') {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      showPage('login', { updateHistory: false, replaceHistory: true });
      return;
    }
    // Store token so submitPasswordReset can read it
    window._resetToken = token;
    showPage('reset-password', { updateHistory: false, replaceHistory: true });
    return;
  }

  const _startPage = 'home';
  showPage(_startPage, { updateHistory: false, replaceHistory: true });
}

async function submitPasswordReset() {
  const password = document.getElementById('reset-password-input')?.value || '';
  const confirm  = document.getElementById('reset-password-confirm')?.value || '';
  const errorEl  = document.getElementById('reset-password-error');
  const msgEl    = document.getElementById('reset-password-message');
  const btn      = document.querySelector('#page-reset-password button');
  const token    = window._resetToken;

  if (errorEl) errorEl.textContent = '';
  if (msgEl)   { msgEl.style.display = 'none'; msgEl.textContent = ''; }

  if (!token) {
    if (errorEl) errorEl.textContent = 'Invalid or missing reset token. Please request a new link.';
    return;
  }
  if (!password) {
    if (errorEl) errorEl.textContent = 'Please enter a new password.';
    return;
  }
  if (password !== confirm) {
    if (errorEl) errorEl.textContent = 'Passwords do not match.';
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const res  = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    const data = await res.json();

    if (!res.ok) {
      if (errorEl) errorEl.textContent = data.message || 'Something went wrong.';
      return;
    }

    if (msgEl) {
      msgEl.textContent = 'Password reset! Redirecting to login...';
      msgEl.style.color = '#166534';
      msgEl.style.display = 'block';
    }
    window._resetToken = null;
    setTimeout(() => showPage('login', { updateHistory: true }), 2000);
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Something went wrong. Please try again.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  attachNavbarListeners();
  updateNav();
  resetListingForm();
  renderPopularLocations();
  renderHomeReviews();
  setupLocationAutocomplete('hero-search', 'hero-search-suggestions');
  setupLocationAutocomplete('filter-city', 'filter-city-suggestions');

  // Close profile dropdown when clicking outside of it
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('nav-user');
    if (wrap && !wrap.contains(e.target)) closeProfileMenu();
  });

  document.getElementById('filter-city')?.addEventListener('input', debounce(() => loadListings(), 400));

  const loginError = document.getElementById('login-error');
  document.querySelectorAll('.login-card input').forEach((input) => {
    input.addEventListener('input', () => {
      if (loginError) loginError.textContent = '';
    });
  });

  const passwordToggle = document.querySelector('.password-field span');
  if (passwordToggle) {
    passwordToggle.onclick = function () {
      const input = document.querySelector('.password-field input');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    };
  }

  bindLoginUiEvents();
  bindRegisterEvents();
  applyAuthModeState('phone');
  applyRoleToggleState();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeActiveCarouselModal();
      return;
    }

    const activeRoot = getActiveCarouselRoot();
    if (!activeRoot) return;

    if (event.key === 'ArrowLeft') {
      setCarouselIndex(activeRoot, carouselCurrentIndex(activeRoot) - 1);
    }

    if (event.key === 'ArrowRight') {
      setCarouselIndex(activeRoot, carouselCurrentIndex(activeRoot) + 1);
    }
  });

  resetAuthFlow();
  
  initWishlistEventDelegation();

  Promise.allSettled([loadAppConfig(), loadWishlistState()]).finally(() => {
    loadFeaturedListings();
    bootFromPath();
  });
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    closeMenu();
  }
});

window.addEventListener('popstate', () => {
  bootFromPath();
});
