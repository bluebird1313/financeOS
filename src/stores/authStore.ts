import { create } from 'zustand'
import { supabase, isDemoMode } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { User, UserPreferences } from '@/types/database'

// Demo user for testing without Supabase
const DEMO_USER: SupabaseUser = {
  id: 'demo-user-id',
  email: 'demo@example.com',
  app_metadata: {},
  user_metadata: { full_name: 'Demo User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
}

const DEMO_PROFILE: User = {
  id: 'demo-user-id',
  email: 'demo@example.com',
  full_name: 'Demo User',
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const DEMO_PREFERENCES: UserPreferences = {
  id: 'demo-prefs-id',
  user_id: 'demo-user-id',
  theme: 'dark',
  currency: 'USD',
  date_format: 'MM/DD/YYYY',
  notifications_enabled: true,
  email_alerts: true,
  low_balance_threshold: 100,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

interface AuthState {
  user: SupabaseUser | null
  profile: User | null
  preferences: UserPreferences | null
  isLoading: boolean
  error: string | null
  isDemoMode: boolean
  
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>
  clearError: () => void
  enterDemoMode: () => void
}

// Track if initialization has started to prevent duplicate calls
let initializationStarted = false

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  preferences: null,
  isLoading: true,
  error: null,
  isDemoMode: isDemoMode,

  initialize: async () => {
    // Prevent duplicate initialization (especially with React StrictMode)
    if (initializationStarted) {
      return
    }
    initializationStarted = true
    
    try {
      set({ isLoading: true, error: null })
      
      // If in demo mode, skip Supabase initialization
      if (isDemoMode) {
        console.log('🎭 Demo Mode: Supabase not configured. Use "Enter Demo Mode" to test the UI.')
        set({ isLoading: false })
        return
      }
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        // Fetch user preferences
        const { data: preferences } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        
        set({ 
          user: session.user, 
          profile: profile || null, 
          preferences: preferences || null 
        })
      }
      
      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          const { data: preferences } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', session.user.id)
            .single()
          
          set({ user: session.user, profile, preferences })
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, profile: null, preferences: null })
        }
      })
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ error: 'Failed to initialize authentication' })
    } finally {
      set({ isLoading: false })
    }
  },

  enterDemoMode: () => {
    set({
      user: DEMO_USER,
      profile: DEMO_PROFILE,
      preferences: DEMO_PREFERENCES,
      isLoading: false,
      error: null,
    })
  },

  signIn: async (email, password) => {
    try {
      set({ isLoading: true, error: null })
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      
      if (data.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()
        
        const { data: preferences } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', data.user.id)
          .single()
        
        set({ user: data.user, profile, preferences })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed'
      set({ error: message })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  signUp: async (email, password, fullName) => {
    try {
      set({ isLoading: true, error: null })
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      
      if (error) throw error
      
      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email,
            full_name: fullName,
          })
        
        if (profileError) throw profileError
        
        // Create default preferences
        const { error: prefsError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: data.user.id,
          })
        
        if (prefsError) throw prefsError
        
        // Fetch the created records
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()
        
        const { data: preferences } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', data.user.id)
          .single()
        
        set({ user: data.user, profile, preferences })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed'
      set({ error: message })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true, error: null })
      await supabase.auth.signOut()
      set({ user: null, profile: null, preferences: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  updateProfile: async (updates) => {
    const { user } = get()
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()
      
      if (error) throw error
      set({ profile: data })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed'
      set({ error: message })
    }
  },

  updatePreferences: async (updates) => {
    const { user } = get()
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .single()
      
      if (error) throw error
      set({ preferences: data })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed'
      set({ error: message })
    }
  },

  clearError: () => set({ error: null }),
}))

