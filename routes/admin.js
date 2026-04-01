const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Listing = require('../models/Listing');
const AdminAction = require('../models/AdminAction');
const Notification = require('../models/Notification');

router.use(auth);

router.use((req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can access this section' });
  }
  next();
});

router.get('/listings', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const query = {};

    if (status !== 'all') {
      query.approvalStatus = status;
    }

    const listings = await Listing.find(query)
      .populate('owner', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    const logs = await AdminAction.find()
      .populate('admin', 'name email')
      .populate('owner', 'name email')
      .populate('listing', 'title')
      .sort({ createdAt: -1 })
      .limit(20);

    const counts = {
      all: await Listing.countDocuments(),
      pending: await Listing.countDocuments({ approvalStatus: 'pending' }),
      approved: await Listing.countDocuments({ approvalStatus: 'approved' }),
      rejected: await Listing.countDocuments({ approvalStatus: 'rejected' })
    };

    res.json({ listings, logs, counts, activeFilter: status });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.patch('/listings/:id/review', async (req, res) => {
  try {
    const { action, note = '' } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be approve or reject' });
    }

    const listing = await Listing.findById(req.params.id).populate('owner', 'name email');
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    const normalizedNote = String(note || '').trim();

    if (action === 'approve') {
      listing.approvalStatus = 'approved';
      listing.rejectionNote = '';
    } else {
      listing.approvalStatus = 'rejected';
      listing.rejectionNote = normalizedNote;
    }

    listing.reviewedBy = req.user.id;
    listing.reviewedAt = new Date();
    await listing.save();

    await AdminAction.create({
      admin: req.user.id,
      listing: listing._id,
      owner: listing.owner._id,
      action: action === 'approve' ? 'approved' : 'rejected',
      note: normalizedNote
    });

    await Notification.create({
      user: listing.owner._id,
      listing: listing._id,
      type: action === 'approve' ? 'listing_approved' : 'listing_rejected',
      title: action === 'approve' ? 'Listing approved' : 'Listing rejected',
      message: action === 'approve'
        ? `"${listing.title}" is now live and visible to tenants.`
        : `"${listing.title}" was rejected.${normalizedNote ? ` Reason: ${normalizedNote}` : ''}`
    });

    res.json({
      message: `Listing ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      listing
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
