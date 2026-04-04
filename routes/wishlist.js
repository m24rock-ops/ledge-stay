const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Listing = require('../models/Listing');
const Wishlist = require('../models/Wishlist');
const User = require('../models/User');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    let entries = await Wishlist.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'listingId',
        populate: { path: 'owner', select: 'name email phone' }
      });

    if (entries.length === 0) {
      const user = await User.findById(req.user.id).select('wishlist');
      if (user?.wishlist?.length) {
        const seedEntries = user.wishlist.map((listingId) => ({
          userId: req.user.id,
          listingId
        }));
        try {
          await Wishlist.insertMany(seedEntries, { ordered: false });
        } catch (err) {
          if (err.code !== 11000) {
            console.warn('[wishlist] seed failed', err);
          }
        }

        entries = await Wishlist.find({ userId: req.user.id })
          .sort({ createdAt: -1 })
          .populate({
            path: 'listingId',
            populate: { path: 'owner', select: 'name email phone' }
          });
      }
    }

    const listings = entries.map((entry) => entry.listingId).filter(Boolean);
    res.json({
      wishlist: listings,
      listingIds: listings.map((listing) => String(listing._id))
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const listingId = String(req.body.listingId || '').trim();
    if (!listingId) return res.status(400).json({ message: 'listingId is required' });

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    await Wishlist.findOneAndUpdate(
      { userId: req.user.id, listingId },
      { $setOnInsert: { userId: req.user.id, listingId } },
      { upsert: true, new: true }
    );

    res.json({
      saved: true,
      listingId
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:listingId', async (req, res) => {
  try {
    const listingId = String(req.params.listingId || '').trim();
    if (!listingId) return res.status(400).json({ message: 'listingId is required' });

    await Wishlist.deleteOne({ userId: req.user.id, listingId });

    res.json({
      saved: false,
      listingId
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
