import { createContext, useContext, useMemo } from 'react'

const DEMO_USER = {
  id: 'demo-stylist',
  role: 'stylist',
  demo: true,
  dataNamespace: 'demo',
  salonAccess: true,
  mustChangePassword: false,
  hasCompletedHelpGuide: true,
  displayName: 'Mara',
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const value = useMemo(
    () => ({
      status: 'authenticated',
      user: DEMO_USER,
      token: '',
      error: '',
      setError() {},
      async login() {
        return DEMO_USER
      },
      async logout() {},
      async changePassword() {
        return DEMO_USER
      },
      async completeHelpGuide() {
        return DEMO_USER
      },
      async refreshUser() {
        return DEMO_USER
      },
      isAdmin: false,
      isStylist: true,
      isDemo: true,
      hasSalonAccess: true,
      mustChangePassword: false,
      hasCompletedHelpGuide: true,
    }),
    [],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
