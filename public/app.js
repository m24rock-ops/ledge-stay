const ROUTE_PATHS = {
  home: '/',
  browse: '/browse',
  listings: '/browse',
  detail: '/browse',
  wishlist: '/wishlist',
  login: '/login',
  register: '/register',
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
let appConfig = {
  mapsEmbedApiKey: ''
};
let nearbySearchState = {
  active: false,
  lat: null,
  lng: null,
  radiusKm: 10
};
const HOME_LOCATIONS = [
  {
    name: 'Koramangala',
    city: 'Bengaluru',
    count: '120+ stays',
    blurb: 'A well-known area with many student rooms and PG options.',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900&q=80'
  },
  {
    name: 'Hinjewadi',
    city: 'Pune',
    count: '90+ stays',
    blurb: 'Good for budget-friendly stays near colleges and work hubs.',
    image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&q=80'
  },
  {
    name: 'Navrangpura',
    city: 'Ahmedabad',
    count: '70+ stays',
    blurb: 'A student-friendly area with rooms, PGs, and shared flats.',
    image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=900&q=80'
  },
  {
    name: 'Guindy',
    city: 'Chennai',
    count: '85+ stays',
    blurb: 'Close to colleges, buses, and daily needs.',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900&q=80'
  }
];
const HOME_REVIEWS = [
  {
    name: 'Aarav S.',
    meta: 'Engineering student, Bengaluru',
    quote: 'I found a PG near college quickly. The price was clear and the room looked like the photos.'
  },
  {
    name: 'Nisha R.',
    meta: 'MBA student, Pune',
    quote: 'The site was easy to understand. I could compare places without opening too many pages.'
  },
  {
    name: 'Rahul P.',
    meta: 'Parent, Chennai',
    quote: 'As a parent, I liked that the listings were simple to read and easy to compare.'
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

  // Reset auth UI whenever switching between auth pages.
  if (normalizedPage === 'login') {
    const forgotSection = document.getElementById('forgot-password-section');
    const forgotMessage = document.getElementById('forgot-password-message');
    if (forgotSection) forgotSection.style.display = 'none';
    if (forgotMessage) {
      forgotMessage.style.display = 'none';
      forgotMessage.textContent = '';
    }

    const loginError = document.getElementById('login-error');
    if (loginError) loginError.textContent = '';

    const loginButton = document.querySelector('#page-login button[onclick="login()"]');
    if (loginButton) loginButton.style.display = '';
  }

  if (normalizedPage === 'register') {
    const regError = document.getElementById('reg-error');
    if (regError) regError.textContent = '';

    ['reg-name-error', 'reg-email-error', 'reg-password-error', 'reg-role-error'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
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
      document.getElementById('login-error').textContent = 'Please login as an owner to continue.';
      showPage('login', { updateHistory: true, replaceHistory: true });
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
      document.getElementById('login-error').textContent = 'Please login as a tenant to continue.';
      showPage('login', { updateHistory: true, replaceHistory: true });
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
      document.getElementById('login-error').textContent = 'Please login as an admin to continue.';
      showPage('login', { updateHistory: true, replaceHistory: true });
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

  if (wishlistLink) wishlistLink.style.display = user && user.role === 'tenant' ? 'inline-flex' : 'none';
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

function toggleMenu() {
  const navLinks = document.getElementById('nav-links');
  const toggleButton = document.querySelector('.menu-toggle');
  if (!navLinks || !toggleButton) return;

  const isOpen = navLinks.classList.toggle('open');
  toggleButton.classList.toggle('open', isOpen);
  toggleButton.setAttribute('aria-expanded', String(isOpen));
}

function closeMenu() {
  const navLinks = document.getElementById('nav-links');
  const toggleButton = document.querySelector('.menu-toggle');
  if (!navLinks || !toggleButton) return;

  navLinks.classList.remove('open');
  toggleButton.classList.remove('open');
  toggleButton.setAttribute('aria-expanded', 'false');
}

function heroSearch() {
  const city = document.getElementById('hero-search').value.trim();
  const budget = document.getElementById('hero-budget').value;
  syncLocationInputs(city);
  document.getElementById('filter-max').value = budget;
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
      <img src="${src}" alt="Listing photo ${i + 1}">
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
        ${photos.map((src, i) => `<img src="${src}" class="carousel-thumb ${i === 0 ? 'is-active' : ''}" alt="Thumb ${i + 1}" onclick="carouselGoTo(this,${i})">`).join('')}
       </div>`
    : '';

  return `
    <div class="carousel" data-current="0" tabindex="0"
         onkeydown="carouselKey(event, this)">
      <div class="carousel-track">${slides}</div>
      ${arrows}
      ${dots}
    </div>
    ${thumbs}`;
}

function carouselRoot(el) {
  return el.closest('.detail-photos');
}

function carouselGoTo(triggerEl, index) {
  const root = carouselRoot(triggerEl);
  const carousel = root.querySelector('.carousel');
  const slides   = carousel.querySelectorAll('.carousel-slide');
  const dots     = root.querySelectorAll('.carousel-dot');
  const thumbs   = root.querySelectorAll('.carousel-thumb');
  const total    = slides.length;
  const next     = ((index % total) + total) % total;

  carousel.dataset.current = next;
  slides.forEach((s, i) => s.classList.toggle('is-active', i === next));
  dots.forEach((d, i)    => d.classList.toggle('is-active', i === next));
  thumbs.forEach((t, i)  => t.classList.toggle('is-active', i === next));
}

function carouselStep(arrowEl, dir) {
  const carousel = arrowEl.closest('.carousel');
  const current  = parseInt(carousel.dataset.current || '0', 10);
  carouselGoTo(arrowEl, current + dir);
}

function carouselKey(event, carouselEl) {
  if (event.key === 'ArrowLeft')  carouselGoTo(carouselEl, parseInt(carouselEl.dataset.current || '0', 10) - 1);
  if (event.key === 'ArrowRight') carouselGoTo(carouselEl, parseInt(carouselEl.dataset.current || '0', 10) + 1);
}

// ────────────────────────────────────────────────────────────────────────────

function renderListingImage(listing, altText) {
  if (listing.photos && listing.photos.length > 0) {
    return `<img src="${listing.photos[0]}" alt="${altText}">`;
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

function renderWhatsAppButton(listing) {
  const contact = normalizePhoneForWhatsApp(listing.contact || listing.owner?.phone || listing.owner?.mobile || '');
  if (!contact) return '';

  const url = `https://wa.me/${encodeURIComponent(contact)}`;
  return `<a href="${url}" target="_blank" rel="noopener" class="btn btn-whatsapp" onclick="event.stopPropagation()">Contact owner</a>`;
}

function canUseWishlist() {
  const user = getUser();
  return Boolean(user && user.role === 'tenant');
}

function canSendEnquiry() {
  const user = getUser();
  return Boolean(user && user.role === 'tenant');
}

function isListingSaved(listingId) {
  return savedListingIds.has(String(listingId));
}

function renderWishlistButton(listing, options = {}) {
  if (!canUseWishlist()) return '';

  const { detail = false } = options;
  const saved = isListingSaved(listing._id);
  const wrapperClass = detail ? 'wishlist-actions detail-wishlist-actions' : 'wishlist-actions';

  return `
    <div class="${wrapperClass}" onclick="event.stopPropagation()">
      <button
        class="wishlist-button ${saved ? 'is-saved' : ''}"
        onclick="toggleWishlist('${listing._id}', { source: '${detail ? 'detail' : 'listing'}' })"
      >
        ${saved ? 'Saved' : 'Save'}
      </button>
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
    allowShort = false
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

  return normalized;
}

function formatListingPrice(price) {
  const safePrice = Number(price);
  if (!Number.isFinite(safePrice) || safePrice <= 0) {
    return 'Price on request';
  }

  return `₹${safePrice.toLocaleString('en-IN')}/month`;
}

function buildListingCardData(listing = {}) {
  const city = cleanDisplayValue(listing.city, { fallback: 'Location unavailable', minLength: 3 });
  const title = cleanDisplayValue(listing.title, { fallback: 'Untitled stay', minLength: 3 });
  const address = cleanDisplayValue(listing.address, { fallback: 'Address will be shared on request', minLength: 4 });
  const distanceKm = typeof listing.distanceKm === 'number' && Number.isFinite(listing.distanceKm)
    ? `${listing.distanceKm.toFixed(1)} km away`
    : '';
  const price = formatListingPrice(listing.price);
  const ownerPhone = cleanDisplayValue(listing.owner?.whatsapp || listing.owner?.phone, { fallback: '', allowShort: true });
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

  const whatsappMessage = encodeURIComponent(`Hi, I'm interested in your stay "${title}" on Ledge Stay`);
  const whatsappUrl = ownerPhone ? `https://wa.me/${ownerPhone}?text=${whatsappMessage}` : null;
  const imageHtml = listing.photos?.[0]
    ? `<img src="${listing.photos[0]}" alt="${escapeHtml(title)}">`
    : '<div class="no-image card-image-fallback">No photo available</div>';

  return {
    id: listing._id,
    city,
    title,
    address,
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

  return `
    <article class="listing-card" id="listing-card-${card.id}" onclick="showDetail('${card.id}')">
      <div class="card-img-wrap">
        ${card.imageHtml}
        ${card.badges.length ? `<div class="card-img-badges">${card.badges.join('')}</div>` : ''}
      </div>
      <div class="card-body">
        <div class="card-copy">
          <div class="card-city-label">${escapeHtml(card.city).toUpperCase()}</div>
          <h3 class="card-title">${escapeHtml(card.title)}</h3>
          <p class="meta card-address">${escapeHtml(card.address)}</p>
        </div>
        <div class="card-meta-stack">
          ${card.distanceKm ? `<div class="card-distance">${card.distanceKm}</div>` : ''}
          ${card.rating ? `<div class="card-rating"><span class="card-stars">${card.rating.stars}</span><span class="card-rating-val">${card.rating.value}</span><span class="card-rating-count">(${card.rating.count} review${card.rating.count === 1 ? '' : 's'})</span></div>` : '<div class="card-rating card-rating--empty">New listing</div>'}
        </div>
        <div class="card-footer">
          <div class="price">${card.price}</div>
          <div class="card-actions" onclick="event.stopPropagation()">
            ${card.whatsappUrl
              ? `<a class="btn-contact" href="${card.whatsappUrl}" target="_blank" rel="noopener">Contact Owner</a>`
              : '<button class="btn-contact" disabled>Contact Owner</button>'}
            <button class="btn-details" onclick="event.stopPropagation();showDetail('${card.id}')">View Details</button>
          </div>
        </div>
        ${card.ownerActions}
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

  try {
    const data = await apiFetchJson('/api/wishlist', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    savedListingIds = new Set((data.listingIds || []).map((id) => String(id)));
  } catch (err) {
    console.error('wishlist load error:', err);
    savedListingIds = new Set();
  }
}

async function loadWishlistPage() {
  const wishlistGrid = document.getElementById('wishlist-grid');
  if (!wishlistGrid || !canUseWishlist()) return;

  wishlistGrid.innerHTML = '<div class="featured-empty">Loading your saved listings...</div>';

  try {
    const data = await apiFetchJson('/api/wishlist', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    savedListingIds = new Set((data.listingIds || []).map((id) => String(id)));
    const listings = Array.isArray(data.wishlist) ? data.wishlist : [];

    if (listings.length === 0) {
      wishlistGrid.innerHTML = '<div class="featured-empty">No saved listings yet. Tap Save on any listing to add it here.</div>';
      return;
    }

    wishlistGrid.innerHTML = listings.map((listing) => `
      <article class="featured-card" id="wishlist-card-${listing._id}">
        <div class="featured-image-wrap">
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
          ${renderWishlistButton(listing)}
        </div>
      </article>
    `).join('');
  } catch (err) {
    wishlistGrid.innerHTML = `<div class="featured-empty">${err.message || 'Unable to load your wishlist right now.'}</div>`;
  }
}

async function toggleWishlist(listingId, options = {}) {
  if (!canUseWishlist()) return;

  try {
    const data = await apiFetchJson(`/api/wishlist/${listingId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    if (data.saved) {
      savedListingIds.add(String(listingId));
    } else {
      savedListingIds.delete(String(listingId));
    }

    if (options.source === 'wishlist' || window.location.pathname === '/wishlist') {
      const wishlistCard = document.getElementById(`wishlist-card-${listingId}`);
      if (wishlistCard && !data.saved) {
        wishlistCard.remove();
      }

      const wishlistGrid = document.getElementById('wishlist-grid');
      if (wishlistGrid && !wishlistGrid.querySelector('.featured-card')) {
        wishlistGrid.innerHTML = '<div class="featured-empty">No saved listings yet. Tap Save on any listing to add it here.</div>';
      }
    }

    if (document.getElementById('page-wishlist')?.style.display === 'block') {
      loadWishlistPage();
    } else {
      loadFeaturedListings();
      if (document.getElementById('page-listings')?.style.display === 'block') loadListings();
    }
  } catch (err) {
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
    enquiryList.innerHTML = '<div class="dashboard-empty">No enquiries yet. New tenant messages will show up here.</div>';
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
      <article class="featured-card">
        <div class="featured-image-wrap">
          <div class="featured-card-badge-row">
            <span class="featured-card-badge">Verified</span>
          </div>
          ${renderListingImage(listing, listing.title)}
        </div>
        <div class="featured-card-body">
          <div class="featured-meta-row">
            <p class="featured-location">${listing.city}</p>
            <span class="featured-rating-pill">Easy view</span>
          </div>
          <h3>${listing.title}</h3>
          <p class="featured-address">${listing.address}</p>
          <div class="featured-amenities">
            <span>Wi-Fi</span>
            <span>Laundry</span>
            <span>Near campus</span>
          </div>
          <div class="featured-card-footer">
            <div class="featured-price">Rs ${Number(listing.price).toLocaleString()}/month</div>
            <div class="featured-card-actions">
              ${renderWhatsAppButton(listing)}
              <button class="featured-view-button" onclick="showDetail('${listing._id}')">See Details</button>
            </div>
          </div>
          ${renderWishlistButton(listing)}
          ${renderOwnerListingActions(listing)}
        </div>
      </article>
    `).join('');
  } catch (err) {
    featuredGrid.innerHTML = '<div class="featured-empty">Unable to load featured listings right now.</div>';
  }
}

function renderPopularLocations() {
  const grid = document.getElementById('popular-locations-grid');
  if (!grid) return;

  grid.innerHTML = HOME_LOCATIONS.map((location) => `
    <article class="location-card" onclick="applyPopularLocation('${escapeHtml(location.city)}')">
      <img src="${location.image}" alt="${escapeHtml(location.name)}, ${escapeHtml(location.city)}">
      <div class="location-card-overlay"></div>
      <div class="location-card-copy">
        <p>${escapeHtml(location.city)}</p>
        <h3>${escapeHtml(location.name)}</h3>
        <span>${escapeHtml(location.count)}</span>
        <div class="location-card-blurb">${escapeHtml(location.blurb)}</div>
        <div class="location-card-action">Open stays</div>
      </div>
    </article>
  `).join('');
}

function renderHomeReviews() {
  const grid = document.getElementById('home-reviews-grid');
  if (!grid) return;

  grid.innerHTML = HOME_REVIEWS.map((review) => `
    <article class="home-review-card">
      <div class="home-review-stars">★★★★★</div>
      <p class="home-review-quote">"${escapeHtml(review.quote)}"</p>
      <div class="home-review-author">${escapeHtml(review.name)}</div>
      <div class="home-review-meta">${escapeHtml(review.meta)}</div>
    </article>
  `).join('');
}

function applyPopularLocation(city) {
  syncLocationInputs(city);
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

function renderListingsMarkup(listings) {
  return listings.map((listing) => {
    const avg = listing.averageRating ? Number(listing.averageRating).toFixed(1) : null;
    const count = listing.reviewCount || 0;
    const fullStars = avg ? Math.round(avg) : 0;
    const stars = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

    const badges = [];
    if (listing.noBrokerage) badges.push('<span class="img-badge badge-green">No Brokerage</span>');
    if (listing.verified) badges.push('<span class="img-badge badge-teal">Verified</span>');
    if (listing.is_featured) badges.push('<span class="img-badge badge-gold">Best Deal</span>');

    const ownerPhone = listing.owner?.whatsapp || listing.owner?.phone || '';
    const waMsg = encodeURIComponent(`Hi, I'm interested in your PG "${listing.title}" on Ledge Stay`);
    const waUrl = ownerPhone ? `https://wa.me/${ownerPhone}?text=${waMsg}` : null;
    const imgHtml = listing.photos?.[0]
      ? `<img src="${listing.photos[0]}" alt="${escapeHtml(listing.title)}">`
      : '<div class="no-image"></div>';

    return `
      <div class="listing-card" id="listing-card-${listing._id}" onclick="showDetail('${listing._id}')">
        <div class="card-img-wrap">
          ${imgHtml}
          <div class="card-img-badges">${badges.join('')}</div>
        </div>
        <div class="card-body">
          <div class="card-city-label">${escapeHtml(listing.city || '').toUpperCase()}</div>
          <h3>${escapeHtml(listing.title)}</h3>
          <div class="meta">${escapeHtml(listing.address || '')}</div>
          ${typeof listing.distanceKm === 'number' ? `<div class="card-distance">${listing.distanceKm.toFixed(1)} km away</div>` : ''}
          ${avg ? `<div class="card-rating"><span class="card-stars">${stars}</span><span class="card-rating-val">${avg}</span><span class="card-rating-count">(${count} reviews)</span></div>` : ''}
          <div class="price">₹${Number(listing.price).toLocaleString('en-IN')}/month</div>
          <div class="card-actions" onclick="event.stopPropagation()">
            ${waUrl
              ? `<a class="btn-contact" href="${waUrl}" target="_blank" rel="noopener">Contact Owner</a>`
              : '<button class="btn-contact" disabled>Contact Owner</button>'}
            <button class="btn-details" onclick="event.stopPropagation();showDetail('${listing._id}')">View Details</button>
          </div>
          ${renderOwnerListingActions(listing)}
        </div>
      </div>`;
  }).join('');
}

async function goToListingsPage(page) {
  currentListingsPage = page;
  await loadListings();
  document.getElementById('page-listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadListings() {
  const query = nearbySearchState.active
    ? buildNearbyListingsQuery(currentListingsPage)
    : buildListingsQuery(currentListingsPage);
  const endpoint = nearbySearchState.active ? '/api/listings/nearby' : '/api/listings';
  const grid  = document.getElementById('listings-grid');
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

    // Support both paginated ({listings, total, ...}) and legacy plain-array responses
    const listings   = Array.isArray(data) ? data : data.listings;
    const totalPages = data.totalPages || 1;
    const total = Array.isArray(data) ? listings.length : Number(data.total || listings.length);

    if (!Array.isArray(listings) || listings.length === 0) {
      updateNearbyResultsBanner(0, data.radiusKm);
      grid.innerHTML = `<p style="padding:20px;color:#888">${nearbySearchState.active ? 'No nearby listings found for this location.' : 'No listings found.'}</p>`;
      return;
    }

    grid.innerHTML = listings.map((listing) => {
      const avg = listing.averageRating ? Number(listing.averageRating).toFixed(1) : null;
      const count = listing.reviewCount || 0;
      const fullStars = avg ? Math.round(avg) : 0;
      const stars = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

      const badges = [];
      if (listing.noBrokerage) badges.push(`<span class="img-badge badge-green">✓ No Brokerage</span>`);
      if (listing.verified) badges.push(`<span class="img-badge badge-teal">✓ Verified</span>`);
      if (listing.is_featured) badges.push(`<span class="img-badge badge-gold">Best Deal</span>`);

      const ownerPhone = listing.owner?.whatsapp || listing.owner?.phone || '';
      const waMsg = encodeURIComponent(`Hi, I'm interested in your PG "${listing.title}" on Ledge Stay`);
      const waUrl = ownerPhone ? `https://wa.me/${ownerPhone}?text=${waMsg}` : null;

      const imgHtml = listing.photos?.[0]
        ? `<img src="${listing.photos[0]}" alt="${escapeHtml(listing.title)}">`
        : `<div class="no-image"></div>`;

      return `
        <div class="listing-card" id="listing-card-${listing._id}" onclick="showDetail('${listing._id}')">
          <div class="card-img-wrap">
            ${imgHtml}
            <div class="card-img-badges">${badges.join('')}</div>
          </div>
          <div class="card-body">
            <div class="card-city-label">${escapeHtml(listing.city || '').toUpperCase()}</div>
            <h3>${escapeHtml(listing.title)}</h3>
            <div class="meta">${escapeHtml(listing.address || '')}</div>
            ${typeof listing.distanceKm === 'number' ? `<div class="card-distance">${listing.distanceKm.toFixed(1)} km away</div>` : ''}
            ${avg ? `<div class="card-rating"><span class="card-stars">${stars}</span><span class="card-rating-val">${avg}</span><span class="card-rating-count">(${count} reviews)</span></div>` : ''}
            <div class="price">₹${Number(listing.price).toLocaleString('en-IN')}/month</div>
            <div class="card-actions" onclick="event.stopPropagation()">
              ${waUrl
                ? `<a class="btn-contact" href="${waUrl}" target="_blank" rel="noopener">Contact Owner</a>`
                : `<button class="btn-contact" disabled>Contact Owner</button>`}
              <button class="btn-details" onclick="event.stopPropagation();showDetail('${listing._id}')">View Details</button>
            </div>
            ${renderOwnerListingActions(listing)}
          </div>
        </div>`;
    }).join('');

    updateNearbyResultsBanner(total, data.radiusKm);
    paginationEl.innerHTML = renderPagination(currentListingsPage, totalPages);
  } catch (err) {
    updateNearbyResultsBanner();
    grid.innerHTML = `<p style="padding:20px;color:#c0392b">${err.message || 'Unable to load listings.'}</p>`;
  }
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
            <h3>${listing.title}</h3>
            <p>${listing.address}, ${listing.city}</p>
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
    const user = getUser();
    const enquiryName = canSendEnquiry() ? escapeHtml(user?.name || '') : '';
    const enquiryEmail = canSendEnquiry() ? escapeHtml(user?.email || '') : '';

    document.getElementById('detail-content').innerHTML = `
    <div class="detail-photos">
      ${renderPhotoCarousel(listing.photos)}
    </div>
    <div class="detail-info">
      <h1>${listing.title}</h1>
      <div class="price">Rs ${Number(listing.price).toLocaleString()}/month</div>
      <p>${listing.address}, ${listing.city}</p>
      <p>Type: ${listing.type.toUpperCase()} | Gender: ${listing.gender}</p>
      <p>Owner: ${listing.owner.name} - ${listing.owner.email}</p>
      ${renderWhatsAppButton(listing)}
      ${renderWishlistButton(listing, { detail: true })}
      ${listing.amenities && listing.amenities.length > 0 ? `<p>Amenities: ${listing.amenities.join(', ')}</p>` : ''}
      ${listing.description ? `<p>${listing.description}</p>` : ''}
      ${renderOwnerListingActions(listing, { detail: true })}
      <button onclick="showPage('listings')" class="back-button">Back</button>

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

      <section class="enquiry-section">
        <div class="enquiry-section-header">
          <div>
            <h2>Send Enquiry</h2>
            <p class="reviews-subtitle">Message the owner inside the app and keep your interest in one place.</p>
          </div>
        </div>
        <div class="enquiry-form-card">
          <div class="review-form-grid enquiry-form-grid-2">
            <div class="review-form-field">
              <label for="enquiry-name">Name</label>
              <input
                id="enquiry-name"
                class="review-input"
                type="text"
                value="${enquiryName}"
                placeholder="${canSendEnquiry() ? 'Your full name' : 'Login as a tenant to continue'}"
                ${canSendEnquiry() ? '' : 'disabled'}
              >
            </div>
            <div class="review-form-field">
              <label for="enquiry-email">Email</label>
              <input
                id="enquiry-email"
                class="review-input"
                type="email"
                value="${enquiryEmail}"
                placeholder="${canSendEnquiry() ? 'you@example.com' : 'Login required'}"
                ${canSendEnquiry() ? '' : 'disabled'}
              >
            </div>
          </div>
          <div class="review-form-field">
            <label for="enquiry-message">Message</label>
            <textarea
              id="enquiry-message"
              class="review-input review-textarea enquiry-textarea"
              placeholder="${canSendEnquiry() ? 'Hi, I would like to know if this listing is still available and when I can visit.' : 'Login as a tenant to send an enquiry'}"
              ${canSendEnquiry() ? '' : 'disabled'}
            ></textarea>
          </div>
          <button class="review-submit enquiry-submit" onclick="submitEnquiry('${listing._id}')" ${canSendEnquiry() ? '' : 'disabled'}>
            Send Enquiry
          </button>
          <p id="enquiry-feedback" class="review-message"></p>
          ${canSendEnquiry() ? '' : '<p class="review-message">Only logged-in tenants can send enquiries.</p>'}
        </div>
      </section>

      <section id="reviews-section" class="reviews-section">
        <div class="reviews-loading">Loading reviews...</div>
      </section>
    </div>
  `;

    loadReviews(id);
    showPage('detail', { updateHistory: true });
  } catch (err) {
    alert(err.message || 'Unable to load the listing.');
  }
}

async function register() {
  console.log('register called');
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  const errorField = document.getElementById('reg-error');
  const nameErrorField = document.getElementById('reg-name-error');
  const emailErrorField = document.getElementById('reg-email-error');
  const passwordErrorField = document.getElementById('reg-password-error');
  const roleErrorField = document.getElementById('reg-role-error');

  errorField.textContent = '';
  if (nameErrorField) nameErrorField.textContent = '';
  if (emailErrorField) emailErrorField.textContent = '';
  if (passwordErrorField) passwordErrorField.textContent = '';
  if (roleErrorField) roleErrorField.textContent = '';

  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').trim();
  const emailLower = trimmedEmail.toLowerCase();
  const passwordStr = String(password || '');

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const isValidName = /^[A-Za-z ]+$/.test(trimmedName) && trimmedName.replace(/\s/g, '').length >= 2;
  const isValidPassword = passwordStr.length >= 8 && /\d/.test(passwordStr) && /[A-Za-z]/.test(passwordStr);
  const isValidRole = ['tenant', 'owner'].includes(String(role || ''));

  let hasErrors = false;
  if (!trimmedName || !isValidName) {
    if (nameErrorField) nameErrorField.textContent = 'Please enter a valid name';
    hasErrors = true;
  }

  if (!trimmedEmail || !isValidEmail) {
    if (emailErrorField) emailErrorField.textContent = 'Please enter a valid email address';
    hasErrors = true;
  }

  if (!passwordStr || !isValidPassword) {
    if (passwordErrorField) passwordErrorField.textContent = 'Password must be 8+ characters with letters and numbers';
    hasErrors = true;
  }

  if (!isValidRole) {
    if (roleErrorField) roleErrorField.textContent = 'Please select a valid account type';
    hasErrors = true;
  }

  if (hasErrors) return;

  try {
    console.log('register request url:', '/api/auth/register');
    const data = await apiFetchJson('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmedName, email: emailLower, password, role: String(role) })
    });

    console.log('register response data:', data);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    await loadWishlistState();
    updateNav();
    if (data.user.role === 'admin') {
      showPage('admin');
    } else if (data.user.role === 'owner') {
      showPage('dashboard');
    } else {
      showPage('wishlist');
    }
  } catch (err) {
    console.error('register error:', err);
    errorField.textContent = err.message || 'Unable to register right now.';
  }
}

async function login() {
  console.log('login called');
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorField = document.getElementById('login-error');

  errorField.textContent = '';

  try {
    console.log('login request url:', '/api/auth/login');
    const trimmedEmail = String(email || '').trim();
    const data = await apiFetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password })
    });

    console.log('login response data:', data);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    await loadWishlistState();
    updateNav();
    if (data.user.role === 'admin') {
      showPage('admin');
    } else if (data.user.role === 'owner') {
      showPage('dashboard');
    } else {
      showPage('wishlist');
    }
  } catch (err) {
    console.error('login error:', err);
    errorField.textContent = err.message || 'Unable to login right now.';
  }
}

