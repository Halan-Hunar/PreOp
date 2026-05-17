import { forwardRef } from 'react'

/**
 * Paper-replica render of a pre-anesthesia assessment, designed to look like
 * the physical form used at the clinic. Lives off-screen (via
 * `.print-target-offscreen` from index.css) so it doesn't disturb normal flow,
 * and is the source DOM for html2canvas / window.print().
 *
 * All styling is inline + minimal Tailwind so the output stays consistent
 * regardless of theme — the form must render the same in light, dark, and
 * print modes (because the paper version is always black ink on white paper).
 */

const Check = ({ on }) => (
  <span
    style={{
      display: 'inline-block',
      width: 12,
      height: 12,
      border: '1px solid #000',
      marginInlineEnd: 4,
      verticalAlign: 'middle',
      textAlign: 'center',
      lineHeight: '10px',
      fontSize: 10,
    }}
  >
    {on ? '✓' : ''}
  </span>
)

const cell = {
  border: '1px solid #000',
  padding: '4px 6px',
  verticalAlign: 'top',
}

const headerCell = {
  ...cell,
  fontWeight: 700,
  background: '#f0f0f0',
}

const SectionTitle = ({ children }) => (
  <div
    style={{
      background: '#e5e5e5',
      border: '1px solid #000',
      padding: '3px 6px',
      fontWeight: 700,
      fontSize: 11,
      marginTop: 4,
    }}
  >
    {children}
  </div>
)

const Row = ({ children }) => (
  <div style={{ display: 'flex', gap: 0, border: '1px solid #000', borderTop: 'none' }}>
    {children}
  </div>
)

const Field = ({ label, value, flex = 1 }) => (
  <div style={{ flex, padding: '3px 6px', borderInlineEnd: '1px solid #000', minHeight: 22 }}>
    <span style={{ fontWeight: 700 }}>{label}: </span>
    <span>{value || ''}</span>
  </div>
)

const FieldNoBorder = ({ label, value, flex = 1 }) => (
  <div style={{ flex, padding: '3px 6px', minHeight: 22 }}>
    <span style={{ fontWeight: 700 }}>{label}: </span>
    <span>{value || ''}</span>
  </div>
)

