const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('Missing MONGO_URI in environment/.env');
    process.exit(1);
  }

  // Import after env load so mongoose model initialization is consistent.
  const Listing = require('../models/Listing');

  await mongoose.connect(mongoUri);

  const filter = {
    $or: [
      { approvalStatus: { $in: [null, '', 'pending'] } },
      { approvalStatus: { $exists: false } }
    ]
  };

  const before = await Listing.countDocuments({ approvalStatus: 'approved' });
  const pendingToApprove = await Listing.countDocuments(filter);

  const res = await Listing.updateMany(filter, {
    $set: { approvalStatus: 'approved', rejectionNote: '' }
  });

  const after = await Listing.countDocuments({ approvalStatus: 'approved' });

  console.log('Listing approval migration complete');
  console.log({ approvedBefore: before, pendingMatched: pendingToApprove });
  console.log({
    matchedCount: res.matchedCount ?? pendingToApprove,
    modifiedCount: res.modifiedCount ?? undefined,
    approvedAfter: after
  });

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

