const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['pg', 'hostel', 'apartment', 'room'], required: true },
  city: { type: String, required: true },
  state: { type: String, default: '' },
  address: { type: String, required: true },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  price: { type: Number, required: true },
  gender: { type: String, enum: ['male', 'female', 'any'], default: 'any' },
  amenities: [String],
  photos: [String],
  description: { type: String },
  contact: { type: String, default: '' },
  enquiryCount: { type: Number, default: 0 },
  is_featured: { type: Boolean, default: false },
  available: { type: Boolean, default: true },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionNote: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  noBrokerage: { type: Boolean, default: false },
  verified: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

listingSchema.virtual('images').get(function imagesVirtual() {
  return Array.isArray(this.photos)
    ? this.photos.filter(Boolean).map((url) => ({ url }))
    : [];
});

listingSchema.index({ approvalStatus: 1, available: 1, city: 1 });
listingSchema.index({ approvalStatus: 1, available: 1, state: 1 });
listingSchema.index({ approvalStatus: 1, available: 1, address: 1 });

module.exports = mongoose.model('Listing', listingSchema);