const AssessmentPrintForm = forwardRef(function AssessmentPrintForm(
  { data, clinicName = 'PreOp Clinic', generatedAt },
  ref
) {
  // Pull data out with safe fallbacks. `data.extra` holds the new structured
  // sections; everything else lives on `data` directly (existing columns).
  const a = data || {}
  const extra = a.extra || {}
  const today =
    generatedAt || new Date().toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })

  const ponv = !!extra.ponv
  const delayedRecovery = !!extra.delayed_recovery

  return (
    <div
      ref={ref}
      className="print-target-offscreen"
      style={{
        padding: 16,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 10.5,
        color: '#000',
        background: '#fff',
        lineHeight: 1.3,
      }}
    >
      {/* ─── Top banner ─── */}
      <div
        style={{
          border: '1px solid #000',
          background: '#e0e0e0',
          padding: '4px 8px',
          fontWeight: 700,
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>PRE-ANESTHESIA EVALUATION FORM</span>
        <span>{clinicName}</span>
      </div>

      {/* Header strip */}
      <div style={{ display: 'flex', border: '1px solid #000', borderTop: 'none' }}>
        <Field label="Name" value={a.patient_name} flex={3} />
        <Field label="Age" value={extra.age || calcAge(a.dob)} />
        <Field label="Gender" value={a.gender ? a.gender.charAt(0).toUpperCase() : ''} />
        <Field label="Weight (kg)" value={a.weight_kg} />
        <FieldNoBorder label="Date" value={today} />
      </div>
      <Row>
        <Field label="Height (cm)" value={a.height_cm} flex={2} />
        <Field label="BMI" value={a.bmi || extra.bmi} flex={2} />
        <FieldNoBorder label="Side" value={extra.side || ''} flex={1} />
      </Row>
      <Row>
        <FieldNoBorder label="Proposed surgery / procedure" value={extra.proposed_surgery} flex={1} />
      </Row>

      {/* ─── Section 1 ─── */}
      <SectionTitle>1. Previous Anesthetics (from oldest)</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ ...headerCell, width: 24 }}>#</th>
            <th style={headerCell}>Procedure / Surgery</th>
            <th style={{ ...headerCell, width: 120 }}>Type</th>
            <th style={{ ...headerCell, width: 60 }}>GA</th>
            <th style={{ ...headerCell, width: 60 }}>RA</th>
            <th style={{ ...headerCell, width: 60 }}>LA Infilt.</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => {
            const row = (extra.previous_anaesthetics || [])[i] || {}
            return (
              <tr key={i}>
                <td style={cell}>{i + 1}</td>
                <td style={cell}>{row.procedure || ''}</td>
                <td style={cell}>{row.type || ''}</td>
                <td style={{ ...cell, textAlign: 'center' }}>{row.ga ? '✓' : ''}</td>
                <td style={{ ...cell, textAlign: 'center' }}>{row.ra ? '✓' : ''}</td>
                <td style={{ ...cell, textAlign: 'center' }}>{row.la ? '✓' : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Row>
        <div style={{ flex: 1, padding: '3px 6px', borderInlineEnd: '1px solid #000' }}>
          <Check on={ponv} /> PONV
          <span style={{ display: 'inline-block', width: 16 }} />
          <Check on={delayedRecovery} /> Delayed recovery
        </div>
        <FieldNoBorder
          label="Last anaesthesia was before"
          value={extra.last_anaesthesia_before}
          flex={1}
        />
      </Row>
      <Row>
        <FieldNoBorder label="Details" value={extra.prev_details} flex={1} />
      </Row>

      <SectionTitle>Common Anesthetic Complications</SectionTitle>
      <Row>
        <div style={{ flex: 1, padding: '3px 6px', borderInlineEnd: '1px solid #000' }}>
          <Check on={extra.respiratory_distress} /> Respiratory distress
        </div>
        <div style={{ flex: 1, padding: '3px 6px', borderInlineEnd: '1px solid #000' }}>
          <Check on={extra.plph} /> PLPH
        </div>
        <div style={{ flex: 2, padding: '3px 6px' }}>
          <Check on={!!extra.complications_other} /> Others:{' '}
          {extra.complications_other || ''}
        </div>
      </Row>

      {/* ─── Section 2 ─── */}
      <SectionTitle>2. Family History of Anesthesia</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={headerCell}>Family member</th>
            <th style={headerCell}>Type of anesthetic</th>
            <th style={headerCell}>Complications</th>
          </tr>
        </thead>
        <tbody>
          {['father', 'mother', 'brothers', 'sisters'].map((m) => {
            const row = (extra.family_history || {})[m] || {}
            const label = { father: 'Father', mother: 'Mother', brothers: 'Brother(s)', sisters: 'Sister(s)' }[m]
            return (
              <tr key={m}>
                <td style={cell}>{label}</td>
                <td style={cell}>{row.type || ''}</td>
                <td style={cell}>{row.complications || ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ─── Section 3 ─── */}
      <SectionTitle>3. Medical History</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={headerCell}>Disease</th>
            <th style={{ ...headerCell, width: 80 }}>Regular Rx?</th>
            <th style={{ ...headerCell, width: 100 }}>Duration</th>
            <th style={headerCell}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['hypertension', 'Hypertension'],
            ['ihd', 'IHD'],
            ['thyroid', 'Thyroid disease'],
            ['bleeding', 'Bleeding tendency'],
            ['other_disease', 'Others'],
          ].map(([k, label]) => {
            const row = (extra.medical_history || {})[k] || {}
            return (
              <tr key={k}>
                <td style={cell}>{label}</td>
                <td style={{ ...cell, textAlign: 'center' }}>{row.regular_rx ? '✓' : ''}</td>
                <td style={cell}>{row.duration || ''}</td>
                <td style={cell}>{row.notes || ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Row>
        <div style={{ flex: 1, padding: '3px 6px', borderInlineEnd: '1px solid #000' }}>
          <Check on={extra.blood_transfusion} /> Blood transfusion
        </div>
        <div style={{ flex: 1, padding: '3px 6px', borderInlineEnd: '1px solid #000' }}>
          <Check on={extra.pregnancy} /> Pregnancy
          {extra.pregnancy && (
            <span> — Trimester {extra.trimester || ''}, {extra.pregnancy_regular ? 'Regular' : 'Irregular'}</span>
          )}
        </div>
        <div style={{ flex: 1, padding: '3px 6px', borderInlineEnd: '1px solid #000' }}>
          <Check on={extra.lactation} /> Lactation {extra.lactation_duration ? `(${extra.lactation_duration})` : ''}
        </div>
        <div style={{ flex: 1, padding: '3px 6px' }}>
          <Check on={extra.ocp} /> OCP
        </div>
      </Row>

      {/* ─── Section 4 ─── */}
      <SectionTitle>4. Medicines and Regimens</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ ...headerCell, width: 24 }}>#</th>
            <th style={headerCell}>Medicine</th>
            <th style={{ ...headerCell, width: 80 }}>Dose</th>
            <th style={{ ...headerCell, width: 80 }}>Frequency</th>
            <th style={{ ...headerCell, width: 90 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => {
            const row = (extra.medicines || [])[i] || {}
            return (
              <tr key={i}>
                <td style={cell}>{i + 1}</td>
                <td style={cell}>{row.name || ''}</td>
                <td style={cell}>{row.dose || ''}</td>
                <td style={cell}>{row.frequency || ''}</td>
                <td style={cell}>{row.action || ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ─── Section 5 ─── */}
      <SectionTitle>5. Hypersensitivity</SectionTitle>
      <Row>
        <div style={{ flex: 1, padding: '3px 6px', borderInlineEnd: '1px solid #000' }}>
          <Check on={!!extra.hyper_food} /> Food: {extra.hyper_food || ''}
        </div>
        <div style={{ flex: 1, padding: '3px 6px', borderInlineEnd: '1px solid #000' }}>
          <Check on={!!extra.hyper_blood} /> Blood products: {extra.hyper_blood || ''}
        </div>
        <div style={{ flex: 1, padding: '3px 6px' }}>
          <Check on={!!a.drug_allergies} /> Drug: {a.drug_allergies || ''}
        </div>
      </Row>

      {/* ─── Section 6 ─── */}
      <SectionTitle>6. Tobacco & Alcohol</SectionTitle>
      <Row>
        <div style={{ flex: 1, padding: '3px 6px', borderInlineEnd: '1px solid #000' }}>
          <Check on={!!extra.tobacco_used} /> Tobacco —{' '}
          {extra.tobacco_type ? `${extra.tobacco_type}, ` : ''}
          {extra.tobacco_amount ? `${extra.tobacco_amount}/day, ` : ''}
          {extra.tobacco_duration ? `${extra.tobacco_duration} yrs, ` : ''}
          {extra.tobacco_status || ''}
          {extra.tobacco_quit_years ? ` (quit ${extra.tobacco_quit_years} yrs ago)` : ''}
        </div>
        <div style={{ flex: 1, padding: '3px 6px' }}>
          <Check on={!!extra.alcohol_used} /> Alcohol —{' '}
          {extra.alcohol_type ? `${extra.alcohol_type}, ` : ''}
          {extra.alcohol_amount ? `${extra.alcohol_amount}/wk, ` : ''}
          {extra.alcohol_duration ? `${extra.alcohol_duration} yrs, ` : ''}
          {extra.alcohol_status || ''}
        </div>
      </Row>
      {(extra.tobacco_recommendation || extra.alcohol_recommendation) && (
        <Row>
          <FieldNoBorder
            label="Recommendations"
            value={[extra.tobacco_recommendation, extra.alcohol_recommendation].filter(Boolean).join(' / ')}
          />
        </Row>
      )}

      {/* ─── Section 7 ─── */}
      <SectionTitle>7. Clinical Examination</SectionTitle>
      <Row>
        <Field label="Neck (Goiter)" value={extra.neck_goiter} flex={2} />
        <Field label="SpO2 (%)" value={a.oxygen_saturation} />
        <Field label="Temp (°C)" value={a.temperature_celsius} />
        <FieldNoBorder
          label="NIBP"
          value={
            a.blood_pressure_systolic
              ? `${a.blood_pressure_systolic} / ${a.blood_pressure_diastolic || '—'}`
              : ''
          }
        />
      </Row>
      <Row>
        <Field
          label="HR"
          value={
            a.heart_rate
              ? `${a.heart_rate} bpm, ${extra.hr_rhythm || ''}`
              : ''
          }
          flex={2}
        />
        <Field label="Heart" value={a.cardiovascular_status} flex={2} />
        <FieldNoBorder label="Chest" value={a.respiratory_status} flex={2} />
      </Row>
      <Row>
        <Field label="Abdomen" value={extra.abdomen} flex={2} />
        <FieldNoBorder label="Other findings" value={extra.exam_others} flex={3} />
      </Row>

      <SectionTitle>Heart &amp; Chest Health</SectionTitle>
      <Row>
        <Field label="Echo EF %" value={extra.echo_ef} flex={1} />
        <FieldNoBorder label="ECG" value={extra.ecg_findings} flex={3} />
      </Row>
      <Row>
        <FieldNoBorder label="Conclusion" value={extra.heart_conclusion} flex={1} />
      </Row>
      <Row>
        <FieldNoBorder label="Recommendations" value={extra.heart_recommendations} flex={1} />
      </Row>

      {/* ─── Section 8 ─── */}
      <SectionTitle>8. Investigations</SectionTitle>
      <Row>
        <Field label="BUN" value={extra.bun} />
        <Field label="S.Creatinine" value={extra.s_creatinine} />
        <Field label="B.Glucose" value={extra.b_glucose} />
        <Field label="K+" value={extra.k_plus} />
        <FieldNoBorder label="Ca++" value={extra.ca_plus} />
      </Row>
      <Row>
        <Field label="PT" value={extra.pt} />
        <Field label="PTT" value={extra.ptt} />
        <Field label="INR" value={extra.inr} />
        <Field label="AST" value={extra.ast} />
        <Field label="ALT" value={extra.alt} />
        <FieldNoBorder label="ALP" value={extra.alp} />
      </Row>
      <Row>
        <Field label="HbsAg" value={extra.hbv} />
        <Field label="HCV" value={extra.hcv} />
        <Field label="HIV" value={extra.hiv} />
        <Field label="T3" value={extra.t3} />
        <Field label="T4" value={extra.t4} />
        <Field label="TSH" value={extra.tsh} />
        <FieldNoBorder label="Free T3" value={extra.free_t3} />
      </Row>
      <Row>
        <Field
          label="Dentures"
          value={extra.dentures || ''}
          flex={2}
        />
        <FieldNoBorder
          label="MPC"
          value={a.mallampati_score ? `Class ${a.mallampati_score}` : ''}
          flex={1}
        />
      </Row>

      {/* ─── Section 9 ─── */}
      <SectionTitle>9. Risk Assessment</SectionTitle>
      <Row>
        <FieldNoBorder
          label="ASA Physical Status Class"
          value={a.asa_classification || ''}
          flex={1}
        />
      </Row>
      <Row>
        <FieldNoBorder label="Conclusion" value={a.asa_justification} flex={1} />
      </Row>
      <Row>
        <FieldNoBorder label="Recommendations" value={a.risk_notes} flex={1} />
      </Row>

      {/* ─── Section 10 / Footer ─── */}
      <SectionTitle>10. Fitness / Clearance</SectionTitle>
      <Row>
        <Field label="Food at" value={extra.fast_food} />
        <Field label="Clear fluid at" value={extra.fast_clear_fluid} />
        <Field label="Breast milk at" value={extra.fast_breast_milk} />
        <FieldNoBorder label="Bottle milk at" value={extra.fast_bottle_milk} />
      </Row>
      <Row>
        <Field label="Score" value={extra.score ? `${extra.score} / 20` : ''} flex={1} />
        <Field label="Consent by" value={extra.consent_by || ''} flex={1} />
        <FieldNoBorder label="Date" value={today} flex={1} />
      </Row>

      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 12,
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: 2 }}>
          <div style={{ fontWeight: 700 }}>Anaesthetist's name &amp; signature</div>
          <div
            style={{
              borderBottom: '1px solid #000',
              minHeight: 36,
              marginTop: 4,
              padding: '2px 4px',
            }}
          >
            {a.created_by_name ? `Dr. ${a.created_by_name}` : ''}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Stamp</div>
          <div style={{ border: '1px solid #000', height: 60, marginTop: 4 }} />
        </div>
      </div>
    </div>
  )
})

function calcAge(dob) {
  if (!dob) return ''
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

export default AssessmentPrintForm
