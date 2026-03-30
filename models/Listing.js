const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['pg', 'hostel', 'apartment', 'room'], required: true },
  city: { type: String, required: true },
  address: { type: String, required: true },
  price: { type: Number, required: true },
  gender: { type: String, enum: ['male', 'female', 'any'], default: 'any' },
  amenities: [String],
  photos: [String],
  description: { type: String },
  enquiryCount: { type: Number, default: 0 },
  is_featured: { type: Boolean, default: false },
  available: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Listing', listingSchema);
