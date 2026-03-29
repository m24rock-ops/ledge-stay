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

module.exports = router;