const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Enquiry = require('../models/Enquiry');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { sendEnquiryNotificationToOwner, sendEnquiryConfirmationToTenant } = require('../services/email');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

router.use(auth);

router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'tenant') {
      return res.status(403).json({ message: 'Only tenants can send enquiries' });
    }

    const { listingId, name, email, message } = req.body;
    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedMessage = String(message || '').trim();

    if (!listingId) {
      return res.status(400).json({ message: 'Listing ID is required' });
    }

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      return res.status(400).json({ message: 'Name, email, and message are required' });
    }

    if (!isValidEmail(trimmedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    if (String(listing.owner) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot send an enquiry to your own listing' });
    }

    // Prevent duplicate enquiries from the same tenant on the same listing
    const existing = await Enquiry.findOne({ listing: listing._id, tenant: req.user.id });
    if (existing) {
      return res.status(400).json({ message: 'You have already sent an enquiry for this listing' });
    }

    const enquiry = await Enquiry.create({
      listing: listing._id,
      owner: listing.owner,
      tenant: req.user.id,
      name: trimmedName,
      email: trimmedEmail,
      message: trimmedMessage
    });

    listing.enquiryCount = Number(listing.enquiryCount || 0) + 1;
    await listing.save();

    // Send emails — failures are caught inside the service and never throw
    const owner = await User.findById(listing.owner).select('name email');
    if (owner) {
      sendEnquiryNotificationToOwner({
        ownerEmail: owner.email,
        ownerName: owner.name,
        tenantName: trimmedName,
        tenantEmail: trimmedEmail,
        message: trimmedMessage,
        listingTitle: listing.title,
        listingId: listing._id
      });
    }

    sendEnquiryConfirmationToTenant({
      tenantEmail: trimmedEmail,
      tenantName: trimmedName,
      listingTitle: listing.title,
      listingId: listing._id
    });

    res.status(201).json({
      message: 'Enquiry sent successfully',
      enquiry
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/owner', async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can view enquiries' });
    }

    const enquiries = await Enquiry.find({ owner: req.user.id })
      .populate('listing', 'title city address')
      .populate('tenant', 'name email')
      .sort({ createdAt: -1 });

    const summary = {
      totalEnquiries: enquiries.length,
      unreadEnquiries: enquiries.filter((enquiry) => !enquiry.isRead).length
    };

    res.json({ enquiries, summary });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can manage enquiries' });
    }

    const { isRead } = req.body;
    if (typeof isRead !== 'boolean') {
      return res.status(400).json({ message: 'Read status must be true or false' });
    }

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    if (String(enquiry.owner) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to update this enquiry' });
    }

    enquiry.isRead = isRead;
    await enquiry.save();

    res.json({
      message: `Enquiry marked as ${isRead ? 'read' : 'unread'}`,
      enquiry
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
