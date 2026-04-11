const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function runMigration() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is required to run migration.');
    }

    await mongoose.connect(process.env.MONGO_URI);
    const collection = mongoose.connection.collection('listings');

    const result = await collection.updateMany(
      { approvalStatus: { $exists: false } },
      { $set: { approvalStatus: 'approved' } }
    );

    console.log(`[migrateApprovalStatus] Updated ${result.modifiedCount} listing(s).`);
    process.exit(0);
  } catch (error) {
    console.error('[migrateApprovalStatus] Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
