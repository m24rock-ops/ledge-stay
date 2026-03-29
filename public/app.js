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
  showPage('detail');
}

// Register
async function register() {
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role })
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