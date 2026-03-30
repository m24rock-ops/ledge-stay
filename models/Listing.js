const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['pg', 'hostel', 'apartment', 'room'], required: true },
  city: { type: String, required: true },
  address: { type: String, required: true },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  price: { type: Number, required: true },
  gender: { type: String, enum: ['male', 'female', 'any'], default: 'any' },
  amenities: [String],
  photos: [String],
  description: { type: String },
  enquiryCount: { type: Number, default: 0 },
  is_featured: { type: Boolean, default: false },
  available: { type: Boolean, default: true },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    // Default to approved so listings show up immediately on browse.
    default: 'approved'
  },
  rejectionNote: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Listing', listingSchema);
