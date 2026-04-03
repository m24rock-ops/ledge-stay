const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, unique: true, sparse: true, trim: true, lowercase: true, default: null },
  phone: { type: String, unique: true, sparse: true, trim: true, default: null },
  password: { type: String, default: null },
  role: { type: String, enum: ['tenant', 'owner', 'admin'], default: 'tenant' },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
