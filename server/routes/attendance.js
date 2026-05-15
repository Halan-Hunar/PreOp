const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

router.use(auth);
router.use(authorize('admin', 'receptionist'));

// GET /api/attendance — list attendance records
router.get('/', async (req, res) => {
  try {
    const { month, year, user_id } = req.query;

    let queryStr = `
      SELECT a.*, u.name as staff_name, u.role as staff_role,
             r.name as recorded_by_name,
             TIMEDIFF(a.time_out, a.time_in) as hours_worked
      FROM staff_attendance a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN users r ON a.recorded_by = r.id
      WHERE 1=1
    `;
    const params = [];

    if (month && year) {
      queryStr += ' AND MONTH(a.work_date) = ? AND YEAR(a.work_date) = ?';
      params.push(month, year);
    }

    if (user_id) {
      queryStr += ' AND a.user_id = ?';
      params.push(user_id);
    }

    queryStr += ' ORDER BY a.work_date DESC, u.name ASC';

    const [records] = await db.query(queryStr, params);
    res.json({ records });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/summary — monthly summary per staff member
router.get('/summary', async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    const [summary] = await db.query(`
      SELECT
        u.id as user_id,
        u.name as staff_name,
        u.role,
        COUNT(a.id) as days_present,
        SEC_TO_TIME(SUM(TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in)))) as total_hours,
        AVG(TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in))) / 3600 as avg_hours_per_day
      FROM users u
      LEFT JOIN staff_attendance a
        ON u.id = a.user_id
        AND MONTH(a.work_date) = ?
        AND YEAR(a.work_date) = ?
        AND a.time_out IS NOT NULL
      WHERE u.is_active = TRUE
      GROUP BY u.id, u.name, u.role
      ORDER BY u.name ASC
    `, [m, y]);

    res.json({ summary, month: m, year: y });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance — record clock in
router.post('/', [
  body('user_id').isInt(),
  body('work_date').isDate(),
  body('time_in').matches(/^\d{2}:\d{2}$/),
  body('notes').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { user_id, work_date, time_in, notes } = req.body;

    // Check user exists
    const [users] = await db.query('SELECT id FROM users WHERE id = ? AND is_active = TRUE', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Upsert — insert or update if record exists for that day
    await db.query(`
      INSERT INTO staff_attendance (user_id, work_date, time_in, notes, recorded_by)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE time_in = VALUES(time_in), notes = VALUES(notes), recorded_by = VALUES(recorded_by)
    `, [user_id, work_date, time_in, notes, req.user.id]);

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table) VALUES (?, ?, ?)',
      [req.user.id, 'record_clock_in', 'staff_attendance']
    );

    res.status(201).json({ message: 'Clock-in recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/attendance/:id/clockout — record clock out
router.put('/:id/clockout', [
  body('time_out').matches(/^\d{2}:\d{2}$/),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [records] = await db.query('SELECT * FROM staff_attendance WHERE id = ?', [req.params.id]);
    if (records.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    await db.query(
      'UPDATE staff_attendance SET time_out = ?, recorded_by = ? WHERE id = ?',
      [req.body.time_out, req.user.id, req.params.id]
    );

    res.json({ message: 'Clock-out recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/attendance/:id — full update
router.put('/:id', [
  body('time_in').optional().matches(/^\d{2}:\d{2}$/),
  body('time_out').optional().matches(/^\d{2}:\d{2}$/),
  body('notes').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [records] = await db.query('SELECT * FROM staff_attendance WHERE id = ?', [req.params.id]);
    if (records.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const allowed = ['time_in', 'time_out', 'notes'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    await db.query(
      `UPDATE staff_attendance SET ${fields}, recorded_by = ? WHERE id = ?`,
      [...Object.values(updates), req.user.id, req.params.id]
    );

    res.json({ message: 'Attendance record updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
