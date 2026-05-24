const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// All routes require auth
router.use(auth);

// GET /api/patients — list all patients with search/filter
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT id, full_name, dob, gender, blood_type, national_id, phone, email,
             assigned_doctor_id, created_at
      FROM patients WHERE is_active = TRUE
    `;
    const params = [];

    // Anaesthetists only see patients explicitly assigned to them.
    if (req.user.role === 'anaesthetist') {
      queryStr += ' AND assigned_doctor_id = ?';
      params.push(req.user.id);
    }

    if (search) {
      queryStr += ` AND (full_name LIKE ? OR national_id LIKE ? OR phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    queryStr += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [patients] = await db.query(queryStr, params);

    // Total count for pagination — must apply the same filters
    let countStr = 'SELECT COUNT(*) as total FROM patients WHERE is_active = TRUE';
    const countParams = [];
    if (req.user.role === 'anaesthetist') {
      countStr += ' AND assigned_doctor_id = ?';
      countParams.push(req.user.id);
    }
    if (search) {
      countStr += ' AND (full_name LIKE ? OR national_id LIKE ? OR phone LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const [countResult] = await db.query(countStr, countParams);

    res.json({
      patients,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/patients/:id — single patient with full history
router.get('/:id', async (req, res) => {
  try {
    const [patients] = await db.query(
      `SELECT p.*, u.name as assigned_doctor_name
       FROM patients p
       LEFT JOIN users u ON p.assigned_doctor_id = u.id
       WHERE p.id = ? AND p.is_active = TRUE`,
      [req.params.id]
    );

    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patients[0];

    // Anaesthetists can only view full details of their assigned patients
    if (req.user.role === 'anaesthetist' && patient.assigned_doctor_id !== req.user.id) {
      return res.status(403).json({ error: 'This patient is not assigned to you' });
    }

    // Get appointments
    const [appointments] = await db.query(
      `SELECT a.*, u.name as doctor_name
       FROM appointments a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.patient_id = ?
       ORDER BY a.scheduled_date DESC`,
      [patient.id]
    );

    // Receptionists don't see assessments or clearances
    if (req.user.role === 'receptionist' || req.user.role === 'nurse') {
      return res.json({ patient, appointments, assessments: [], clearances: [] });
    }

    // Get assessments summary
    const [assessments] = await db.query(
      `SELECT id, status, asa_classification, anaesthetic_plan, created_at, submitted_at
       FROM assessments WHERE patient_id = ?
       ORDER BY created_at DESC`,
      [patient.id]
    );

    // Get clearances
    const [clearances] = await db.query(
      `SELECT c.*, u.name as decided_by_name
       FROM clearances c
       LEFT JOIN users u ON c.decided_by = u.id
       WHERE c.patient_id = ?
       ORDER BY c.decided_at DESC`,
      [patient.id]
    );

    res.json({ patient, appointments, assessments, clearances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/patients — register new patient
router.post('/', authorize('receptionist', 'nurse'), [
  body('full_name').trim().notEmpty().isLength({ max: 100 }),
  body('dob').isDate(),
  body('gender').isIn(['male', 'female']),
  body('blood_type').optional().isIn(['A+','A-','B+','B-','AB+','AB-','O+','O-','unknown']),
  body('national_id').optional().trim(),
  body('phone').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('emergency_contact_name').optional().trim(),
  body('emergency_contact_phone').optional().trim(),
  body('emergency_contact_relation').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      full_name, dob, gender, blood_type, national_id, phone, email,
      address, emergency_contact_name, emergency_contact_phone, emergency_contact_relation
    } = req.body;

    // Check duplicate national ID — only among active patients, so a soft-deleted
    // record doesn't permanently block its national_id from being reused.
    if (national_id) {
      const [existing] = await db.query(
        'SELECT id FROM patients WHERE national_id = ? AND is_active = TRUE',
        [national_id]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: 'A patient with this national ID already exists' });
      }
    }

    const [result] = await db.query(
      `INSERT INTO patients
        (full_name, dob, gender, blood_type, national_id, phone, email, address,
         emergency_contact_name, emergency_contact_phone, emergency_contact_relation, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [full_name, dob, gender, blood_type || 'unknown', national_id, phone, email,
       address, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, req.user.id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'create_patient', 'patients', result.insertId]
    );

    res.status(201).json({ message: 'Patient registered', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/patients/:id — update patient (any clinical or front-desk staff)
router.put('/:id', authorize('admin', 'anaesthetist', 'receptionist', 'nurse'), [
  body('full_name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('dob').optional().isDate(),
  body('gender').optional().isIn(['male', 'female']),
  body('blood_type').optional().isIn(['A+','A-','B+','B-','AB+','AB-','O+','O-','unknown']),
  body('phone').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [patients] = await db.query(
      'SELECT * FROM patients WHERE id = ? AND is_active = TRUE',
      [req.params.id]
    );

    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Anaesthetists may only edit patients explicitly assigned to them.
    if (req.user.role === 'anaesthetist' && patients[0].assigned_doctor_id !== req.user.id) {
      return res.status(403).json({ error: 'This patient is not assigned to you' });
    }

    const allowed = ['full_name','dob','gender','blood_type','phone','email',
                     'address','emergency_contact_name','emergency_contact_phone','emergency_contact_relation'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await db.query(`UPDATE patients SET ${fields} WHERE id = ?`, values);

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'update_patient', 'patients', req.params.id]
    );

    res.json({ message: 'Patient updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/patients/:id/assign-doctor — assign doctor to patient (receptionist/admin)
router.put('/:id/assign-doctor', authorize('admin', 'receptionist'), [
  body('doctor_id').isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [patients] = await db.query(
      'SELECT id FROM patients WHERE id = ? AND is_active = TRUE',
      [req.params.id]
    );
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const [doctors] = await db.query(
      "SELECT id FROM users WHERE id = ? AND role = 'anaesthetist' AND is_active = TRUE",
      [req.body.doctor_id]
    );
    if (doctors.length === 0) {
      return res.status(404).json({ error: 'Anaesthetist not found' });
    }

    await db.query(
      'UPDATE patients SET assigned_doctor_id = ? WHERE id = ?',
      [req.body.doctor_id, req.params.id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'assign_doctor', 'patients', req.params.id]
    );

    res.json({ message: 'Doctor assigned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/patients/:id — soft delete (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const [patients] = await db.query(
      'SELECT id FROM patients WHERE id = ? AND is_active = TRUE',
      [req.params.id]
    );

    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await db.query('UPDATE patients SET is_active = FALSE WHERE id = ?', [req.params.id]);

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'delete_patient', 'patients', req.params.id]
    );

    res.json({ message: 'Patient deactivated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
