import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { 
  Account, 
  Transaction, 
  Check, 
  Bill, 
  RecurringTransaction, 
  Business, 
  Category,
  Alert,
  Project,
  ImportProfile
} from '@/types/database'

interface FinancialState {
  // Data
  accounts: Account[]
  transactions: Transaction[]
  checks: Check[]
  bills: Bill[]
  recurringTransactions: RecurringTransaction[]
  businesses: Business[]
  categories: Category[]
  alerts: Alert[]
  projects: Project[]
  importProfiles: ImportProfile[]
  
  // Loading states
  isLoadingAccounts: boolean
  isLoadingTransactions: boolean
  isLoadingChecks: boolean
  isLoadingBills: boolean
  isLoadingProjects: boolean
  
  // Filters
  selectedAccountId: string | null
  selectedBusinessId: string | null
  selectedProjectId: string | null
  dateRange: { start: Date; end: Date }
  
  // Actions
  fetchAccounts: (userId: string) => Promise<void>
  fetchTransactions: (userId: string, accountId?: string) => Promise<void>
  fetchChecks: (userId: string) => Promise<void>
  fetchBills: (userId: string) => Promise<void>
  fetchRecurringTransactions: (userId: string) => Promise<void>
  fetchBusinesses: (userId: string) => Promise<void>
  fetchCategories: (userId: string) => Promise<void>
  fetchAlerts: (userId: string) => Promise<void>
  fetchProjects: (userId: string) => Promise<void>
  fetchImportProfiles: (userId: string) => Promise<void>
  
  // Mutations
  addAccount: (account: Partial<Account>) => Promise<Account | null>
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>
  deleteAccount: (id: string) => Promise<boolean>
  addTransaction: (transaction: Partial<Transaction>) => Promise<Transaction | null>
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<boolean>
  deleteAllTransactions: (userId: string) => Promise<boolean>
  addCheck: (check: Partial<Check>) => Promise<Check | null>
  updateCheck: (id: string, updates: Partial<Check>) => Promise<void>
  matchCheckToTransaction: (checkId: string, transactionId: string) => Promise<void>
  addBill: (bill: Partial<Bill>) => Promise<Bill | null>
  updateBill: (id: string, updates: Partial<Bill>) => Promise<void>
  addRecurringTransaction: (transaction: Partial<RecurringTransaction>) => Promise<RecurringTransaction | null>
  updateRecurringTransaction: (id: string, updates: Partial<RecurringTransaction>) => Promise<void>
  deleteRecurringTransaction: (id: string) => Promise<boolean>
  addBusiness: (business: Partial<Business>) => Promise<Business | null>
  markAlertRead: (id: string) => Promise<void>
  dismissAlert: (id: string) => Promise<void>
  
  // Project mutations
  addProject: (project: Partial<Project>) => Promise<Project | null>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<boolean>
  
  // Import Profile mutations
  addImportProfile: (profile: Partial<ImportProfile>) => Promise<ImportProfile | null>
  updateImportProfile: (id: string, updates: Partial<ImportProfile>) => Promise<void>
  deleteImportProfile: (id: string) => Promise<boolean>
  
  // Filters
  setSelectedAccount: (id: string | null) => void
  setSelectedBusiness: (id: string | null) => void
  setSelectedProject: (id: string | null) => void
  setDateRange: (start: Date, end: Date) => void
  
  // Computed
  getNetWorth: () => number
  getUnmatchedChecks: () => Check[]
  getUpcomingBills: () => Bill[]
  getRecentTransactions: (limit?: number) => Transaction[]
  getTransactionCountByProject: (projectId: string) => number
}

