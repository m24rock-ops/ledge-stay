const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const auth = require('../middleware/auth');
const { upload } = require('../middleware/cloudinary');
const jwt = require('jsonwebtoken');

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

  const pattern = new RegExp(escapeRegex(trimmedLocation), 'i');
  return {
    $or: [
      { city: pattern },
      { address: pattern }
    ]
  };
}

function getOptionalUser(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
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
    // Only show approved listings on the browse page
    let query = { available: true, approvalStatus: 'approved' };

    const locationFilter = buildLocationFilter(city);
    if (locationFilter) Object.assign(query, locationFilter);
    if (type) query.type = type;
    if (gender) query.gender = gender;
    if (featured === 'true') query.is_featured = true;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

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

    const total = await Listing.countDocuments(query);

    let listingQuery = Listing.find(query).sort(sortOption).populate('owner', 'name email').skip(skip).limit(limit);

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
      totalEnquiries: listings.reduce((sum, listing) => sum + Number(listing.enquiryCount || 0), 0),
      pendingListings: listings.filter((listing) => listing.approvalStatus === 'pending').length,
      approvedListings: listings.filter((listing) => listing.approvalStatus === 'approved').length,
      rejectedListings: listings.filter((listing) => listing.approvalStatus === 'rejected').length
    };

    res.json({ summary, listings });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single listing
router.get('/:id', async (req, res) => {
  try {
    const user = getOptionalUser(req);
    const listing = await Listing.findById(req.params.id).populate('owner', 'name email');
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const ownerId = String(listing.owner?._id || listing.owner || '');
    const canViewHiddenListing = Boolean(
      user && (user.role === 'admin' || String(user.id) === ownerId)
    );

    if (listing.approvalStatus !== 'approved' && !canViewHiddenListing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create listing (owners only)
router.post('/', auth, upload.array('photos', 10), async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only owners can post listings' });

    const photos = req.files ? req.files.map(f => f.path) : [];
    const listing = await Listing.create({
      ...req.body,
      owner: req.user.id,
      photos,
      lat: parseCoordinate(req.body.lat),
      lng: parseCoordinate(req.body.lng),
      available: parseBoolean(req.body.available, true),
      is_featured: parseBoolean(req.body.is_featured, false),
      // approvalStatus defaults to 'pending' — admin must approve before it goes live
      rejectionNote: ''
    });
    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

async function updateListing(req, res) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    const photos = req.files?.length ? req.files.map(f => f.path) : listing.photos;

    const updated = await Listing.findByIdAndUpdate(req.params.id, {
      ...req.body,
      photos,
      lat: parseCoordinate(req.body.lat),
      lng: parseCoordinate(req.body.lng),
      available: parseBoolean(req.body.available, listing.available),
      is_featured: parseBoolean(req.body.is_featured, listing.is_featured)
    }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// Update listing
router.put('/:id', auth, upload.array('photos', 10), updateListing);
router.patch('/:id', auth, upload.array('photos', 10), updateListing);

// Delete listing
router.delete('/:id', auth, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    await listing.deleteOne();
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
