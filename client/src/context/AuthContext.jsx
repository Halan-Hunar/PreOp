import { createContext, useContext, useEffect, useState } from 'react'
import * as authApi from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('preop_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => localStorage.getItem('preop_token'))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) localStorage.setItem('preop_token', token)
    else localStorage.removeItem('preop_token')
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('preop_user', JSON.stringify(user))
    else localStorage.removeItem('preop_user')
  }, [user])

  const login = async (email, password) => {
    setLoading(true)
    try {
      const data = await authApi.login(email, password)
      setToken(data.token)
      setUser(data.user)
      return data.user
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    setToken(null)
    setUser(null)
  }

  const hasRole = (...roles) => !!user && roles.includes(user.role)

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    logout,
    hasRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
