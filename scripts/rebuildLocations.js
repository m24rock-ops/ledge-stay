const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Listing = require('../models/Listing');
const { rebuildLocationsFromListings } = require('../services/locationSearch');

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const result = await rebuildLocationsFromListings(Listing);
  console.log(`Rebuilt ${result.totalLocations} locations from ${result.totalListings} approved listings.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore disconnect errors during shutdown
  }
  process.exit(1);
});
