const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

router.use(auth);

// GET /api/appointments — list with filters
router.get('/', async (req, res) => {
  try {
    const { date, status, patient_id, doctor_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT a.*, p.full_name as patient_name, p.national_id,
             u.name as doctor_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u ON a.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    // Anaesthetists only see appointments assigned to them.
    if (req.user.role === 'anaesthetist') {
      queryStr += ' AND a.assigned_to = ?';
      params.push(req.user.id);
    }

    if (date) { queryStr += ' AND a.scheduled_date = ?'; params.push(date); }
    if (status) { queryStr += ' AND a.status = ?'; params.push(status); }
    if (patient_id) { queryStr += ' AND a.patient_id = ?'; params.push(patient_id); }
    if (doctor_id) { queryStr += ' AND a.assigned_to = ?'; params.push(doctor_id); }

    queryStr += ' ORDER BY a.scheduled_date ASC, a.scheduled_time ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [appointments] = await db.query(queryStr, params);
    res.json({ appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/appointments/today — today's schedule
router.get('/today', async (req, res) => {
  try {
    let queryStr = `
      SELECT a.*, p.full_name as patient_name, p.national_id, p.blood_type,
             u.name as doctor_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u ON a.assigned_to = u.id
      WHERE a.scheduled_date = CURDATE()
    `;
    const params = [];

    if (req.user.role === 'anaesthetist') {
      queryStr += ' AND a.assigned_to = ?';
      params.push(req.user.id);
    }

    queryStr += ' ORDER BY a.scheduled_time ASC';

    const [appointments] = await db.query(queryStr, params);
    res.json({ appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/appointments/:id
router.get('/:id', async (req, res) => {
  try {
    const [appointments] = await db.query(
      `SELECT a.*, p.full_name as patient_name, u.name as doctor_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.id = ?`,
      [req.params.id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Anaesthetists can only view appointments assigned to them.
    if (req.user.role === 'anaesthetist' && appointments[0].assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'This appointment is not assigned to you' });
    }

    res.json({ appointment: appointments[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/appointments — create
router.post('/', authorize('admin', 'receptionist', 'nurse'), [
  body('patient_id').isInt(),
  body('assigned_to').isInt(),
  body('scheduled_date').isDate(),
  body('scheduled_time').matches(/^\d{2}:\d{2}$/),
  body('surgery_type').optional().trim(),
  body('notes').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { patient_id, assigned_to, scheduled_date, scheduled_time, surgery_type, notes } = req.body;

    // Check patient exists
    const [patients] = await db.query('SELECT id FROM patients WHERE id = ? AND is_active = TRUE', [patient_id]);
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check doctor exists and is anaesthetist
    const [doctors] = await db.query(
      "SELECT id FROM users WHERE id = ? AND role = 'anaesthetist' AND is_active = TRUE",
      [assigned_to]
    );
    if (doctors.length === 0) {
      return res.status(404).json({ error: 'Anaesthetist not found' });
    }

    // Check for time conflict
    const [conflict] = await db.query(
      `SELECT id FROM appointments
       WHERE assigned_to = ? AND scheduled_date = ? AND scheduled_time = ? AND status = 'scheduled'`,
      [assigned_to, scheduled_date, scheduled_time]
    );
    if (conflict.length > 0) {
      return res.status(409).json({ error: 'Time slot already booked for this doctor' });
    }

    const [result] = await db.query(
      `INSERT INTO appointments (patient_id, assigned_to, scheduled_date, scheduled_time, surgery_type, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [patient_id, assigned_to, scheduled_date, scheduled_time, surgery_type, notes, req.user.id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'create_appointment', 'appointments', result.insertId]
    );

    res.status(201).json({ message: 'Appointment created', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/appointments/:id — update/cancel
router.put('/:id', authorize('admin', 'receptionist', 'nurse'), [
  body('scheduled_date').optional().isDate(),
  body('scheduled_time').optional().matches(/^\d{2}:\d{2}$/),
  body('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']),
  body('cancellation_reason').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [appointments] = await db.query('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if (appointments.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const allowed = ['scheduled_date', 'scheduled_time', 'surgery_type', 'status', 'cancellation_reason', 'notes'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await db.query(`UPDATE appointments SET ${fields} WHERE id = ?`, values);

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'update_appointment', 'appointments', req.params.id]
    );

    res.json({ message: 'Appointment updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
