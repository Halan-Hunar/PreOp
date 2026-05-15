const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

router.use(auth);

// GET /api/users — list all staff (admin only)
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users — create staff account (admin only)
router.post('/', authorize('admin'), [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['admin', 'receptionist', 'nurse', 'anaesthetist']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password, role } = req.body;

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, password_hash, role]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'create_user', 'users', result.insertId]
    );

    res.status(201).json({ message: 'User created', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id — update user (admin only)
router.put('/:id', authorize('admin'), [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'receptionist', 'nurse', 'anaesthetist']),
  body('is_active').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [users] = await db.query('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const allowed = ['name', 'email', 'role', 'is_active'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await db.query(`UPDATE users SET ${fields} WHERE id = ?`, values);

    // If deactivated, kill all their sessions
    if (updates.is_active === false || updates.is_active === 'false') {
      await db.query('DELETE FROM sessions WHERE user_id = ?', [req.params.id]);
    }

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'update_user', 'users', req.params.id]
    );

    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/me/password — change own password
router.put('/me/password', [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    const valid = await bcrypt.compare(req.body.current_password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const password_hash = await bcrypt.hash(req.body.new_password, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.user.id]);

    // Kill all other sessions
    await db.query('DELETE FROM sessions WHERE user_id = ?', [req.user.id]);

    res.json({ message: 'Password changed. Please log in again.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/activity-logs — view logs (admin only)
router.get('/activity-logs', authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [logs] = await db.query(
      `SELECT l.*, u.name as user_name, u.role as user_role
       FROM activity_logs l
       LEFT JOIN users u ON l.user_id = u.id
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );

    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
