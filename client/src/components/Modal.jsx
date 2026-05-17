import { useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const { t } = useLanguage()
  useEffect(() => {
    if (!open) return
    const handler = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${widths[size]} bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xl max-h-[90vh] flex flex-col`}
      >
        {title && (
          <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
            <h3 className="text-lg font-semibold text-on-surface">{title}</h3>
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container-high transition-colors"
              aria-label={t('common.close')}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}
        <div className="overflow-y-auto custom-scrollbar p-6 flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
