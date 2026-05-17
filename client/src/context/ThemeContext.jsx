import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'preop_theme'
const ThemeContext = createContext(null)

function applyClass(theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') return stored
    } catch {
      /* ignore */
    }
    return 'light'
  })

  useEffect(() => {
    applyClass(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next) => {
    if (next === 'light' || next === 'dark') setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

// Read the persisted theme synchronously and slap the class on <html> before
// React mounts — this prevents a light-mode flash for dark-mode users.
export function applyStoredThemeEarly() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    applyClass(stored === 'dark' ? 'dark' : 'light')
  } catch {
    /* ignore */
  }
}
