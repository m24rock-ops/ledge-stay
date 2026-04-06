const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const otpStore = new Map();

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function isValidPhone(phone) {
  return /^\+?\d{10,15}$/.test(normalizePhone(phone));
}

function isValidPassword(password) {
  const value = String(password || '');
  return value.length >= 8 && /\d/.test(value) && /[A-Za-z]/.test(value);
}

function isValidName(name) {
  const value = String(name || '').trim();
  return /^[A-Za-z ]+$/.test(value) && value.replace(/\s/g, '').length >= 2;
}

function isValidRole(role) {
  return ['tenant', 'owner'].includes(String(role || ''));
}

function pruneExpiredOtps() {
  const now = Date.now();

  for (const [phone, record] of otpStore.entries()) {
    if (record.expiresAt <= now) {
      otpStore.delete(phone);
    }
  }
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function signAuthToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function buildAuthResponse(user) {
  return {
    token: signAuthToken(user),
    user: {
      id: user._id,
      name: user.name,
      email: user.email || null,
      phone: user.phone || null,
      role: user.role
    }
  };
}

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return User.findOne({
    email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' }
  });
}

async function continueHandler(req, res) {
  try {
    pruneExpiredOtps();

    const identifier = String(req.body.identifier || '').trim();
    const password = String(req.body.password || '');

    if (!identifier) {
      return res.status(400).json({ message: 'Email or phone is required.' });
    }

    if (isValidEmail(identifier)) {
      if (!password) {
        return res.status(400).json({ message: 'Password is required for email login.' });
      }

      const user = await findUserByEmail(identifier);
      if (!user) {
        return res.json({ type: 'new_user_email' });
      }

      if (!user.password) {
        return res.status(400).json({ message: 'This account uses phone login. Continue with your phone number.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect password.' });
      }

      return res.json(buildAuthResponse(user));
    }

    const phone = normalizePhone(identifier);
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Please enter a valid email or phone number.' });
    }

    const otp = generateOtp();
    otpStore.set(phone, {
      otp,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0
    });

    console.log(`[auth] OTP for ${phone}: ${otp}`);

    return res.json({
      type: 'otp_sent',
      expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000)
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function verifyOtpHandler(req, res) {
  try {
    pruneExpiredOtps();

    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || '').trim();
    const name = String(req.body.name || '').trim();
    const role = String(req.body.role || 'tenant');

    if (!isValidPhone(phone) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'Valid phone and OTP are required.' });
    }

    const record = otpStore.get(phone);
    if (!record) {
      return res.status(400).json({ message: 'OTP expired or not found. Please request a new one.' });
    }

    if (record.expiresAt <= Date.now()) {
      otpStore.delete(phone);
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      otpStore.delete(phone);
      return res.status(429).json({ message: 'Too many incorrect OTP attempts. Please request a new OTP.' });
    }

    if (record.otp !== otp) {
      record.attempts += 1;
      otpStore.set(phone, record);

      const remainingAttempts = Math.max(OTP_MAX_ATTEMPTS - record.attempts, 0);
      if (remainingAttempts === 0) {
        otpStore.delete(phone);
        return res.status(429).json({ message: 'Too many incorrect OTP attempts. Please request a new OTP.' });
      }

      return res.status(400).json({ message: `Incorrect OTP. ${remainingAttempts} attempt(s) remaining.` });
    }

    otpStore.delete(phone);

    let user = await User.findOne({ phone });

    if (!user) {
      if (!isValidName(name)) {
        return res.status(400).json({ message: 'Please enter your full name to finish account setup.' });
      }

      if (!isValidRole(role)) {
        return res.status(400).json({ message: 'Please choose a valid account type.' });
      }

      user = await User.create({
        name,
        phone,
        role
      });
    }

    return res.json(buildAuthResponse(user));
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function registerEmailHandler(req, res) {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const role = String(req.body.role || '');

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required.' });
    }

    if (!isValidName(name)) {
      return res.status(400).json({ message: 'Please enter a valid name.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ message: 'Password must be 8+ characters with letters and numbers.' });
    }

    if (!isValidRole(role)) {
      return res.status(400).json({ message: 'Please select a valid account type.' });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role
    });

    return res.json(buildAuthResponse(user));
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}

router.post('/continue', continueHandler);
router.post('/verify-otp', verifyOtpHandler);
router.post('/register-email', registerEmailHandler);

// Backward-compatible aliases for any older clients still hitting split endpoints.
router.post('/login', (req, res) => {
  req.body.identifier = req.body.email;
  return continueHandler(req, res);
});

router.post('/register', registerEmailHandler);

router.post('/forgot-password', async (req, res) => {
  try {
    console.log('STEP 1: API HIT');
    const email = normalizeEmail(req.body.email);
    console.log('[auth] forgot-password request for:', email || '(empty)');

    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await findUserByEmail(email);

    if (!user || !user.email) {
      console.log('[auth] forgot-password: no account found for:', email);
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    console.log('[auth] forgot-password: token generated for user', String(user._id));
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const appBaseUrl = String(process.env.APP_BASE_URL || 'https://ledge-stay.up.railway.app').replace(/\/$/, '');
    const resetUrl = `${appBaseUrl}/reset-password?token=${token}`;
    const emailResult = await sendPasswordResetEmail({
      toEmail: user.email,
      resetUrl,
      userName: user.name || 'there'
    });

    console.log('STEP 2: EMAIL RESPONSE', emailResult);

    if (emailResult.ok) {
      console.log('[auth] forgot-password: reset email sent to', user.email, '| resend id:', emailResult.id || 'n/a');
    } else {
      console.warn('[auth] forgot-password: reset email NOT delivered', {
        userId: String(user._id),
        email: user.email,
        skipped: emailResult.skipped || false,
        issues: emailResult.issues || [],
        hint: emailResult.hint || '',
        error: emailResult.error || ''
      });
    }

    return res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('[auth] forgot-password error:', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and new password are required' });

    if (!isValidPassword(password)) {
      return res.status(400).json({ message: 'Password must be 8+ characters with letters and numbers' });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ message: 'Reset link is invalid or has expired' });

    user.password = await bcrypt.hash(password, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
