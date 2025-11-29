import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Demo mode: Check if we have valid Supabase credentials
export const isDemoMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://your-project.supabase.co'

// Create a placeholder client for demo mode, or real client for production
export const supabase: SupabaseClient<Database> = isDemoMode 
  ? createClient<Database>('https://placeholder.supabase.co', 'placeholder-key')
  : createClient<Database>(supabaseUrl, supabaseAnonKey)

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw error
}

