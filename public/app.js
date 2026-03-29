const API = '';

// Show/hide pages
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById('page-' + page).style.display = 'block';
  if (page === 'listings') loadListings();
}

// Auth state
function getToken() { return localStorage.getItem('token'); }
function getUser() { return JSON.parse(localStorage.getItem('user') || 'null'); }

function updateNav() {
  const user = getUser();
  if (user) {
    document.getElementById('nav-auth').style.display = 'none';
    document.getElementById('nav-user').style.display = 'inline';
  } else {
    document.getElementById('nav-auth').style.display = 'inline';
    document.getElementById('nav-user').style.display = 'none';
  }
}

// Hero search
function heroSearch() {
  const city = document.getElementById('hero-search').value;
  document.getElementById('filter-city').value = city;
  showPage('listings');
}

// Load listings
async function loadListings() {
  const city = document.getElementById('filter-city').value;
  const type = document.getElementById('filter-type').value;
  const gender = document.getElementById('filter-gender').value;
  const minPrice = document.getElementById('filter-min').value;
  const maxPrice = document.getElementById('filter-max').value;
  const sort = document.getElementById('filter-sort').value;

  let query = new URLSearchParams();
  if (city) query.append('city', city);
  if (type) query.append('type', type);
  if (gender) query.append('gender', gender);
  if (minPrice) query.append('minPrice', minPrice);
  if (maxPrice) query.append('maxPrice', maxPrice);
  if (sort) query.append('sort', sort);

  const res = await fetch(`/api/listings?${query.toString()}`);
  const listings = await res.json();

  const grid = document.getElementById('listings-grid');
  if (listings.length === 0) {
    grid.innerHTML = '<p style="padding:20px;color:#888">No listings found.</p>';
    return;
  }

  grid.innerHTML = listings.map(l => `
    <div class="listing-card" onclick="showDetail('${l._id}')">
      ${l.photos && l.photos.length > 0
        ? `<img src="${l.photos[0]}" alt="${l.title}">`
        : `<div class="no-image">🏠</div>`}
      <div class="card-body">
        <h3>${l.title}</h3>
        <div class="price">₹${l.price.toLocaleString()}/mo</div>
        <div class="meta">📍 ${l.address}, ${l.city}</div>
        <div>
          <span class="badge">${l.type.toUpperCase()}</span>
          <span class="badge">${l.gender}</span>
        </div>
        ${l.owner?.phone ? `
        <a href="https://wa.me/91${l.owner.phone}?text=Hi, I am interested in your listing: ${l.title}" 
          target="_blank"
          onclick="event.stopPropagation()"
          style="display:inline-block;margin-top:10px;padding:8px 16px;background:#25D366;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">
          💬 WhatsApp Owner
        </a>` : ''}
      </div>
    </div>
  `).join('');
}

