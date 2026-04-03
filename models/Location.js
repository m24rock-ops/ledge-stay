const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, default: '', trim: true },
  uniqueKey: { type: String, required: true, unique: true, trim: true },
  normalizedName: { type: String, required: true, trim: true },
  normalizedCity: { type: String, required: true, trim: true },
  normalizedState: { type: String, default: '', trim: true },
  normalizedFullText: { type: String, required: true, trim: true },
  trigrams: [{ type: String }],
  listingCount: { type: Number, default: 0, min: 0 },
  searchCount: { type: Number, default: 0, min: 0 },
  popularityScore: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  lastListingAt: { type: Date, default: Date.now },
  lastSearchedAt: { type: Date, default: null }
}, { timestamps: true });

locationSchema.index({ uniqueKey: 1 }, { unique: true });
locationSchema.index({ normalizedName: 1 });
locationSchema.index({ normalizedCity: 1 });
locationSchema.index({ normalizedState: 1 });
locationSchema.index({ normalizedFullText: 1 });
locationSchema.index({ isActive: 1, popularityScore: -1, listingCount: -1, searchCount: -1 });
locationSchema.index({ trigrams: 1 });

module.exports = mongoose.model('Location', locationSchema);
