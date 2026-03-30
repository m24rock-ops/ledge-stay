const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const auth = require('../middleware/auth');

function buildReviewSummary(reviews) {
  const totalReviews = reviews.length;
  const averageRating = totalReviews
    ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews).toFixed(1))
    : 0;

  return { totalReviews, averageRating, reviews };
}

async function getReviews(req, res, listingId) {
  try {
    if (!listingId) {
      return res.status(400).json({ message: 'listingId is required' });
    }

    const reviews = await Review.find({ listing: listingId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });

    res.json(buildReviewSummary(reviews));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function addReview(req, res, listingId) {
  try {
    const { rating, comment } = req.body;
    const parsedRating = Number(rating);
    const trimmedComment = String(comment || '').trim();

    if (!listingId) return res.status(400).json({ message: 'listingId is required' });
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number between 1 and 5' });
    }
    if (!trimmedComment) return res.status(400).json({ message: 'Comment is required' });

    const existing = await Review.findOne({
      listing: listingId,
      user: req.user.id
    });
    if (existing) return res.status(400).json({ message: 'You already reviewed this listing' });

    const review = await Review.create({
      listing: listingId,
      user: req.user.id,
      rating: parsedRating,
      comment: trimmedComment
    });

    const populated = await review.populate('user', 'name');
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'You already reviewed this listing' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// Get reviews for a listing
router.get('/', async (req, res) => {
  return getReviews(req, res, req.query.listingId);
});

router.get('/:listingId', async (req, res) => {
  return getReviews(req, res, req.params.listingId);
});

// Add review
router.post('/', auth, async (req, res) => {
  return addReview(req, res, req.body.listingId);
});

router.post('/:listingId', auth, async (req, res) => {
  return addReview(req, res, req.params.listingId);
});

// Delete review
router.delete('/:id', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (review.user.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorized' });
    await review.deleteOne();
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