function showForgotPassword(event) {
  if (event?.preventDefault) event.preventDefault();
  const section = document.getElementById('forgot-password-section');
  const message = document.getElementById('forgot-password-message');
  const loginError = document.getElementById('login-error');
  const loginButton = document.querySelector('#page-login button[onclick="login()"]');

  if (loginError) loginError.textContent = '';
  if (message) {
    message.style.display = 'none';
    message.textContent = '';
  }
  if (section) section.style.display = 'block';
  if (loginButton) loginButton.style.display = '';
}

async function requestPasswordReset(event) {
  if (event?.preventDefault) event.preventDefault();
  const email = document.getElementById('forgot-password-email')?.value?.trim() || '';
  const message = document.getElementById('forgot-password-message');
  const btn = document.querySelector('#forgot-password-section button');

  if (!email) {
    if (message) { message.textContent = 'Please enter your email address.'; message.style.display = 'block'; }
    return;
  }

  if (btn) btn.disabled = true;
  if (message) { message.textContent = 'Sending...'; message.style.display = 'block'; }

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (message) { message.textContent = data.message; message.style.color = '#166534'; message.style.display = 'block'; }
  } catch (err) {
    if (message) { message.textContent = 'Something went wrong. Please try again.'; message.style.display = 'block'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  savedListingIds = new Set();
  editingListingId = null;
  resetListingForm();
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
    showPage('register', { updateHistory: false, replaceHistory: true });
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

  document.getElementById('filter-city')?.addEventListener('input', debounce(() => loadListings(), 400));

  // Clear auth errors while user types.
  const loginError = document.getElementById('login-error');
  const loginEmailInput = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');

  if (loginEmailInput) {
    loginEmailInput.addEventListener('input', () => {
      if (loginError) loginError.textContent = '';
    });
  }

  if (loginPasswordInput) {
    loginPasswordInput.addEventListener('input', () => {
      if (loginError) loginError.textContent = '';
    });
  }

  const regError = document.getElementById('reg-error');
  const regNameInput = document.getElementById('reg-name');
  const regEmailInput = document.getElementById('reg-email');
  const regPasswordInput = document.getElementById('reg-password');
  const regRoleInput = document.getElementById('reg-role');

  const regNameError = document.getElementById('reg-name-error');
  const regEmailError = document.getElementById('reg-email-error');
  const regPasswordError = document.getElementById('reg-password-error');
  const regRoleError = document.getElementById('reg-role-error');

  if (regNameInput) {
    regNameInput.addEventListener('input', () => {
      if (regError) regError.textContent = '';
      if (regNameError) regNameError.textContent = '';
    });
  }

  if (regEmailInput) {
    regEmailInput.addEventListener('input', () => {
      if (regError) regError.textContent = '';
      if (regEmailError) regEmailError.textContent = '';
    });
  }

  if (regPasswordInput) {
    regPasswordInput.addEventListener('input', () => {
      if (regError) regError.textContent = '';
      if (regPasswordError) regPasswordError.textContent = '';
    });
  }

  if (regRoleInput) {
    regRoleInput.addEventListener('change', () => {
      if (regError) regError.textContent = '';
      if (regRoleError) regRoleError.textContent = '';
    });
  }

  const forgotEmailInput = document.getElementById('forgot-password-email');
  const forgotMessage = document.getElementById('forgot-password-message');
  if (forgotEmailInput && forgotMessage) {
    forgotEmailInput.addEventListener('input', () => {
      forgotMessage.style.display = 'none';
      forgotMessage.textContent = '';
    });
  }

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