// Show listing detail
async function showDetail(id) {
  const res = await fetch(`/api/listings/${id}`);
  const l = await res.json();

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-photos">
      ${l.photos && l.photos.length > 0
        ? l.photos.map(p => `<img src="${p}" alt="photo">`).join('')
        : '<div class="no-image" style="height:300px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:64px;border-radius:12px">🏠</div>'}
    </div>
    <div class="detail-info">
      <h1>${l.title}</h1>
      <div class="price">₹${l.price.toLocaleString()}/month</div>
      <p>📍 ${l.address}, ${l.city}</p>
      <p>🏷️ Type: ${l.type.toUpperCase()} &nbsp; 👤 Gender: ${l.gender}</p>
      <p>📞 Owner: ${l.owner.name} — ${l.owner.email}</p>
      ${l.owner.phone ? `<a href="https://wa.me/91${l.owner.phone}?text=Hi, I am interested in your listing: ${l.title}" target="_blank" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#25D366;color:white;border-radius:8px;text-decoration:none;font-weight:600">💬 Contact on WhatsApp</a>` : ''}
      ${l.amenities && l.amenities.length > 0
        ? `<p>✅ Amenities: ${l.amenities.join(', ')}</p>` : ''}
      ${l.description ? `<p>📝 ${l.description}</p>` : ''}
      <button onclick="showPage('listings')" style="margin-top:20px;max-width:200px">← Back</button>
      <div style="margin-top:24px;padding:20px;background:#f9f9f9;border-radius:12px">
        <h3 style="margin-bottom:12px">📍 How far is this from your place?</h3>
        <div style="display:flex;gap:8px">
          <input type="text" id="distance-input" placeholder="Enter your college or workplace address..." style="flex:1;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:14px">
          <button id="distance-btn" onclick="calculateDistance('${l._id}')" style="padding:12px 20px;background:#e74c3c;color:white;border:none;border-radius:8px;cursor:pointer;white-space:nowrap">Calculate Distance</button>
        </div>
        <div id="distance-result"></div>
      </div>
    </div>
  `;
  loadReviews(id);
  showPage('detail');
}

// Register
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

// Login
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

// Logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateNav();
  showPage('home');
}

// Post listing
async function postListing() {
  const user = getUser();
  if (!user) { showPage('login'); return; }
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
    .split(',').map(a => a.trim()).filter(a => a);
  amenities.forEach(a => formData.append('amenities', a));

  const photos = document.getElementById('post-photos').files;
  for (let photo of photos) formData.append('photos', photo);

  const res = await fetch('/api/listings', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + getToken() },
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

// Init
updateNav();
async function calculateDistance(listingId) {
  const from = document.getElementById('distance-input').value;
  if (!from) { alert('Please enter your college or workplace address!'); return; }
  const btn = document.getElementById('distance-btn');
  btn.textContent = 'Calculating...';
  btn.disabled = true;
  try {
    const res = await fetch(`/api/listings/${listingId}/distance?from=${encodeURIComponent(from)}`);
    const data = await res.json();
    if (res.ok) {
      document.getElementById('distance-result').innerHTML = `
        <div style="background:#e8f5e9;padding:16px;border-radius:8px;margin-top:16px">
          🚗 <strong>${data.distanceKm} km</strong> away — approximately <strong>${data.durationMin} minutes</strong> by car
        </div>`;
    } else {
      document.getElementById('distance-result').innerHTML = `<p style="color:red">${data.message}</p>`;
    }
  } catch (err) {
    document.getElementById('distance-result').innerHTML = `<p style="color:red">Error calculating distance</p>`;
  }
  btn.textContent = 'Calculate Distance';
  btn.disabled = false;
}
async function loadReviews(listingId) {
  const res = await fetch(`/api/reviews/${listingId}`);
  const reviews = await res.json();
  const user = getUser();

  const avg = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  document.getElementById('reviews-section').innerHTML = `
    <div style="margin-top:32px;padding:20px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <h3 style="margin-bottom:16px">⭐ Reviews ${avg ? `— Average: ${avg}/5` : ''}</h3>
      ${user ? `
        <div style="margin-bottom:24px;padding:16px;background:#f9f9f9;border-radius:8px">
          <p style="margin-bottom:8px;font-weight:500">Leave a Review</p>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            ${[1,2,3,4,5].map(n => `
              <button onclick="setRating(${n})" id="star-${n}"
                style="padding:8px 12px;border:1px solid #ddd;border-radius:8px;cursor:pointer;background:#fff;font-size:18px">
                ⭐
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="review-rating" value="0">
          <textarea id="review-comment" placeholder="Write your review..." 
            style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;height:80px;margin-bottom:8px;font-size:14px"></textarea>
          <button onclick="submitReview('${listingId}')"
            style="padding:10px 24px;background:#e74c3c;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600">
            Submit Review
          </button>
          <p id="review-error" style="color:red;margin-top:8px"></p>
        </div>
      ` : '<p style="margin-bottom:16px;color:#888">Login to leave a review</p>'}
      ${reviews.length === 0 ? '<p style="color:#888">No reviews yet</p>' : ''}
      ${reviews.map(r => `
        <div style="padding:16px;border-bottom:1px solid #eee">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${r.user.name}</strong>
            <span>${'⭐'.repeat(r.rating)}</span>
          </div>
          <p style="margin-top:8px;color:#555">${r.comment}</p>
          <p style="font-size:12px;color:#aaa;margin-top:4px">${new Date(r.createdAt).toLocaleDateString()}</p>
          ${user && r.user._id === user.id ? `
            <button onclick="deleteReview('${r._id}','${listingId}')"
              style="margin-top:8px;padding:4px 12px;background:#fff;border:1px solid #e74c3c;color:#e74c3c;border-radius:6px;cursor:pointer;font-size:12px">
              Delete
            </button>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function setRating(n) {
  document.getElementById('review-rating').value = n;
  for(let i = 1; i <= 5; i++) {
    document.getElementById(`star-${i}`).style.background = i <= n ? '#ffeaa7' : '#fff';
  }
}

async function submitReview(listingId) {
  const rating = parseInt(document.getElementById('review-rating').value);
  const comment = document.getElementById('review-comment').value;

  if (!rating) { document.getElementById('review-error').textContent = 'Please select a rating!'; return; }
  if (!comment) { document.getElementById('review-error').textContent = 'Please write a comment!'; return; }

  const res = await fetch(`/api/reviews/${listingId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getToken()
    },
    body: JSON.stringify({ rating, comment })
  });

  if (res.ok) {
    loadReviews(listingId);
  } else {
    const data = await res.json();
    document.getElementById('review-error').textContent = data.message;
  }
}

async function deleteReview(reviewId, listingId) {
  await fetch(`/api/reviews/${reviewId}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + getToken() }
  });
  loadReviews(listingId);
}