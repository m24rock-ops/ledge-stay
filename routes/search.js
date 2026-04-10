const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

router.get('/', async (req, res) => {
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
    }).select('city address title').limit(10);

    const suggestions = [...new Set(
      results.map(r => r.city).filter(Boolean)
    )];

    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

module.exports = router;
