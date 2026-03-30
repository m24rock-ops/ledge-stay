const API = '';
let selectedReviewRating = 0;

function showPage(page) {
  closeMenu();
  document.querySelectorAll('.page').forEach((section) => {
    section.style.display = 'none';
  });

  const activePage = document.getElementById(`page-${page}`);
  if (activePage) activePage.style.display = 'block';
  if (page === 'listings') loadListings();
  if (page === 'home') loadFeaturedListings();
}

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  return JSON.parse(localStorage.getItem('user') || 'null');
}

function updateNav() {
  const user = getUser();
  document.getElementById('nav-auth').style.display = user ? 'none' : 'inline-flex';
  document.getElementById('nav-user').style.display = user ? 'inline-flex' : 'none';
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

async function loadFeaturedListings() {
  const featuredGrid = document.getElementById('featured-grid');
  if (!featuredGrid) return;

  featuredGrid.innerHTML = '<div class="featured-empty">Loading featured listings...</div>';

  try {
    const res = await fetch('/api/listings?featured=true&limit=6');
    const listings = await res.json();

    if (!res.ok) {
      featuredGrid.innerHTML = '<div class="featured-empty">Unable to load featured listings right now.</div>';
      return;
    }

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

  const res = await fetch(`/api/listings?${query.toString()}`);
  const listings = await res.json();
  const grid = document.getElementById('listings-grid');

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
}

async function showDetail(id) {
  const res = await fetch(`/api/listings/${id}`);
  const listing = await res.json();
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
  showPage('detail');
}

async function register() {
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  const phone = document.getElementById('reg-phone').value;

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role, phone })
  });

  const data = await res.json();
  if (res.ok) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    updateNav();
    showPage('listings');
  } else {
    document.getElementById('reg-error').textContent = data.message;
  }
}

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (res.ok) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    updateNav();
    showPage('listings');
  } else {
    document.getElementById('login-error').textContent = data.message;
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateNav();
  closeMenu();
  showPage('home');
}

async function postListing() {
  const user = getUser();
  if (!user) {
    showPage('login');
    return;
  }

  if (user.role !== 'owner') {
    document.getElementById('post-error').textContent = 'Only owners can post listings!';
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

  const amenities = document.getElementById('post-amenities').value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  amenities.forEach((amenity) => formData.append('amenities', amenity));

  const photos = document.getElementById('post-photos').files;
  for (const photo of photos) {
    formData.append('photos', photo);
  }

  const res = await fetch('/api/listings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData
  });

  const data = await res.json();
  if (res.ok) {
    alert('Listing posted successfully!');
    showPage('listings');
  } else {
    document.getElementById('post-error').textContent = data.message;
  }
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
    const res = await fetch(`/api/listings/${listingId}/distance?from=${encodeURIComponent(from)}`);
    const data = await res.json();
    if (res.ok) {
      document.getElementById('distance-result').innerHTML = `
        <div class="distance-result-card">
          <strong>${data.distanceKm} km</strong> away - approximately <strong>${data.durationMin} minutes</strong> by car
        </div>
      `;
    } else {
      document.getElementById('distance-result').innerHTML = `<p style="color:red">${data.message}</p>`;
    }
  } catch (err) {
    document.getElementById('distance-result').innerHTML = '<p style="color:red">Error calculating distance</p>';
  }

  button.textContent = 'Calculate Distance';
  button.disabled = false;
}

async function loadReviews(listingId) {
  const container = document.getElementById('reviews-section');
  if (!container) return;

  container.innerHTML = '<div class="reviews-loading">Loading reviews...</div>';

  try {
    const res = await fetch(`/api/reviews?listingId=${encodeURIComponent(listingId)}`);
    const data = await res.json();

    if (!res.ok) {
      container.innerHTML = `<div class="review-error-box">${data.message || 'Unable to load reviews right now.'}</div>`;
      return;
    }

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

  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ listingId, rating, comment })
  });

  if (res.ok) {
    selectedReviewRating = 0;
    loadReviews(listingId);
  } else {
    const data = await res.json();
    errorField.textContent = data.message || 'Unable to submit review.';
  }
}

async function deleteReview(reviewId, listingId) {
  const res = await fetch(`/api/reviews/${reviewId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` }
  });

  if (res.ok) {
    loadReviews(listingId);
  }
}

updateNav();
loadFeaturedListings();
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    closeMenu();
  }
});
