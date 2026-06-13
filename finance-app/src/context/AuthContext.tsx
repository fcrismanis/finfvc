import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { DATA_PROVIDER } from '../config/env'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  familyId: string | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function resolveFamilyId(userId: string): Promise<string | null> {
  // Try existing membership first
  const { data, error } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!error && data) return data.family_id as string

  // No membership — bootstrap via SECURITY DEFINER RPC
  const { data: newId, error: rpcError } = await supabase
    .rpc('create_family_for_user', { p_name: 'Minha Família' })

  if (rpcError) {
    console.error('[AuthContext] create_family_for_user failed:', rpcError.message)
    return null
  }

  return newId as string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  // loading=true only in supabase mode — local mode is instantly ready
  const [loading, setLoading] = useState(DATA_PROVIDER === 'supabase')

  useEffect(() => {
    if (DATA_PROVIDER !== 'supabase') return

    async function handleSession(sess: Session | null) {
      const u = sess?.user ?? null
      setUser(u)
      setSession(sess)
      if (u) {
        const fid = await resolveFamilyId(u.id)
        setFamilyId(fid)
      } else {
        setFamilyId(null)
      }
      setLoading(false)
    }

    // Initial session check
    supabase.auth.getSession().then(({ data }) => handleSession(data.session))

    // Subscribe to subsequent auth events (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      void handleSession(sess)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    if (DATA_PROVIDER === 'supabase') {
      await supabase.auth.signOut()
      setFamilyId(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, familyId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
