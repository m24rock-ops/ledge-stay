const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLocationLabel(address, city) {
  const safeAddress = typeof address === 'string' ? address.trim() : '';
  const safeCity = typeof city === 'string' ? city.trim() : '';

  if (safeAddress && safeCity) return `${safeAddress}, ${safeCity}`;
  return safeCity || safeAddress;
}

function getLocationPriority(location, query) {
  const locationValue = location.toLowerCase();
  const queryValue = query.toLowerCase();

  if (locationValue === queryValue) return 0;
  if (locationValue.startsWith(queryValue)) return 1;
  if (locationValue.includes(`, ${queryValue}`)) return 2;
  if (locationValue.includes(queryValue)) return 3;
  return 4;
}

router.get('/', async (req, res) => {
  try {
    const rawQuery = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (!rawQuery) return res.json([]);

    const pattern = new RegExp(escapeRegex(rawQuery), 'i');
    const listings = await Listing.find({
      available: true,
      approvalStatus: 'approved',
      $or: [
        { city: pattern },
        { address: pattern }
      ]
    })
      .select('city address')
      .limit(20)
      .lean();

    const uniqueLocations = new Map();

    listings.forEach((listing) => {
      [buildLocationLabel(listing.address, listing.city), listing.city?.trim()]
        .filter(Boolean)
        .forEach((location) => {
          const key = location.toLowerCase();
          if (!pattern.test(location) || uniqueLocations.has(key)) return;
          uniqueLocations.set(key, location);
        });
    });

    const suggestions = Array.from(uniqueLocations.values())
      .sort((left, right) => {
        const priorityDiff = getLocationPriority(left, rawQuery) - getLocationPriority(right, rawQuery);
        if (priorityDiff !== 0) return priorityDiff;
        if (left.length !== right.length) return left.length - right.length;
        return left.localeCompare(right);
      })
      .slice(0, 5);

    return res.json(suggestions);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to fetch search suggestions.', error: err.message });
  }
});

module.exports = router;
