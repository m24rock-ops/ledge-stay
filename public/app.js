const ROUTE_PATHS = {
  home: '/',
  browse: '/browse',
  listings: '/browse',
  login: '/login',
  register: '/register',
  post: '/post',
  dashboard: '/dashboard'
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled error:', event.reason);
});

let selectedReviewRating = 0;
let editingListingId = null;

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

  if (updateHistory) {
    navigateToPath(normalizedPage, replaceHistory);
  }

  if (normalizedPage === 'listings') loadListings();
  if (normalizedPage === 'home') loadFeaturedListings();
  if (normalizedPage === 'dashboard') loadOwnerDashboard();
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
  const dashboardLink = document.getElementById('nav-dashboard-link');
  const postLink = document.getElementById('nav-post-link');

  navAuth.style.display = user ? 'none' : 'inline-flex';
  navUser.style.display = user ? 'inline-flex' : 'none';

  if (dashboardLink) dashboardLink.style.display = user && user.role === 'owner' ? 'inline-flex' : 'none';
  if (postLink) postLink.style.display = user && user.role === 'owner' ? 'inline-flex' : 'none';
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
  const city = document.getElementById('hero-search').value;
  document.getElementById('filter-city').value = city;
  showPage('listings');
}

function renderStars(rating) {
  const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`;
}

function renderListingImage(listing, altText) {
  if (listing.photos && listing.photos.length > 0) {
    return `<img src="${listing.photos[0]}" alt="${altText}">`;
  }

  return '<div class="no-image">Home</div>';
}

function apiUrl(path) {
  return path;
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

function resetListingForm() {
  editingListingId = null;
  document.getElementById('post-form-title').textContent = 'Post a Listing';
  document.getElementById('post-submit-button').textContent = 'Post Listing';
  document.getElementById('post-title').value = '';
  document.getElementById('post-type').value = 'pg';
  document.getElementById('post-city').value = '';
  document.getElementById('post-address').value = '';
  document.getElementById('post-price').value = '';
  document.getElementById('post-gender').value = 'any';
  document.getElementById('post-description').value = '';
  document.getElementById('post-amenities').value = '';
  document.getElementById('post-available').checked = true;
  document.getElementById('post-featured').checked = false;
  document.getElementById('post-photos').value = '';
  document.getElementById('post-error').textContent = '';
}

function populateListingForm(listing) {
  editingListingId = listing._id;
  document.getElementById('post-form-title').textContent = 'Edit Listing';
  document.getElementById('post-submit-button').textContent = 'Save Changes';
  document.getElementById('post-title').value = listing.title || '';
  document.getElementById('post-type').value = listing.type || 'pg';
  document.getElementById('post-city').value = listing.city || '';
  document.getElementById('post-address').value = listing.address || '';
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
          ${renderListingImage(listing, listing.title)}
        </div>
        <div class="featured-card-body">
          <p class="featured-location">${listing.city}</p>
          <h3>${listing.title}</h3>
          <p class="featured-address">${listing.address}</p>
          <div class="featured-card-footer">
            <div class="featured-price">Rs ${Number(listing.price).toLocaleString()}/month</div>
            <button class="featured-view-button" onclick="showDetail('${listing._id}')">View</button>
          </div>
        </div>
      </article>
    `).join('');
  } catch (err) {
    featuredGrid.innerHTML = '<div class="featured-empty">Unable to load featured listings right now.</div>';
  }
}

