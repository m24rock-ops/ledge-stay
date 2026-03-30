const mongoose = require('mongoose');

const adminActionSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['approved', 'rejected'], required: true },
  note: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('AdminAction', adminActionSchema);
