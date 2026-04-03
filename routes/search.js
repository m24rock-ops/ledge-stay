const express = require('express');
const router = express.Router();
const { searchLocations } = require('../services/locationSearch');

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
