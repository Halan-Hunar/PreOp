/**
 * Build a multi-sheet workbook describing one assessment. Each sheet mirrors
 * one section of the paper form so reviewers can read it like a chart instead
 * of a flat firehose row.
 *
 * Returns an array shaped for `exportSheetsAsExcel(sheets, filename)`.
 */
export function buildAssessmentSheets({ assessment, extra, doctorName, t }) {
  const a = assessment || {}
  const x = extra || {}
  const fmt = (label, value) => ({
    [t('common.name') || 'Field']: label,
    Value: value ?? '',
  })

  const yes = (v) => (v ? t('common.yes') : '')

  const sheets = []

  // ───────── Overview ─────────
  sheets.push({
    name: 'Overview',
    rows: [
      fmt(t('form.name'), a.patient_name),
      fmt(t('form.age'), x.age || ''),
      fmt(t('form.gender'), a.gender),
      fmt(t('form.date'), new Date().toLocaleDateString()),
      fmt(t('form.weight') + ' (kg)', a.weight_kg),
      fmt(t('form.height') + ' (cm)', a.height_cm),
      fmt(t('form.bmi'), a.bmi),
      fmt(t('form.sideOperated'), x.side),
      fmt(t('form.proposedSurgery'), x.proposed_surgery),
      fmt(t('common.status'), a.status),
      fmt(t('form.anaesthetistName'), doctorName),
    ],
  })

  // ───────── Section 1: Previous Anesthetics ─────────
  sheets.push({
    name: 'Prev. Anesthetics',
    rows: (x.previous_anaesthetics || []).map((row, i) => ({
      '#': i + 1,
      [t('form.prevAnaesth.procedure')]: row.procedure || '',
      [t('form.prevAnaesth.type')]: row.type || '',
      GA: yes(row.ga),
      RA: yes(row.ra),
      'LA Infiltration': yes(row.la),
    })),
  })

  // Complications row appended at the bottom
  sheets.push({
    name: 'Complications',
    rows: [
      fmt(t('form.ponv'), yes(x.ponv)),
      fmt(t('form.delayedRecovery'), yes(x.delayed_recovery)),
      fmt(t('form.lastAnaesthesiaBefore'), x.last_anaesthesia_before),
      fmt(t('form.details'), x.prev_details),
      fmt(t('form.respiratoryDistress'), yes(x.respiratory_distress)),
      fmt(t('form.plph'), yes(x.plph)),
      fmt(t('form.others'), x.complications_other),
    ],
  })

  // ───────── Section 2: Family History ─────────
  const fam = x.family_history || {}
  sheets.push({
    name: 'Family History',
    rows: ['father', 'mother', 'brothers', 'sisters'].map((m) => ({
      [t('form.familyMember')]: t(`form.family.${m}`),
      [t('form.familyType')]: (fam[m] || {}).type || '',
      [t('form.familyComplications')]: (fam[m] || {}).complications || '',
    })),
  })

  // ───────── Section 3: Medical History ─────────
  const med = x.medical_history || {}
  sheets.push({
    name: 'Medical History',
    rows: [
      ['hypertension', t('form.history.hypertension')],
      ['ihd', t('form.history.ihd')],
      ['thyroid', t('form.history.thyroid')],
      ['bleeding', t('form.history.bleeding')],
      ['other_disease', t('form.others')],
    ].map(([k, label]) => ({
      [t('form.history.disease')]: label,
      [t('form.history.regularRx')]: yes((med[k] || {}).regular_rx),
      [t('form.history.duration')]: (med[k] || {}).duration || '',
      Notes: (med[k] || {}).notes || '',
    })),
  })

  sheets.push({
    name: 'Other History',
    rows: [
      fmt(t('form.history.bloodTransfusion'), yes(x.blood_transfusion)),
      fmt(t('form.history.pregnancy'), yes(x.pregnancy)),
      fmt(t('form.history.trimester'), x.trimester),
      fmt(
        t('form.history.regular'),
        x.pregnancy ? (x.pregnancy_regular ? t('form.history.regular') : t('form.history.irregular')) : ''
      ),
      fmt(t('form.history.lactation'), yes(x.lactation)),
      fmt(t('form.history.duration'), x.lactation_duration),
      fmt(t('form.history.ocp'), yes(x.ocp)),
    ],
  })

  // ───────── Section 4: Medicines ─────────
  sheets.push({
    name: 'Medicines',
    rows: (x.medicines || []).map((row, i) => ({
      '#': i + 1,
      [t('form.medicine.name')]: row.name || '',
      [t('form.medicine.dose')]: row.dose || '',
      [t('form.medicine.frequency')]: row.frequency || '',
      Action: row.action || '',
    })),
  })

  // ───────── Section 5: Hypersensitivity ─────────
  sheets.push({
    name: 'Hypersensitivity',
    rows: [
      fmt(t('form.hyper.food'), x.hyper_food),
      fmt(t('form.hyper.blood'), x.hyper_blood),
      fmt(t('form.hyper.drug'), a.drug_allergies),
    ],
  })

  // ───────── Section 6: Tobacco & Alcohol ─────────
  sheets.push({
    name: 'Tobacco & Alcohol',
    rows: [
      fmt(t('form.tobacco'), yes(x.tobacco_used)),
      fmt(`${t('form.tobacco')} – ${t('form.subst.type')}`, x.tobacco_type),
      fmt(`${t('form.tobacco')} – ${t('form.subst.amount')}`, x.tobacco_amount),
      fmt(`${t('form.tobacco')} – ${t('form.subst.duration')}`, x.tobacco_duration),
      fmt(`${t('form.tobacco')} – ${t('form.subst.status')}`, x.tobacco_status),
      fmt(`${t('form.tobacco')} – ${t('form.subst.quitYears')}`, x.tobacco_quit_years),
      fmt(`${t('form.tobacco')} – ${t('form.subst.recommendation')}`, x.tobacco_recommendation),
      fmt(t('form.alcohol'), yes(x.alcohol_used)),
      fmt(`${t('form.alcohol')} – ${t('form.subst.type')}`, x.alcohol_type),
      fmt(`${t('form.alcohol')} – ${t('form.subst.amount')}`, x.alcohol_amount),
      fmt(`${t('form.alcohol')} – ${t('form.subst.duration')}`, x.alcohol_duration),
      fmt(`${t('form.alcohol')} – ${t('form.subst.status')}`, x.alcohol_status),
      fmt(`${t('form.alcohol')} – ${t('form.subst.recommendation')}`, x.alcohol_recommendation),
    ],
  })

  // ───────── Section 7: Clinical Examination ─────────
  sheets.push({
    name: 'Clinical Exam',
    rows: [
      fmt(t('form.neckGoiter'), x.neck_goiter),
      fmt('SpO2 %', a.oxygen_saturation),
      fmt('Temperature °C', a.temperature_celsius),
      fmt(
        'NIBP',
        a.blood_pressure_systolic
          ? `${a.blood_pressure_systolic} / ${a.blood_pressure_diastolic || ''}`
          : ''
      ),
      fmt('HR bpm', a.heart_rate),
      fmt('Rhythm', x.hr_rhythm),
      fmt('Respiratory Rate', a.respiratory_rate),
      fmt(t('form.heart'), a.cardiovascular_status),
      fmt(t('form.chest'), a.respiratory_status),
      fmt(t('form.abdomen'), x.abdomen),
      fmt(t('form.others'), x.exam_others),
      fmt(t('form.echoEf'), x.echo_ef),
      fmt(t('form.ecgFindings'), x.ecg_findings),
      fmt(t('form.conclusion'), x.heart_conclusion),
      fmt(t('form.recommendations'), x.heart_recommendations),
    ],
  })

  // ───────── Section 8: Investigations ─────────
  sheets.push({
    name: 'Investigations',
    rows: [
      ['BUN', x.bun],
      ['S. Creatinine', x.s_creatinine],
      ['B. Glucose', x.b_glucose],
      ['K+', x.k_plus],
      ['Ca++', x.ca_plus],
      ['PT', x.pt],
      ['PTT', x.ptt],
      ['INR', x.inr],
      ['AST', x.ast],
      ['ALT', x.alt],
      ['ALP', x.alp],
      ['HbsAg (HBV)', x.hbv],
      ['HCV', x.hcv],
      ['HIV', x.hiv],
      ['T3', x.t3],
      ['T4', x.t4],
      ['TSH', x.tsh],
      ['Free T3', x.free_t3],
      [t('form.dentures'), x.dentures],
      [t('form.mpc'), a.mallampati_score ? `Class ${a.mallampati_score}` : ''],
    ].map(([label, value]) => fmt(label, value)),
  })

  // ───────── Section 9: Risk Assessment ─────────
  sheets.push({
    name: 'Risk Assessment',
    rows: [
      fmt(t('form.asaClass'), a.asa_classification),
      fmt(t('form.recommendations'), a.asa_justification),
      fmt('Risk Notes', a.risk_notes),
    ],
  })

  // ───────── Section 10: Fitness ─────────
  sheets.push({
    name: 'Fitness',
    rows: [
      fmt(t('form.fasting.food'), x.fast_food),
      fmt(t('form.fasting.clearFluid'), x.fast_clear_fluid),
      fmt(t('form.fasting.breastMilk'), x.fast_breast_milk),
      fmt(t('form.fasting.bottleMilk'), x.fast_bottle_milk),
      fmt(`${t('form.score')} ${t('form.scoreOf20')}`, x.score),
      fmt(t('form.consentBy'), x.consent_by),
      fmt(t('form.anaesthetistName'), doctorName),
      fmt(t('form.date'), new Date().toLocaleDateString()),
    ],
  })

  return sheets
}
