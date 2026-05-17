import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import Spinner from './Spinner'

/**
 * Unified Export button + dropdown. Pass an `options` array describing which
 * formats are available and what to do when each is picked:
 *
 *   <ExportMenu
 *     label={t('export.button')}
 *     options={[
 *       { id: 'pdf',   onClick: handlePdf },
 *       { id: 'excel', onClick: handleExcel },
 *       { id: 'image', onClick: handleImage },
 *       { id: 'print', onClick: handlePrint },
 *     ]}
 *   />
 *
 * Each option's label and icon are derived from its id. Unknown ids fall back
 * to a plain text label.
 */

const ICONS = {
  pdf: 'picture_as_pdf',
  excel: 'table_view',
  image: 'image',
  print: 'print',
}

const LABEL_KEYS = {
  pdf: 'export.pdf',
  excel: 'export.excel',
  image: 'export.image',
  print: 'export.print',
}

export default function ExportMenu({ options, label, disabled }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickAway = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickAway)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const handlePick = async (opt) => {
    setBusy(opt.id)
    setOpen(false)
    try {
      await opt.onClick()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || busy}
        className="px-4 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
      >
        {busy ? (
          <Spinner size={16} />
        ) : (
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            ios_share
          </span>
        )}
        {label || t('export.button')}
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg overflow-hidden z-50 anim-dropdown">
          <ul className="py-1">
            {options.map((opt) => {
              const labelText = opt.label || (LABEL_KEYS[opt.id] ? t(LABEL_KEYS[opt.id]) : opt.id)
              const icon = opt.icon || ICONS[opt.id] || 'file_present'
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(opt)}
                    className="w-full text-start px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3 transition-colors"
                  >
                    <span
                      className="material-symbols-outlined text-secondary"
                      style={{ fontSize: 20 }}
                    >
                      {icon}
                    </span>
                    <span className="font-medium">{labelText}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
