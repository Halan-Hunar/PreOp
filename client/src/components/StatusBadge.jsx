import { useLanguage } from '../context/LanguageContext'

const STYLES = {
  // Clearance
  cleared: { bg: 'bg-success-container', text: 'text-on-success-container', icon: 'check_circle' },
  conditional: { bg: 'bg-warning-container', text: 'text-on-warning-container', icon: 'warning' },
  not_cleared: { bg: 'bg-error-container', text: 'text-on-error-container', icon: 'block' },

  // Assessment
  draft: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', icon: 'edit_note' },
  submitted: { bg: 'bg-secondary-container', text: 'text-on-secondary-container', icon: 'hourglass_empty' },
  approved: { bg: 'bg-success-container', text: 'text-on-success-container', icon: 'check_circle' },
  flagged: { bg: 'bg-error-container', text: 'text-on-error-container', icon: 'flag' },

  // Appointment
  scheduled: { bg: 'bg-secondary-container', text: 'text-on-secondary-container', icon: 'event' },
  in_progress: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', icon: 'pending' },
  completed: { bg: 'bg-success-container', text: 'text-on-success-container', icon: 'check_circle' },
  cancelled: { bg: 'bg-error-container', text: 'text-on-error-container', icon: 'cancel' },
  no_show: { bg: 'bg-error-container', text: 'text-on-error-container', icon: 'person_off' },

  // ASA
  'asa-low': { bg: 'bg-success-container', text: 'text-on-success-container', icon: 'shield' },
  'asa-mid': { bg: 'bg-warning-container', text: 'text-on-warning-container', icon: 'shield' },
  'asa-high': { bg: 'bg-error-container', text: 'text-on-error-container', icon: 'priority_high' },
}

export default function StatusBadge({ status, label, variant }) {
  const { t } = useLanguage()
  const key = variant || status
  const cfg = STYLES[key] || STYLES.draft
  // Prefer explicit label, then translated status, then a fallback.
  const text = label || (status ? t(`status.${status}`) : t('common.notAvailable'))

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
        {cfg.icon}
      </span>
      {text}
    </span>
  )
}

export function asaVariant(classification) {
  if (!classification) return 'asa-low'
  const map = { I: 'asa-low', II: 'asa-low', III: 'asa-mid', IV: 'asa-high', V: 'asa-high', VI: 'asa-high' }
  return map[classification] || 'asa-low'
}