async function loadListings() {
  const city = document.getElementById('filter-city').value;
  const type = document.getElementById('filter-type').value;
  const gender = document.getElementById('filter-gender').value;
  const minPrice = document.getElementById('filter-min').value;
  const maxPrice = document.getElementById('filter-max').value;
  const sort = document.getElementById('filter-sort').value;

  const query = new URLSearchParams();
  if (city) query.append('city', city);
  if (type) query.append('type', type);
  if (gender) query.append('gender', gender);
  if (minPrice) query.append('minPrice', minPrice);
  if (maxPrice) query.append('maxPrice', maxPrice);
  if (sort) query.append('sort', sort);

  const grid = document.getElementById('listings-grid');

  try {
    const listings = await apiFetchJson(`/api/listings?${query.toString()}`);

    if (!Array.isArray(listings) || listings.length === 0) {
      grid.innerHTML = '<p style="padding:20px;color:#888">No listings found.</p>';
      return;
    }

    grid.innerHTML = listings.map((listing) => `
      <div class="listing-card" onclick="showDetail('${listing._id}')">
        ${renderListingImage(listing, listing.title)}
        <div class="card-body">
          <h3>${listing.title}</h3>
          <div class="price">Rs ${Number(listing.price).toLocaleString()}/mo</div>
          <div class="meta">${listing.address}, ${listing.city}</div>
          <div>
            <span class="badge">${listing.type.toUpperCase()}</span>
            <span class="badge">${listing.gender}</span>
          </div>
          ${listing.owner?.phone ? `
            <a
              href="https://wa.me/91${listing.owner.phone}?text=Hi, I am interested in your listing: ${encodeURIComponent(listing.title)}"
              target="_blank"
              onclick="event.stopPropagation()"
              style="display:inline-block;margin-top:10px;padding:8px 16px;background:#25D366;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600"
            >
              WhatsApp Owner
            </a>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<p style="padding:20px;color:#c0392b">${err.message || 'Unable to load listings.'}</p>`;
  }
}

async function loadOwnerDashboard() {
  const user = getUser();
  const dashboardList = document.getElementById('dashboard-listings');
  if (!user || user.role !== 'owner' || !dashboardList) return;

  dashboardList.innerHTML = '<div class="dashboard-empty">Loading your listings...</div>';

  try {
    const data = await apiFetchJson('/api/listings/mine', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    document.getElementById('dashboard-total-listings').textContent = data.summary.totalListings;
    document.getElementById('dashboard-total-enquiries').textContent = data.summary.totalEnquiries;

    if (!Array.isArray(data.listings) || data.listings.length === 0) {
      dashboardList.innerHTML = `
        <div class="dashboard-empty">
          You have not added any listings yet.
          <button class="dashboard-empty-button" onclick="openCreateListingForm()">Add your first listing</button>
        </div>
      `;
      return;
    }

    dashboardList.innerHTML = data.listings.map((listing) => `
      <article class="dashboard-listing-card">
        <div class="dashboard-listing-main">
          <div class="dashboard-listing-copy">
            <h3>${listing.title}</h3>
            <p>${listing.address}, ${listing.city}</p>
          </div>
          <div class="dashboard-listing-metrics">
            <div class="dashboard-chip ${listing.available ? 'is-active' : 'is-inactive'}">
              ${listing.available ? 'Active' : 'Unavailable'}
            </div>
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
  }
}

async function showDetail(id) {
  try {
    const listing = await apiFetchJson(`/api/listings/${id}`);
    selectedReviewRating = 0;

    document.getElementById('detail-content').innerHTML = `
    <div class="detail-photos">
      ${listing.photos && listing.photos.length > 0
        ? listing.photos.map((photo) => `<img src="${photo}" alt="Listing photo">`).join('')
        : '<div class="no-image detail-no-image">No photo available</div>'}
    </div>
    <div class="detail-info">
      <h1>${listing.title}</h1>
      <div class="price">Rs ${Number(listing.price).toLocaleString()}/month</div>
      <p>${listing.address}, ${listing.city}</p>
      <p>Type: ${listing.type.toUpperCase()} | Gender: ${listing.gender}</p>
      <p>Owner: ${listing.owner.name} - ${listing.owner.email}</p>
      ${listing.owner.phone ? `
        <a
          href="https://wa.me/91${listing.owner.phone}?text=Hi, I am interested in your listing: ${encodeURIComponent(listing.title)}"
          target="_blank"
          class="contact-link"
        >
          Contact on WhatsApp
        </a>
      ` : ''}
      ${listing.amenities && listing.amenities.length > 0 ? `<p>Amenities: ${listing.amenities.join(', ')}</p>` : ''}
      ${listing.description ? `<p>${listing.description}</p>` : ''}
      <button onclick="showPage('listings')" class="back-button">Back</button>

      <div class="distance-card">
        <h3 class="distance-title">How far is this from your place?</h3>
        <div class="distance-form">
          <input
            type="text"
            id="distance-input"
            placeholder="Enter your college or workplace address..."
            class="distance-input"
          >
          <button
            id="distance-btn"
            onclick="calculateDistance('${listing._id}')"
            class="distance-button"
          >
            Calculate Distance
          </button>
        </div>
        <div id="distance-result"></div>
      </div>

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
  const phone = document.getElementById('reg-phone').value;
  const errorField = document.getElementById('reg-error');

  errorField.textContent = '';

  try {
    console.log('register request url:', '/api/auth/register');
    const data = await apiFetchJson('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, phone })
    });

    console.log('register response data:', data);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    updateNav();
    showPage(data.user.role === 'owner' ? 'dashboard' : 'listings');
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
    const data = await apiFetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    console.log('login response data:', data);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    updateNav();
    showPage(data.user.role === 'owner' ? 'dashboard' : 'listings');
  } catch (err) {
    console.error('login error:', err);
    errorField.textContent = err.message || 'Unable to login right now.';
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  editingListingId = null;
  resetListingForm();
  updateNav();
  closeMenu();
  showPage('home');
}

async function saveListing() {
  const user = getUser();
  if (!user) {
    showPage('login');
    return;
  }

  if (user.role !== 'owner') {
    document.getElementById('post-error').textContent = 'Only owners can post listings.';
    return;
  }

  const formData = new FormData();
  formData.append('title', document.getElementById('post-title').value);
  formData.append('type', document.getElementById('post-type').value);
  formData.append('city', document.getElementById('post-city').value);
  formData.append('address', document.getElementById('post-address').value);
  formData.append('price', document.getElementById('post-price').value);
  formData.append('gender', document.getElementById('post-gender').value);
  formData.append('description', document.getElementById('post-description').value);
  formData.append('available', String(document.getElementById('post-available').checked));
  formData.append('is_featured', String(document.getElementById('post-featured').checked));

  const amenities = document.getElementById('post-amenities').value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  amenities.forEach((amenity) => formData.append('amenities', amenity));

  const photos = document.getElementById('post-photos').files;
  for (const photo of photos) {
    formData.append('photos', photo);
  }

  const isEditing = Boolean(editingListingId);
  const endpoint = isEditing ? `/api/listings/${editingListingId}` : '/api/listings';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    await apiFetchJson(endpoint, {
      method,
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    });

    alert(isEditing ? 'Listing updated successfully!' : 'Listing posted successfully!');
    resetListingForm();
    showPage('dashboard');
  } catch (err) {
    document.getElementById('post-error').textContent = err.message || 'Unable to save listing.';
  }
}

async function deleteListing(listingId) {
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

  loadOwnerDashboard();
}

async function calculateDistance(listingId) {
  const from = document.getElementById('distance-input').value;
  if (!from) {
    alert('Please enter your college or workplace address!');
    return;
  }

  const button = document.getElementById('distance-btn');
  button.textContent = 'Calculating...';
  button.disabled = true;

  try {
    const data = await apiFetchJson(`/api/listings/${listingId}/distance?from=${encodeURIComponent(from)}`);
    document.getElementById('distance-result').innerHTML = `
      <div class="distance-result-card">
        <strong>${data.distanceKm} km</strong> away - approximately <strong>${data.durationMin} minutes</strong> by car
      </div>
    `;
  } catch (err) {
    document.getElementById('distance-result').innerHTML = `<p style="color:red">${err.message || 'Error calculating distance'}</p>`;
  }

  button.textContent = 'Calculate Distance';
  button.disabled = false;
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
  if (path === '/dashboard') {
    showPage('dashboard', { updateHistory: false, replaceHistory: true });
    return;
  }

  if (path === '/browse') {
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

  showPage('home', { updateHistory: false, replaceHistory: true });
}

document.addEventListener('DOMContentLoaded', () => {
  attachNavbarListeners();
  updateNav();
  resetListingForm();
  loadFeaturedListings();
  bootFromPath();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    closeMenu();
  }
});

window.addEventListener('popstate', () => {
  bootFromPath();
});
