const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const auth = require('../middleware/auth');
const { upload } = require('../middleware/cloudinary');
const jwt = require('jsonwebtoken');
const { syncLocationForListingChange } = require('../services/locationSearch');

function uploadListingPhotos(req, res, next) {
  upload.array('photos', 10)(req, res, (err) => {
    if (!err) return next();

    console.error('[listings] upload error', {
      message: err.message,
      code: err.code
    });
    return res.status(400).json({
      message: err.message || 'Photo upload failed.'
    });
  });
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

function parseCoordinate(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLocationFilter(location) {
  const trimmedLocation = typeof location === 'string' ? location.trim() : '';
  if (!trimmedLocation) return null;

  const segments = trimmedLocation
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const searchTerms = segments.length ? segments : [trimmedLocation];

  return {
    $and: searchTerms.map((term) => {
      const pattern = new RegExp(escapeRegex(term), 'i');
      return {
        $or: [
          { city: pattern },
          { state: pattern },
          { address: pattern }
        ]
      };
    })
  };
}

function normalizeAmenities(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return [String(value).trim()].filter(Boolean);
}

function validateListingPayload(payload) {
  const title = String(payload.title || '').trim();
  const type = String(payload.type || '').trim();
  const city = String(payload.city || '').trim();
  const address = String(payload.address || '').trim();
  const price = Number(payload.price);

  if (!title) return 'Title is required.';
  if (!['pg', 'hostel', 'apartment', 'room'].includes(type)) return 'A valid listing type is required.';
  if (!city) return 'City is required.';
  if (!address) return 'Address is required.';
  if (!Number.isFinite(price) || price <= 0) return 'A valid monthly rent is required.';
  return null;
}

function getOptionalUser(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      ...decoded,
      id: String(decoded.id || decoded._id || decoded.userId || '')
    };
  } catch (err) {
    return null;
  }
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateDistanceKm(fromLat, fromLng, toLat, toLng) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
    Math.cos(toRadians(toLat)) *
    Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Get all listings (with search, filters & pagination)
router.get('/', async (req, res) => {
  try {
    const { city, type, gender, minPrice, maxPrice, sort, featured, limit: limitParam, page: pageParam } = req.query;
    let filter = { available: true };

    const locationFilter = buildLocationFilter(city);
    if (locationFilter) Object.assign(filter, locationFilter);
    if (type) filter.type = type;
    if (gender) filter.gender = gender;
    if (featured === 'true') filter.is_featured = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    delete filter.approvalStatus;
    delete filter.status;

    let sortOption = {};
    if (sort === 'price_asc') sortOption.price = 1;
    if (sort === 'price_desc') sortOption.price = -1;
    if (sort === 'newest') sortOption.createdAt = -1;
    if (featured === 'true' && !sort) sortOption.createdAt = -1;

    // Pagination — default 12 per page; if a raw `limit` is passed without a
    // page param (e.g. featured strip on home), behave like before.
    const isPaginated = pageParam !== undefined;
    const limit = Number(limitParam) || 12;
    const page  = Math.max(1, Number(pageParam) || 1);
    const skip  = isPaginated ? (page - 1) * limit : 0;

    const total = await Listing.countDocuments(filter || {});

    let listingQuery = Listing.find(filter || {}).sort(sortOption).populate('owner', 'name email').skip(skip).limit(limit);

    const listings = await listingQuery;

    if (isPaginated) {
      return res.json({
        listings,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    }

    // Legacy: callers that don't pass `page` get a plain array so nothing breaks
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/nearby', async (req, res) => {
  try {
    const {
      lat,
      lng,
      radiusKm: radiusParam,
      city,
      type,
      gender,
      minPrice,
      maxPrice,
      limit: limitParam,
      page: pageParam
    } = req.query;

    const userLat = Number(lat);
    const userLng = Number(lng);
    const radiusKm = Math.max(1, Number(radiusParam) || 10);
    const limit = Math.max(1, Number(limitParam) || 12);
    const page = Math.max(1, Number(pageParam) || 1);

    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required.' });
    }

    const query = {
      available: true,
      approvalStatus: 'approved',
      lat: { $ne: null },
      lng: { $ne: null }
    };

    const locationFilter = buildLocationFilter(city);
    if (locationFilter) Object.assign(query, locationFilter);
    if (type) query.type = type;
    if (gender) query.gender = gender;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const listings = await Listing.find(query)
      .populate('owner', 'name email')
      .lean();

    const nearbyListings = listings
      .map((listing) => {
        const distanceKm = calculateDistanceKm(userLat, userLng, listing.lat, listing.lng);
        return {
          ...listing,
          distanceKm: Number(distanceKm.toFixed(1))
        };
      })
      .filter((listing) => listing.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const total = nearbyListings.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paginatedListings = nearbyListings.slice(startIndex, startIndex + limit);

    res.json({
      listings: paginatedListings,
      total,
      page,
      limit,
      totalPages,
      radiusKm
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get dashboard listings for the logged-in owner
router.get('/mine', auth, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can access the dashboard' });
    }

    const listings = await Listing.find({ owner: req.user.id }).sort({ createdAt: -1 });
    const summary = {
      totalListings: listings.length,
      totalEnquiries: listings.reduce((sum, listing) => sum + Number(listing.enquiryCount || 0), 0)
    };

    res.json({ summary, listings });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single listing
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create listing (owners only)
router.post('/', auth, uploadListingPhotos, async (req, res) => {
  try {
    console.log('[listings] create request received', {
      userId: req.user?.id,
      role: req.user?.role,
      bodyKeys: Object.keys(req.body || {}),
      photoCount: req.files?.length || 0
    });

    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only owners can post listings' });

    const validationError = validateListingPayload(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const photos = req.files ? req.files.map(f => f.path) : [];
    const listing = await Listing.create({
      ...req.body,
      owner: req.user.id,
      photos,
      title: String(req.body.title || '').trim(),
      type: String(req.body.type || '').trim(),
      city: String(req.body.city || '').trim(),
      state: String(req.body.state || '').trim(),
      address: String(req.body.address || '').trim(),
      contact: String(req.body.contact || '').trim(),
      description: String(req.body.description || '').trim(),
      gender: String(req.body.gender || 'any').trim() || 'any',
      price: Number(req.body.price),
      amenities: normalizeAmenities(req.body.amenities),
      lat: parseCoordinate(req.body.lat),
      lng: parseCoordinate(req.body.lng),
      available: parseBoolean(req.body.available, true),
      is_featured: parseBoolean(req.body.is_featured, false),
      // Mark newly created listings as live immediately.
      approvalStatus: 'approved',
      rejectionNote: ''
    });
    await syncLocationForListingChange(null, listing.toObject());
    console.log('[listings] listing created successfully', { listingId: listing._id, ownerId: req.user.id });
    res.status(201).json(listing);
  } catch (err) {
    console.error('[listings] create failed', err);
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((entry) => entry.message).join(' ');
      return res.status(400).json({ message });
    }
    res.status(500).json({ message: 'Unable to create listing.', error: err.message });
  }
});

async function updateListing(req, res) {
  try {
    console.log('[listings] update request received', {
      listingId: req.params.id,
      userId: req.user?.id,
      bodyKeys: Object.keys(req.body || {}),
      photoCount: req.files?.length || 0
    });

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    const previousListing = listing.toObject();
    const photos = req.files?.length ? req.files.map(f => f.path) : listing.photos;

    const validationError = validateListingPayload({ ...listing.toObject(), ...req.body });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const updated = await Listing.findByIdAndUpdate(req.params.id, {
      ...req.body,
      photos,
      title: String(req.body.title || listing.title || '').trim(),
      type: String(req.body.type || listing.type || '').trim(),
      city: String(req.body.city || listing.city || '').trim(),
      state: String(req.body.state || listing.state || '').trim(),
      address: String(req.body.address || listing.address || '').trim(),
      contact: String(req.body.contact || listing.contact || '').trim(),
      description: String(req.body.description || listing.description || '').trim(),
      gender: String(req.body.gender || listing.gender || 'any').trim() || 'any',
      price: Number(req.body.price || listing.price),
      amenities: req.body.amenities !== undefined ? normalizeAmenities(req.body.amenities) : listing.amenities,
      lat: parseCoordinate(req.body.lat),
      lng: parseCoordinate(req.body.lng),
      available: parseBoolean(req.body.available, listing.available),
      is_featured: parseBoolean(req.body.is_featured, listing.is_featured)
    }, { new: true });
    await syncLocationForListingChange(previousListing, updated.toObject());
    console.log('[listings] listing updated successfully', { listingId: updated._id });
    res.json(updated);
  } catch (err) {
    console.error('[listings] update failed', err);
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((entry) => entry.message).join(' ');
      return res.status(400).json({ message });
    }
    res.status(500).json({ message: 'Unable to update listing.', error: err.message });
  }
}

// Update listing
router.put('/:id', auth, uploadListingPhotos, updateListing);
router.patch('/:id', auth, uploadListingPhotos, updateListing);

// Delete listing
router.delete('/:id', auth, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    const previousListing = listing.toObject();
    await listing.deleteOne();
    await syncLocationForListingChange(previousListing, null);
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/:id/distance', async (req, res) => {
  try {
    const { from } = req.query;
    if (!from) return res.status(400).json({ message: 'From address required' });

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const geocode = async (address) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=in&limit=1`;
      const r = await fetch(url, { headers: { 'User-Agent': 'LedgeStay/1.0' } });
      const data = await r.json();
      if (!data[0]) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    };

    const toAddress = `${listing.address}, ${listing.city}, India`;
    const [fromCoords, toCoords] = await Promise.all([geocode(from), geocode(toAddress)]);

    if (!fromCoords || !toCoords) {
      return res.status(400).json({ message: 'Could not find one of the addresses' });
    }

    // Haversine straight-line distance
    const R = 6371;
    const dLat = (toCoords.lat - fromCoords.lat) * Math.PI / 180;
    const dLng = (toCoords.lng - fromCoords.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(fromCoords.lat * Math.PI/180) *
              Math.cos(toCoords.lat * Math.PI/180) *
              Math.sin(dLng/2)**2;
    const distanceKm = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);

    res.json({ distanceKm });
  } catch (err) {
    res.status(500).json({ message: 'Error calculating distance', error: err.message });
  }
});

module.exports = router;
