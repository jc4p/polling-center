'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { sdk } from '@farcaster/frame-sdk'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Auto-authenticate when component mounts
  useEffect(() => {
    const authenticate = async () => {
      if (typeof window !== 'undefined') {
        setIsLoading(true)
        try {
          const result = await sdk.experimental.quickAuth()
          if (result.token) {
            setToken(result.token)
            setIsAuthenticated(true)
          }
        } catch (error) {
          // Auto-authentication failed
        } finally {
          setIsLoading(false)
        }
      }
    }

    authenticate()
  }, [])

  const getAuthHeaders = () => {
    if (!token) return {}
    return {
      'Authorization': `Bearer ${token}`
    }
  }

  const value = {
    token,
    isLoading,
    isAuthenticated,
    getAuthHeaders
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}