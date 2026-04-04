const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true }
}, { timestamps: true });

wishlistSchema.index({ userId: 1, listingId: 1 }, { unique: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);
