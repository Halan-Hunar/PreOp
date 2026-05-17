import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import en from '../locales/en'
import ku from '../locales/ku'

const DICTS = { en, ku }
const RTL_LANGS = new Set(['ku'])
const STORAGE_KEY = 'preop_lang'

const LanguageContext = createContext(null)

function applyDir(lang) {
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lang)
}

// Replace {placeholders} in a template string. Missing vars stay as-is.
function interpolate(template, vars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
  )
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return DICTS[stored] ? stored : 'en'
  })

  // Apply dir/lang on mount and whenever language changes.
  useEffect(() => {
    applyDir(lang)
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const setLang = useCallback((next) => {
    if (DICTS[next]) setLangState(next)
  }, [])

  const t = useCallback(
    (key, vars) => {
      const dict = DICTS[lang] || DICTS.en
      const raw = dict[key] ?? DICTS.en[key] ?? key
      return interpolate(raw, vars)
    },
    [lang]
  )

  // Prepend the doctor honorific ("Dr." / "د.") to a name, unless it's already
  // prefixed. Use this for `doctor_name` / `assigned_doctor_name` fields and
  // anywhere we *know* the person is an anaesthetist.
  const dr = useCallback(
    (name) => {
      if (!name) return ''
      const prefix = t('honorific.doctor')
      const trimmed = String(name).trimStart()
      if (/^Dr\.?\s/i.test(trimmed) || trimmed.startsWith(prefix)) return trimmed
      return `${prefix} ${trimmed}`
    },
    [t]
  )

  // Role-aware: only prefix for anaesthetists. Use this for `user.name` and
  // staff listings where the role field is alongside the name.
  const formatName = useCallback(
    (name, role) => {
      if (!name) return ''
      if (role === 'anaesthetist') return dr(name)
      return name
    },
    [dr]
  )

  const value = {
    lang,
    setLang,
    t,
    dr,
    formatName,
    isRTL: RTL_LANGS.has(lang),
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
