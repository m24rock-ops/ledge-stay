const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Listing = require('../models/Listing');

router.use(auth);

router.use((req, res, next) => {
  if (req.user.role !== 'tenant') {
    return res.status(403).json({ message: 'Only tenants can use saved listings' });
  }
  next();
});

router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'wishlist',
      populate: { path: 'owner', select: 'name email phone' },
      options: { sort: { createdAt: -1 } }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      wishlist: user.wishlist || [],
      listingIds: (user.wishlist || []).map((listing) => String(listing._id))
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/:listingId', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.listingId);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const listingId = String(req.params.listingId);
    const existingIndex = user.wishlist.findIndex((id) => String(id) === listingId);

    let saved;
    if (existingIndex >= 0) {
      user.wishlist.splice(existingIndex, 1);
      saved = false;
    } else {
      user.wishlist.push(req.params.listingId);
      saved = true;
    }

    await user.save();

    res.json({
      saved,
      listingId,
      wishlistCount: user.wishlist.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
