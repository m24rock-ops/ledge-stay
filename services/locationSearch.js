const Location = require('../models/Location');

function cleanText(value) {
  return String(value ?? '').trim();
}

function normalizeText(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createTrigrams(value) {
  const normalized = normalizeText(value).replace(/\s+/g, ' ');
  if (!normalized) return [];

  const padded = `  ${normalized} `;
  const set = new Set();

  for (let index = 0; index < padded.length - 2; index += 1) {
    const gram = padded.slice(index, index + 3);
    if (gram.trim()) set.add(gram);
  }

  return Array.from(set);
}

function levenshteinDistance(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);

  if (!a) return b.length;
  if (!b) return a.length;

  const previous = new Array(b.length + 1).fill(0);
  const current = new Array(b.length + 1).fill(0);

  for (let j = 0; j <= b.length; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function similarityScore(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);

  if (!a || !b) return 0;
  if (a === b) return 1;

  const distance = levenshteinDistance(a, b);
  return Math.max(0, 1 - distance / Math.max(a.length, b.length));
}

function trigramOverlapScore(queryTrigrams, candidateTrigrams) {
  if (!queryTrigrams.length || !candidateTrigrams.length) return 0;
  const candidateSet = new Set(candidateTrigrams);
  const overlapCount = queryTrigrams.filter((gram) => candidateSet.has(gram)).length;
  return overlapCount / Math.max(queryTrigrams.length, candidateTrigrams.length);
}

function extractStateFromAddress(address) {
  const segments = cleanText(address)
    .split(',')
    .map((part) => cleanText(part))
    .filter(Boolean);

  if (segments.length < 2) return '';

  const stateCandidate = segments[segments.length - 1];
  if (/^india$/i.test(stateCandidate)) {
    return segments[segments.length - 2] || '';
  }

  return stateCandidate;
}

function buildLocationPayload(input = {}) {
  const name = cleanText(input.name || input.address || input.city);
  const city = cleanText(input.city);
  const state = cleanText(input.state || extractStateFromAddress(input.address));

  if (!name || !city) return null;

  const normalizedName = normalizeText(name);
  const normalizedCity = normalizeText(city);
  const normalizedState = normalizeText(state);
  const normalizedFullText = [normalizedName, normalizedCity, normalizedState].filter(Boolean).join(' ');
  const uniqueKey = [normalizedName, normalizedCity, normalizedState].join('|');

  return {
    name,
    city,
    state,
    uniqueKey,
    normalizedName,
    normalizedCity,
    normalizedState,
    normalizedFullText,
    trigrams: createTrigrams(normalizedFullText)
  };
}

function isSearchableListing(listing) {
  return Boolean(
    listing &&
    listing.available === true &&
    cleanText(listing.city) &&
    cleanText(listing.address || listing.city)
  );
}

function payloadFromListing(listing) {
  if (!isSearchableListing(listing)) return null;

  return buildLocationPayload({
    name: listing.address,
    address: listing.address,
    city: listing.city,
    state: listing.state
  });
}

function toStructuredLocation(location) {
  return {
    name: location.name,
    city: location.city,
    state: location.state || ''
  };
}

async function incrementLocation(payload, amount = 1) {
  if (!payload || amount <= 0) return;

  await Location.findOneAndUpdate(
    { uniqueKey: payload.uniqueKey },
    {
      $set: {
        name: payload.name,
        city: payload.city,
        state: payload.state,
        normalizedName: payload.normalizedName,
        normalizedCity: payload.normalizedCity,
        normalizedState: payload.normalizedState,
        normalizedFullText: payload.normalizedFullText,
        trigrams: payload.trigrams,
        isActive: true,
        lastListingAt: new Date()
      },
      $setOnInsert: {
        searchCount: 0
      },
      $inc: {
        listingCount: amount,
        popularityScore: amount * 10
      }
    },
    { upsert: true, new: true }
  );
}

async function decrementLocation(payload, amount = 1) {
  if (!payload || amount <= 0) return;

  const location = await Location.findOneAndUpdate(
    { uniqueKey: payload.uniqueKey },
    {
      $inc: {
        listingCount: -amount,
        popularityScore: -(amount * 10)
      }
    },
    { new: true }
  );

  if (!location) return;

  const nextListingCount = Math.max(0, Number(location.listingCount || 0));
  const nextPopularity = Math.max(0, Number(location.popularityScore || 0));
  const nextActive = nextListingCount > 0;
  const shouldDelete = nextListingCount <= 0 && Number(location.searchCount || 0) <= 0;

  if (shouldDelete) {
    await Location.deleteOne({ _id: location._id });
    return;
  }

  if (
    location.listingCount !== nextListingCount ||
    location.popularityScore !== nextPopularity ||
    location.isActive !== nextActive
  ) {
    await Location.updateOne(
      { _id: location._id },
      {
        $set: {
          listingCount: nextListingCount,
          popularityScore: nextPopularity,
          isActive: nextActive
        }
      }
    );
  }
}

async function syncLocationForListingChange(previousListing, nextListing) {
  const previousPayload = payloadFromListing(previousListing);
  const nextPayload = payloadFromListing(nextListing);

  if (previousPayload?.uniqueKey && nextPayload?.uniqueKey && previousPayload.uniqueKey === nextPayload.uniqueKey) {
    await Location.findOneAndUpdate(
      { uniqueKey: nextPayload.uniqueKey },
      {
        $set: {
          name: nextPayload.name,
          city: nextPayload.city,
          state: nextPayload.state,
          normalizedName: nextPayload.normalizedName,
          normalizedCity: nextPayload.normalizedCity,
          normalizedState: nextPayload.normalizedState,
          normalizedFullText: nextPayload.normalizedFullText,
          trigrams: nextPayload.trigrams,
          isActive: true,
          lastListingAt: new Date()
        }
      }
    );
    return;
  }

  if (previousPayload) await decrementLocation(previousPayload);
  if (nextPayload) await incrementLocation(nextPayload);
}

function buildSearchRegex(query) {
  return new RegExp(escapeRegex(normalizeText(query)), 'i');
}

function scoreLocationMatch(query, queryTrigrams, candidate) {
  const normalizedQuery = normalizeText(query);
  const fields = [
    candidate.normalizedName,
    candidate.normalizedCity,
    candidate.normalizedState,
    candidate.normalizedFullText
  ].filter(Boolean);

  const exactMatchBoost = fields.some((field) => field === normalizedQuery) ? 140 : 0;
  const prefixBoost = fields.some((field) => field.startsWith(normalizedQuery)) ? 90 : 0;
  const containsBoost = fields.some((field) => field.includes(normalizedQuery)) ? 45 : 0;
  const bestSimilarity = Math.max(...fields.map((field) => similarityScore(normalizedQuery, field)), 0);
  const trigramScore = trigramOverlapScore(queryTrigrams, candidate.trigrams || []);
  const popularityBoost = Math.log1p(candidate.listingCount || 0) * 18 + Math.log1p(candidate.searchCount || 0) * 8;

  return exactMatchBoost +
    prefixBoost +
    containsBoost +
    (bestSimilarity * 100) +
    (trigramScore * 70) +
    popularityBoost;
}

async function searchLocations(rawQuery, limit = 5) {
  const query = cleanText(rawQuery);
  if (!query) return [];

  const normalizedQuery = normalizeText(query);
  const queryTrigrams = createTrigrams(normalizedQuery);
  const regex = buildSearchRegex(normalizedQuery);

  let candidates = await Location.find({
    isActive: true,
    $or: [
      { normalizedName: regex },
      { normalizedCity: regex },
      { normalizedState: regex },
      { normalizedFullText: regex },
      { trigrams: { $in: queryTrigrams } }
    ]
  })
    .sort({ popularityScore: -1, listingCount: -1, searchCount: -1, updatedAt: -1 })
    .limit(60)
    .lean();

  if (!candidates.length) {
    candidates = await Location.find({ isActive: true })
      .sort({ popularityScore: -1, listingCount: -1, searchCount: -1, updatedAt: -1 })
      .limit(120)
      .lean();
  }

  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreLocationMatch(normalizedQuery, queryTrigrams, candidate)
    }))
    .filter(({ score }) => score > 15)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if ((right.candidate.popularityScore || 0) !== (left.candidate.popularityScore || 0)) {
        return (right.candidate.popularityScore || 0) - (left.candidate.popularityScore || 0);
      }
      return left.candidate.name.localeCompare(right.candidate.name);
    })
    .slice(0, Math.max(1, Math.min(Number(limit) || 5, 10)))
    .map(({ candidate }) => toStructuredLocation(candidate));
}

async function rebuildLocationsFromListings(ListingModel) {
  const listings = await ListingModel.find({
    available: true,
    approvalStatus: 'approved'
  })
    .select('address city state available approvalStatus')
    .lean();

  const counts = new Map();

  listings.forEach((listing) => {
    const payload = payloadFromListing(listing);
    if (!payload) return;

    const existing = counts.get(payload.uniqueKey);
    if (existing) {
      existing.listingCount += 1;
      return;
    }

    counts.set(payload.uniqueKey, {
      ...payload,
      listingCount: 1
    });
  });

  await Location.deleteMany({});

  if (!counts.size) return { totalLocations: 0, totalListings: listings.length };

  await Location.insertMany(
    Array.from(counts.values()).map((payload) => ({
      ...payload,
      searchCount: 0,
      popularityScore: payload.listingCount * 10,
      isActive: true,
      lastListingAt: new Date()
    })),
    { ordered: false }
  );

  return {
    totalLocations: counts.size,
    totalListings: listings.length
  };
}

module.exports = {
  buildLocationPayload,
  normalizeText,
  searchLocations,
  syncLocationForListingChange,
  rebuildLocationsFromListings,
  toStructuredLocation
};
