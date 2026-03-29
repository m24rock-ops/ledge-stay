const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const auth = require('../middleware/auth');
const { upload } = require('../middleware/cloudinary');

// Get all listings (with search & filters)
router.get('/', async (req, res) => {
  try {
    const { city, type, gender, minPrice, maxPrice, sort } = req.query;
    let query = { available: true };

    if (city) query.city = { $regex: city, $options: 'i' };
    if (type) query.type = type;
    if (gender) query.gender = gender;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sortOption = {};
    if (sort === 'price_asc') sortOption.price = 1;
    if (sort === 'price_desc') sortOption.price = -1;
    if (sort === 'newest') sortOption.createdAt = -1;

    const listings = await Listing.find(query).sort(sortOption).populate('owner', 'name email');
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single listing
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('owner', 'name email');
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create listing (owners only)
router.post('/', auth, upload.array('photos', 5), async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only owners can post listings' });

    const photos = req.files ? req.files.map(f => f.path) : [];
    const listing = await Listing.create({ ...req.body, owner: req.user.id, photos });
    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update listing
router.put('/:id', auth, upload.array('photos', 5), async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    const photos = req.files?.length ? req.files.map(f => f.path) : listing.photos;
   
    const updated = await Listing.findByIdAndUpdate(req.params.id, { ...req.body, photos }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

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