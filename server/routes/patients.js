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
      SELECT id, full_name, dob, gender, blood_type, national_id, phone, email, created_at
      FROM patients WHERE is_active = TRUE
    `;
    const params = [];

    if (search) {
      queryStr += ` AND (full_name LIKE ? OR national_id LIKE ? OR phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    queryStr += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [patients] = await db.query(queryStr, params);

    // Total count for pagination
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM patients WHERE is_active = TRUE ${search ? 'AND (full_name LIKE ? OR national_id LIKE ? OR phone LIKE ?)' : ''}`,
      search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []
    );

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
      'SELECT * FROM patients WHERE id = ? AND is_active = TRUE',
      [req.params.id]
    );

    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patients[0];

    // Get appointments
    const [appointments] = await db.query(
      `SELECT a.*, u.name as doctor_name
       FROM appointments a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.patient_id = ?
       ORDER BY a.scheduled_date DESC`,
      [patient.id]
    );

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
router.post('/', authorize('admin', 'receptionist', 'nurse'), [
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

    // Check duplicate national ID
    if (national_id) {
      const [existing] = await db.query(
        'SELECT id FROM patients WHERE national_id = ?',
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

// PUT /api/patients/:id — update patient
router.put('/:id', authorize('admin', 'receptionist', 'nurse'), [
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
