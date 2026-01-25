'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getUserProfile } from '@/lib/auth'
import { Profile } from '@/types'

interface AuthContextType {
  user: any
  profile: Profile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true
    let subscription: any = null
    let timeoutId: NodeJS.Timeout | null = null

    const initAuth = async () => {
      try {
        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn('Auth initialization timeout')
            setLoading(false)
          }
        }, 10000) // 10 second timeout

        if (!supabase) {
          if (mounted) {
            setLoading(false)
            if (timeoutId) clearTimeout(timeoutId)
          }
          return
        }

        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (!mounted) {
          if (timeoutId) clearTimeout(timeoutId)
          return
        }

        if (error || !user) {
          if (mounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
            if (timeoutId) clearTimeout(timeoutId)
          }
          return
        }

        if (mounted) setUser(user)

        try {
          const { data: profileData, error: profileError } = await getUserProfile(user.id)
          if (mounted) {
            if (profileData) {
              setProfile(profileData)
            } else if (profileError) {
              console.error('Profile error:', profileError)
            }
            setLoading(false)
            if (timeoutId) clearTimeout(timeoutId)
          }
        } catch (err) {
          console.error('Profile error:', err)
          if (mounted) {
            setLoading(false)
            if (timeoutId) clearTimeout(timeoutId)
          }
        }
      } catch (err) {
        console.error('Auth init error:', err)
        if (mounted) {
          setLoading(false)
          if (timeoutId) clearTimeout(timeoutId)
        }
      }
    }

    initAuth()

    if (supabase) {
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return
        
        if (!session) {
          setUser(null)
          setProfile(null)
        } else {
          setUser(session.user)
          getUserProfile(session.user.id)
            .then(({ data }) => {
              if (mounted && data) {
                setProfile(data)
              }
            })
            .catch(() => {})
        }
      })
      subscription = sub
    }

    return () => {
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  useEffect(() => {
    if (loading) return
    if (pathname === '/login') return

    if (!user && pathname !== '/login') {
      router.push('/login')
    }
  }, [user, loading, pathname, router])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
