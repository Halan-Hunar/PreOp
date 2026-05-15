const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

router.use(auth);

// GET /api/assessments — list with filters
router.get('/', async (req, res) => {
  try {
    const { patient_id, status, created_by, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT a.id, a.patient_id, a.status, a.asa_classification,
             a.anaesthetic_plan, a.created_at, a.submitted_at,
             p.full_name as patient_name, u.name as created_by_name
      FROM assessments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (patient_id) { queryStr += ' AND a.patient_id = ?'; params.push(patient_id); }
    if (status) { queryStr += ' AND a.status = ?'; params.push(status); }
    if (created_by) { queryStr += ' AND a.created_by = ?'; params.push(created_by); }

    queryStr += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [assessments] = await db.query(queryStr, params);
    res.json({ assessments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assessments/pending — assessments needing review (anaesthetist dashboard)
router.get('/pending', authorize('anaesthetist', 'admin'), async (req, res) => {
  try {
    const [assessments] = await db.query(
      `SELECT a.id, a.patient_id, a.status, a.asa_classification, a.submitted_at,
              p.full_name as patient_name, p.dob, p.blood_type,
              ap.scheduled_date, ap.scheduled_time, ap.surgery_type
       FROM assessments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN appointments ap ON a.appointment_id = ap.id
       WHERE a.status = 'submitted'
       ORDER BY ap.scheduled_date ASC, ap.scheduled_time ASC`
    );
    res.json({ assessments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assessments/:id — full assessment with lab results and clearance
router.get('/:id', async (req, res) => {
  try {
    const [assessments] = await db.query(
      `SELECT a.*, p.full_name as patient_name, p.dob, p.gender, p.blood_type,
              u.name as created_by_name
       FROM assessments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.id = ?`,
      [req.params.id]
    );

    if (assessments.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment = assessments[0];

    // Get lab results
    const [labResults] = await db.query(
      'SELECT * FROM lab_results WHERE assessment_id = ? ORDER BY recorded_at ASC',
      [assessment.id]
    );

    // Get clearance if exists
    const [clearances] = await db.query(
      `SELECT c.*, u.name as decided_by_name
       FROM clearances c
       LEFT JOIN users u ON c.decided_by = u.id
       WHERE c.assessment_id = ?
       ORDER BY c.decided_at DESC LIMIT 1`,
      [assessment.id]
    );

    // Get clinical notes
    const [notes] = await db.query(
      `SELECT n.*, u.name as created_by_name
       FROM clinical_notes n
       LEFT JOIN users u ON n.created_by = u.id
       WHERE n.assessment_id = ?
       ORDER BY n.created_at ASC`,
      [assessment.id]
    );

    res.json({
      assessment,
      lab_results: labResults,
      clearance: clearances[0] || null,
      notes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assessments — create new assessment (draft)
router.post('/', authorize('anaesthetist', 'admin'), [
  body('patient_id').isInt(),
  body('appointment_id').optional().isInt(),
  body('asa_classification').isIn(['I','II','III','IV','V','VI']),
  body('weight_kg').optional().isFloat({ min: 1, max: 500 }),
  body('height_cm').optional().isFloat({ min: 50, max: 250 }),
  body('blood_pressure_systolic').optional().isInt({ min: 50, max: 300 }),
  body('blood_pressure_diastolic').optional().isInt({ min: 30, max: 200 }),
  body('heart_rate').optional().isInt({ min: 20, max: 300 }),
  body('respiratory_rate').optional().isInt({ min: 5, max: 60 }),
  body('oxygen_saturation').optional().isFloat({ min: 50, max: 100 }),
  body('temperature_celsius').optional().isFloat({ min: 30, max: 45 }),
  body('mallampati_score').optional().isIn(['I','II','III','IV']),
  body('neck_mobility').optional().isIn(['full','limited','very_limited']),
  body('anaesthetic_plan').optional().isIn(['general','regional','local','sedation','combined']),
  body('smoking_status').optional().isIn(['never','former','current']),
  body('alcohol_use').optional().isIn(['none','occasional','moderate','heavy']),
  body('allergy_severity').optional().isIn(['mild','moderate','severe','unknown']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { patient_id, appointment_id } = req.body;

    const [patients] = await db.query('SELECT id FROM patients WHERE id = ? AND is_active = TRUE', [patient_id]);
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Calculate BMI if weight and height provided
    let bmi = null;
    if (req.body.weight_kg && req.body.height_cm) {
      const heightM = req.body.height_cm / 100;
      bmi = (req.body.weight_kg / (heightM * heightM)).toFixed(2);
    }

    const fields = [
      'patient_id', 'appointment_id', 'created_by',
      'weight_kg', 'height_cm', 'bmi',
      'blood_pressure_systolic', 'blood_pressure_diastolic',
      'heart_rate', 'respiratory_rate', 'oxygen_saturation', 'temperature_celsius',
      'chief_complaint', 'current_medications', 'drug_allergies', 'allergy_severity',
      'previous_surgeries', 'previous_anaesthesia_issues', 'family_anaesthesia_history',
      'smoking_status', 'alcohol_use',
      'cardiovascular_status', 'cardiovascular_conditions',
      'respiratory_status', 'respiratory_conditions',
      'neurological_status', 'renal_status', 'hepatic_status', 'endocrine_conditions',
      'ent_complaint', 'nasal_obstruction', 'previous_ent_surgery', 'previous_ent_surgery_details',
      'mallampati_score', 'mouth_opening_cm', 'thyromental_distance_cm',
      'neck_mobility', 'dental_issues', 'airway_notes',
      'asa_classification', 'asa_justification',
      'npo_solids_since', 'npo_liquids_since', 'npo_confirmed',
      'premedication_given', 'premedication_details',
      'anaesthetic_plan', 'anaesthetic_plan_details',
      'special_notes', 'risk_notes',
    ];

    const values = fields.map(f => {
      if (f === 'created_by') return req.user.id;
      if (f === 'bmi') return bmi;
      return req.body[f] !== undefined ? req.body[f] : null;
    });

    const placeholders = fields.map(() => '?').join(', ');
    const columnNames = fields.join(', ');

    const [result] = await db.query(
      `INSERT INTO assessments (${columnNames}) VALUES (${placeholders})`,
      values
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'create_assessment', 'assessments', result.insertId]
    );

    res.status(201).json({ message: 'Assessment created', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/assessments/:id — update assessment
router.put('/:id', authorize('anaesthetist', 'admin'), async (req, res) => {
  try {
    const [assessments] = await db.query(
      'SELECT * FROM assessments WHERE id = ?',
      [req.params.id]
    );

    if (assessments.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment = assessments[0];

    // Can't edit approved assessments unless admin
    if (assessment.status === 'approved' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot edit an approved assessment' });
    }

    const allowed = [
      'weight_kg', 'height_cm', 'blood_pressure_systolic', 'blood_pressure_diastolic',
      'heart_rate', 'respiratory_rate', 'oxygen_saturation', 'temperature_celsius',
      'chief_complaint', 'current_medications', 'drug_allergies', 'allergy_severity',
      'previous_surgeries', 'previous_anaesthesia_issues', 'family_anaesthesia_history',
      'smoking_status', 'alcohol_use',
      'cardiovascular_status', 'cardiovascular_conditions',
      'respiratory_status', 'respiratory_conditions',
      'neurological_status', 'renal_status', 'hepatic_status', 'endocrine_conditions',
      'ent_complaint', 'nasal_obstruction', 'previous_ent_surgery', 'previous_ent_surgery_details',
      'mallampati_score', 'mouth_opening_cm', 'thyromental_distance_cm',
      'neck_mobility', 'dental_issues', 'airway_notes',
      'asa_classification', 'asa_justification',
      'npo_solids_since', 'npo_liquids_since', 'npo_confirmed',
      'premedication_given', 'premedication_details',
      'anaesthetic_plan', 'anaesthetic_plan_details',
      'special_notes', 'risk_notes',
    ];

    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Recalculate BMI if weight/height changed
    const newWeight = updates.weight_kg || assessment.weight_kg;
    const newHeight = updates.height_cm || assessment.height_cm;
    if (newWeight && newHeight) {
      const heightM = newHeight / 100;
      updates.bmi = (newWeight / (heightM * heightM)).toFixed(2);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];

    await db.query(`UPDATE assessments SET ${fields} WHERE id = ?`, values);

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'update_assessment', 'assessments', req.params.id]
    );

    res.json({ message: 'Assessment updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assessments/:id/submit — submit for review
router.post('/:id/submit', authorize('anaesthetist', 'admin'), async (req, res) => {
  try {
    const [assessments] = await db.query(
      'SELECT * FROM assessments WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (assessments.length === 0) {
      return res.status(404).json({ error: 'Assessment not found or not yours' });
    }

    if (assessments[0].status !== 'draft') {
      return res.status(400).json({ error: 'Only draft assessments can be submitted' });
    }

    await db.query(
      `UPDATE assessments SET status = 'submitted', submitted_at = NOW() WHERE id = ?`,
      [req.params.id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'submit_assessment', 'assessments', req.params.id]
    );

    res.json({ message: 'Assessment submitted for review' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assessments/:id/clearance — add clearance decision
router.post('/:id/clearance', authorize('anaesthetist', 'admin'), [
  body('decision').isIn(['cleared', 'conditional', 'not_cleared']),
  body('conditions').optional().trim(),
  body('reason').optional().trim(),
  body('follow_up_required').optional().isBoolean(),
  body('follow_up_notes').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [assessments] = await db.query(
      'SELECT * FROM assessments WHERE id = ?',
      [req.params.id]
    );

    if (assessments.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment = assessments[0];

    if (!['submitted', 'flagged'].includes(assessment.status)) {
      return res.status(400).json({ error: 'Assessment must be submitted before clearance' });
    }

    const { decision, conditions, reason, follow_up_required, follow_up_notes } = req.body;

    await db.query(
      `INSERT INTO clearances (assessment_id, patient_id, decision, conditions, reason, follow_up_required, follow_up_notes, decided_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [assessment.id, assessment.patient_id, decision, conditions, reason,
       follow_up_required || false, follow_up_notes, req.user.id]
    );

    // Update assessment status
    const newStatus = decision === 'cleared' ? 'approved' :
                      decision === 'not_cleared' ? 'flagged' : 'approved';

    await db.query('UPDATE assessments SET status = ? WHERE id = ?', [newStatus, assessment.id]);

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id) VALUES (?, ?, ?, ?)',
      [req.user.id, `clearance_${decision}`, 'assessments', assessment.id]
    );

    res.status(201).json({ message: 'Clearance decision recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assessments/:id/notes — add clinical note
router.post('/:id/notes', [
  body('note').trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [assessments] = await db.query('SELECT id, patient_id FROM assessments WHERE id = ?', [req.params.id]);
    if (assessments.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    await db.query(
      'INSERT INTO clinical_notes (patient_id, assessment_id, note, created_by) VALUES (?, ?, ?, ?)',
      [assessments[0].patient_id, req.params.id, req.body.note, req.user.id]
    );

    res.status(201).json({ message: 'Note added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assessments/:id/lab-results — add lab result
router.post('/:id/lab-results', authorize('anaesthetist', 'admin', 'nurse'), [
  body('test_name').trim().notEmpty(),
  body('result_value').optional().trim(),
  body('unit').optional().trim(),
  body('reference_range').optional().trim(),
  body('is_abnormal').optional().isBoolean(),
  body('notes').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const [assessments] = await db.query('SELECT id FROM assessments WHERE id = ?', [req.params.id]);
    if (assessments.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const { test_name, result_value, unit, reference_range, is_abnormal, notes } = req.body;

    await db.query(
      `INSERT INTO lab_results (assessment_id, test_name, result_value, unit, reference_range, is_abnormal, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, test_name, result_value, unit, reference_range, is_abnormal || false, notes, req.user.id]
    );

    res.status(201).json({ message: 'Lab result added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