export const useFinancialStore = create<FinancialState>((set, get) => ({
  // Initial state
  accounts: [],
  transactions: [],
  checks: [],
  bills: [],
  recurringTransactions: [],
  businesses: [],
  categories: [],
  alerts: [],
  projects: [],
  importProfiles: [],
  isLoadingAccounts: false,
  isLoadingTransactions: false,
  isLoadingChecks: false,
  isLoadingBills: false,
  isLoadingProjects: false,
  selectedAccountId: null,
  selectedBusinessId: null,
  selectedProjectId: null,
  dateRange: {
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    end: new Date(),
  },

  // Fetch actions
  fetchAccounts: async (userId) => {
    set({ isLoadingAccounts: true })
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      set({ accounts: data || [] })
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      set({ isLoadingAccounts: false })
    }
  },

  fetchTransactions: async (userId, accountId) => {
    set({ isLoadingTransactions: true })
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(500)
      
      if (accountId) {
        query = query.eq('account_id', accountId)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      set({ transactions: data || [] })
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      set({ isLoadingTransactions: false })
    }
  },

  fetchChecks: async (userId) => {
    set({ isLoadingChecks: true })
    try {
      const { data, error } = await supabase
        .from('checks')
        .select('*')
        .eq('user_id', userId)
        .order('date_written', { ascending: false })
      
      if (error) throw error
      set({ checks: data || [] })
    } catch (error) {
      console.error('Error fetching checks:', error)
    } finally {
      set({ isLoadingChecks: false })
    }
  },

  fetchBills: async (userId) => {
    set({ isLoadingBills: true })
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })
      
      if (error) throw error
      set({ bills: data || [] })
    } catch (error) {
      console.error('Error fetching bills:', error)
    } finally {
      set({ isLoadingBills: false })
    }
  },

  fetchRecurringTransactions: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name', { ascending: true })
      
      if (error) throw error
      set({ recurringTransactions: data || [] })
    } catch (error) {
      console.error('Error fetching recurring transactions:', error)
    }
  },

  fetchBusinesses: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true })
      
      if (error) throw error
      set({ businesses: data || [] })
    } catch (error) {
      console.error('Error fetching businesses:', error)
    }
  },

  fetchCategories: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${userId},is_system.eq.true`)
        .order('name', { ascending: true })
      
      if (error) throw error
      set({ categories: data || [] })
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  },

  fetchAlerts: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      set({ alerts: data || [] })
    } catch (error) {
      console.error('Error fetching alerts:', error)
    }
  },

  fetchProjects: async (userId) => {
    set({ isLoadingProjects: true })
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true })
      
      if (error) throw error
      set({ projects: data || [] })
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      set({ isLoadingProjects: false })
    }
  },

  fetchImportProfiles: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('import_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true })
      
      if (error) throw error
      set({ importProfiles: data || [] })
    } catch (error) {
      console.error('Error fetching import profiles:', error)
    }
  },

  // Mutations
  addAccount: async (account) => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .insert(account)
        .select()
        .single()
      
      if (error) throw error
      set(state => ({ accounts: [data, ...state.accounts] }))
      return data
    } catch (error) {
      console.error('Error adding account:', error)
      return null
    }
  },

  updateAccount: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        accounts: state.accounts.map(a => 
          a.id === id ? { ...a, ...updates } : a
        ),
      }))
    } catch (error) {
      console.error('Error updating account:', error)
    }
  },

  deleteAccount: async (id) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        accounts: state.accounts.filter(a => a.id !== id),
      }))
      return true
    } catch (error) {
      console.error('Error deleting account:', error)
      return false
    }
  },

  addTransaction: async (transaction) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert(transaction)
        .select()
        .single()
      
      if (error) throw error
      set(state => ({ transactions: [data, ...state.transactions] }))
      return data
    } catch (error) {
      console.error('Error adding transaction:', error)
      return null
    }
  },

  updateTransaction: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        transactions: state.transactions.map(t => 
          t.id === id ? { ...t, ...updates } : t
        ),
      }))
    } catch (error) {
      console.error('Error updating transaction:', error)
    }
  },

  deleteTransaction: async (id) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        transactions: state.transactions.filter(t => t.id !== id),
      }))
      return true
    } catch (error) {
      console.error('Error deleting transaction:', error)
      return false
    }
  },

  deleteAllTransactions: async (userId) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', userId)
      
      if (error) throw error
      set({ transactions: [] })
      return true
    } catch (error) {
      console.error('Error deleting all transactions:', error)
      return false
    }
  },

  addCheck: async (check) => {
    try {
      const { data, error } = await supabase
        .from('checks')
        .insert(check)
        .select()
        .single()
      
      if (error) throw error
      set(state => ({ checks: [data, ...state.checks] }))
      return data
    } catch (error) {
      console.error('Error adding check:', error)
      return null
    }
  },

  updateCheck: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('checks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        checks: state.checks.map(c => 
          c.id === id ? { ...c, ...updates } : c
        ),
      }))
    } catch (error) {
      console.error('Error updating check:', error)
    }
  },

  matchCheckToTransaction: async (checkId, transactionId) => {
    try {
      const { error } = await supabase
        .from('checks')
        .update({ 
          matched_transaction_id: transactionId,
          status: 'cleared',
          updated_at: new Date().toISOString(),
        })
        .eq('id', checkId)
      
      if (error) throw error
      set(state => ({
        checks: state.checks.map(c => 
          c.id === checkId 
            ? { ...c, matched_transaction_id: transactionId, status: 'cleared' as const }
            : c
        ),
      }))
    } catch (error) {
      console.error('Error matching check:', error)
    }
  },

  addBill: async (bill) => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .insert(bill)
        .select()
        .single()
      
      if (error) throw error
      set(state => ({ bills: [data, ...state.bills] }))
      return data
    } catch (error) {
      console.error('Error adding bill:', error)
      return null
    }
  },

  updateBill: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('bills')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        bills: state.bills.map(b => 
          b.id === id ? { ...b, ...updates } : b
        ),
      }))
    } catch (error) {
      console.error('Error updating bill:', error)
    }
  },

  addRecurringTransaction: async (transaction) => {
    try {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .insert(transaction)
        .select()
        .single()
      
      if (error) throw error
      set(state => ({ recurringTransactions: [data, ...state.recurringTransactions] }))
      return data
    } catch (error) {
      console.error('Error adding recurring transaction:', error)
      return null
    }
  },

  updateRecurringTransaction: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        recurringTransactions: state.recurringTransactions.map(r => 
          r.id === id ? { ...r, ...updates } : r
        ),
      }))
    } catch (error) {
      console.error('Error updating recurring transaction:', error)
    }
  },

  deleteRecurringTransaction: async (id) => {
    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        recurringTransactions: state.recurringTransactions.filter(r => r.id !== id),
      }))
      return true
    } catch (error) {
      console.error('Error deleting recurring transaction:', error)
      return false
    }
  },

  addBusiness: async (business) => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .insert(business)
        .select()
        .single()
      
      if (error) throw error
      set(state => ({ businesses: [...state.businesses, data] }))
      return data
    } catch (error) {
      console.error('Error adding business:', error)
      return null
    }
  },

  markAlertRead: async (id) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        alerts: state.alerts.map(a => 
          a.id === id ? { ...a, is_read: true } : a
        ),
      }))
    } catch (error) {
      console.error('Error marking alert read:', error)
    }
  },

  dismissAlert: async (id) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_dismissed: true })
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        alerts: state.alerts.filter(a => a.id !== id),
      }))
    } catch (error) {
      console.error('Error dismissing alert:', error)
    }
  },

  // Project mutations
  addProject: async (project) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single()
      
      if (error) throw error
      set(state => ({ projects: [...state.projects, data] }))
      return data
    } catch (error) {
      console.error('Error adding project:', error)
      return null
    }
  },

  updateProject: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        projects: state.projects.map(p => 
          p.id === id ? { ...p, ...updates } : p
        ),
      }))
    } catch (error) {
      console.error('Error updating project:', error)
    }
  },

  deleteProject: async (id) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        projects: state.projects.filter(p => p.id !== id),
      }))
      return true
    } catch (error) {
      console.error('Error deleting project:', error)
      return false
    }
  },

  // Import Profile mutations
  addImportProfile: async (profile) => {
    try {
      const { data, error } = await supabase
        .from('import_profiles')
        .insert(profile)
        .select()
        .single()
      
      if (error) throw error
      set(state => ({ importProfiles: [...state.importProfiles, data] }))
      return data
    } catch (error) {
      console.error('Error adding import profile:', error)
      return null
    }
  },

  updateImportProfile: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('import_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        importProfiles: state.importProfiles.map(p => 
          p.id === id ? { ...p, ...updates } : p
        ),
      }))
    } catch (error) {
      console.error('Error updating import profile:', error)
    }
  },

  deleteImportProfile: async (id) => {
    try {
      const { error } = await supabase
        .from('import_profiles')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      set(state => ({
        importProfiles: state.importProfiles.filter(p => p.id !== id),
      }))
      return true
    } catch (error) {
      console.error('Error deleting import profile:', error)
      return false
    }
  },

  // Filters
  setSelectedAccount: (id) => set({ selectedAccountId: id }),
  setSelectedBusiness: (id) => set({ selectedBusinessId: id }),
  setSelectedProject: (id) => set({ selectedProjectId: id }),
  setDateRange: (start, end) => set({ dateRange: { start, end } }),

  // Computed
  getNetWorth: () => {
    const { accounts } = get()
    return accounts.reduce((total, account) => {
      if (account.type === 'credit' || account.type === 'loan') {
        return total - account.current_balance
      }
      return total + account.current_balance
    }, 0)
  },

  getUnmatchedChecks: () => {
    const { checks } = get()
    return checks.filter(c => c.status === 'pending' && !c.matched_transaction_id)
  },

  getUpcomingBills: () => {
    const { bills } = get()
    const now = new Date()
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    
    return bills.filter(b => {
      const dueDate = new Date(b.due_date)
      return dueDate >= now && dueDate <= twoWeeksFromNow && b.status !== 'paid'
    })
  },

  getRecentTransactions: (limit = 10) => {
    const { transactions } = get()
    return transactions.slice(0, limit)
  },

  getTransactionCountByProject: (projectId: string) => {
    const { transactions } = get()
    return transactions.filter(t => t.project_id === projectId).length
  },
}))


