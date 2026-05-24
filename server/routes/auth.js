const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// Store SHA-256(token) in the sessions table instead of the raw JWT.
// If the DB ever leaks, the hash isn't directly replayable as a bearer token.
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { email, password } = req.body;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];

  try {
    // Check failed attempts in last 15 mins
    const [attempts] = await db.query(
      `SELECT COUNT(*) as count FROM failed_logins
       WHERE ip_address = ? AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
      [ip]
    );

    if (attempts[0].count >= 10) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
    }

    // Find user
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      await db.query('INSERT INTO failed_logins (email, ip_address) VALUES (?, ?)', [email, ip]);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await db.query('INSERT INTO failed_logins (email, ip_address) VALUES (?, ?)', [email, ip]);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    // Store session
    await db.query(
      'INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, hashToken(token), ip, userAgent, expiresAt]
    );

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (user_id, action, ip_address, user_agent) VALUES (?, ?, ?, ?)',
      [user.id, 'login', ip, userAgent]
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    await db.query('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);

    await db.query(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [req.user.id, 'logout']
    );

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
