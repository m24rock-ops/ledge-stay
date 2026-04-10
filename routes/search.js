const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const { searchLocations } = require('../services/locationSearch');

router.get('/search', async (req, res) => {
  const query = req.query.query;

  if (!query) return res.json([]);

  try {
    const regex = new RegExp(query, 'i');

    const results = await Listing.find({
      $or: [
        { city: regex },
        { address: regex },
        { title: regex }
      ]
    }).limit(8);

    const suggestions = results.map((item) => ({
      name: item.title || item.city,
      city: item.city,
      state: item.state || ''
    }));

    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

router.get('/', async (req, res) => {
  try {
    const rawQuery = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 5, 10));
    if (!rawQuery) return res.json([]);

    const suggestions = await searchLocations(rawQuery, limit);
    return res.json(suggestions);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to fetch search suggestions.', error: err.message });
  }
});

module.exports = router;
