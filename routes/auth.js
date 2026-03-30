const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidEmail(email) {
  // Basic email check: must contain @ and .
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function isValidPassword(pw) {
  const s = String(pw || '');
  const hasMinLen = s.length >= 8;
  const hasNumber = /\d/.test(s);
  const hasLetter = /[A-Za-z]/.test(s);
  return hasMinLen && hasNumber && hasLetter;
}

function isValidName(name) {
  const s = String(name || '').trim();
  return /^[A-Za-z ]+$/.test(s) && s.replace(/\s/g, '').length >= 2;
}

async function registerHandler(req, res) {
  try {
    const { name, email, password, role } = req.body;

    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim();
    const normalizedEmail = trimmedEmail.toLowerCase();

    if (!trimmedName || !trimmedEmail || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!isValidName(trimmedName)) {
      return res.status(400).json({ message: 'Please enter a valid name' });
    }

    if (!isValidEmail(trimmedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ message: 'Password must be 8+ characters with letters and numbers' });
    }

    if (!['tenant', 'owner'].includes(String(role || ''))) {
      return res.status(400).json({ message: 'Please select a valid account type' });
    }

    const safeRole = role;

    // Case-insensitive email lookup for existing users
    const existing = await User.findOne({
      email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' }
    });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashed,
      role: safeRole
    });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function loginHandler(req, res) {
  try {
    const { email, password } = req.body;

    const trimmedEmail = String(email || '').trim();
    const normalizedEmail = trimmedEmail.toLowerCase();

    if (!trimmedEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({
      email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' }
    });
    if (!user) return res.status(400).json({ message: 'Email not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Incorrect password' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

router.route('/register')
  .post(registerHandler)
  .all((req, res) => res.status(405).json({ message: 'Method not allowed' }));

router.route('/login')
  .post(loginHandler)
  .all((req, res) => res.status(405).json({ message: 'Method not allowed' }));

module.exports = router;
