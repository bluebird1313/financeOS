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
  Alert 
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
  
  // Loading states
  isLoadingAccounts: boolean
  isLoadingTransactions: boolean
  isLoadingChecks: boolean
  isLoadingBills: boolean
  
  // Filters
  selectedAccountId: string | null
  selectedBusinessId: string | null
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
  
  // Mutations
  addAccount: (account: Partial<Account>) => Promise<Account | null>
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>
  addTransaction: (transaction: Partial<Transaction>) => Promise<Transaction | null>
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  addCheck: (check: Partial<Check>) => Promise<Check | null>
  updateCheck: (id: string, updates: Partial<Check>) => Promise<void>
  matchCheckToTransaction: (checkId: string, transactionId: string) => Promise<void>
  addBill: (bill: Partial<Bill>) => Promise<Bill | null>
  updateBill: (id: string, updates: Partial<Bill>) => Promise<void>
  addBusiness: (business: Partial<Business>) => Promise<Business | null>
  markAlertRead: (id: string) => Promise<void>
  dismissAlert: (id: string) => Promise<void>
  
  // Filters
  setSelectedAccount: (id: string | null) => void
  setSelectedBusiness: (id: string | null) => void
  setDateRange: (start: Date, end: Date) => void
  
  // Computed
  getNetWorth: () => number
  getUnmatchedChecks: () => Check[]
  getUpcomingBills: () => Bill[]
  getRecentTransactions: (limit?: number) => Transaction[]
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
  isLoadingAccounts: false,
  isLoadingTransactions: false,
  isLoadingChecks: false,
  isLoadingBills: false,
  selectedAccountId: null,
  selectedBusinessId: null,
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

  // Filters
  setSelectedAccount: (id) => set({ selectedAccountId: id }),
  setSelectedBusiness: (id) => set({ selectedBusinessId: id }),
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
}))


