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

function getOptionalUser(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Get all listings (with search, filters & pagination)
router.get('/', async (req, res) => {
  try {
    const { city, type, gender, minPrice, maxPrice, sort, featured, limit: limitParam, page: pageParam } = req.query;
    // Only show approved listings on the browse page
    let query = { available: true, approvalStatus: 'approved' };

    if (city) query.city = { $regex: city, $options: 'i' };
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

// Get distance from user location to listing
router.get('/:id/distance', async (req, res) => {
  try {
    const { from } = req.query;
    if (!from) return res.status(400).json({ message: 'From address required' });

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const toAddress = `${listing.address}, ${listing.city}, India`;

    // Geocode both addresses
    const geocode = async (address) => {
      const response = await fetch(
        `https://api.openrouteservice.org/geocode/search?api_key=${process.env.ORS_API_KEY}&text=${encodeURIComponent(address)}&boundary.country=IN`
      );
      const data = await response.json();
      return data.features[0]?.geometry?.coordinates;
    };

    const [fromCoords, toCoords] = await Promise.all([
      geocode(from),
      geocode(toAddress)
    ]);

    if (!fromCoords || !toCoords) {
      return res.status(400).json({ message: 'Could not find one of the addresses' });
    }

    // Get distance and duration
    const routeRes = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        'Authorization': process.env.ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: [fromCoords, toCoords]
      })
    });

    const routeData = await routeRes.json();
    const summary = routeData.routes[0]?.summary;

    if (!summary) return res.status(400).json({ message: 'Could not calculate route' });

    const distanceKm = (summary.distance / 1000).toFixed(1);
    const durationMin = Math.round(summary.duration / 60);

    res.json({ distanceKm, durationMin });
  } catch (err) {
    res.status(500).json({ message: 'Error calculating distance', error: err.message });
  }
});

module.exports = router;
