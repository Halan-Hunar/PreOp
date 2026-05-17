import { useLanguage } from '../context/LanguageContext'

export default function Spinner({ size = 24, className = '' }) {
  const { t } = useLanguage()
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-outline-variant border-t-secondary ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label={t('common.loading')}
    />
  )
}
