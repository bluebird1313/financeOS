export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      businesses: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string | null
          tax_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: string | null
          tax_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          type?: string | null
          tax_id?: string | null
          updated_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          business_id: string | null
          plaid_account_id: string | null
          plaid_item_id: string | null
          name: string
          official_name: string | null
          type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'other'
          subtype: string | null
          mask: string | null
          current_balance: number
          available_balance: number | null
          currency: string
          institution_name: string | null
          institution_id: string | null
          is_manual: boolean
          is_hidden: boolean
          created_at: string
          updated_at: string
          last_synced_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          business_id?: string | null
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          name: string
          official_name?: string | null
          type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'other'
          subtype?: string | null
          mask?: string | null
          current_balance?: number
          available_balance?: number | null
          currency?: string
          institution_name?: string | null
          institution_id?: string | null
          is_manual?: boolean
          is_hidden?: boolean
          created_at?: string
          updated_at?: string
          last_synced_at?: string | null
        }
        Update: {
          business_id?: string | null
          name?: string
          current_balance?: number
          available_balance?: number | null
          is_hidden?: boolean
          updated_at?: string
          last_synced_at?: string | null
        }
      }
      plaid_items: {
        Row: {
          id: string
          user_id: string
          access_token: string
          item_id: string
          institution_id: string | null
          institution_name: string | null
          status: 'active' | 'error' | 'pending'
          error_code: string | null
          error_message: string | null
          consent_expiration_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          access_token: string
          item_id: string
          institution_id?: string | null
          institution_name?: string | null
          status?: 'active' | 'error' | 'pending'
          error_code?: string | null
          error_message?: string | null
          consent_expiration_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          status?: 'active' | 'error' | 'pending'
          error_code?: string | null
          error_message?: string | null
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          plaid_transaction_id: string | null
          amount: number
          date: string
          name: string
          merchant_name: string | null
          category_id: string | null
          pending: boolean
          check_number: string | null
          payment_channel: string | null
          transaction_type: string | null
          location: Json | null
          is_manual: boolean
          notes: string | null
          is_split: boolean
          split_from_id: string | null
          business_id: string | null
          is_business_expense: boolean
          tax_category: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          plaid_transaction_id?: string | null
          amount: number
          date: string
          name: string
          merchant_name?: string | null
          category_id?: string | null
          pending?: boolean
          check_number?: string | null
          payment_channel?: string | null
          transaction_type?: string | null
          location?: Json | null
          is_manual?: boolean
          notes?: string | null
          is_split?: boolean
          split_from_id?: string | null
          business_id?: string | null
          is_business_expense?: boolean
          tax_category?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          notes?: string | null
          business_id?: string | null
          is_business_expense?: boolean
          tax_category?: string | null
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string | null
          name: string
          icon: string | null
          color: string | null
          parent_id: string | null
          is_system: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          icon?: string | null
          color?: string | null
          parent_id?: string | null
          is_system?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          icon?: string | null
          color?: string | null
          parent_id?: string | null
        }
      }
      checks: {
        Row: {
          id: string
          user_id: string
          account_id: string
          check_number: string
          payee: string
          amount: number
          date_written: string
          date_cleared: string | null
          memo: string | null
          category_id: string | null
          matched_transaction_id: string | null
          status: 'pending' | 'cleared' | 'void'
          image_url: string | null
          business_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          check_number: string
          payee: string
          amount: number
          date_written: string
          date_cleared?: string | null
          memo?: string | null
          category_id?: string | null
          matched_transaction_id?: string | null
          status?: 'pending' | 'cleared' | 'void'
          image_url?: string | null
          business_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          payee?: string
          amount?: number
          date_cleared?: string | null
          memo?: string | null
          category_id?: string | null
          matched_transaction_id?: string | null
          status?: 'pending' | 'cleared' | 'void'
          image_url?: string | null
          business_id?: string | null
          updated_at?: string
        }
      }
      recurring_transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          name: string
          merchant_name: string | null
          amount: number
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
          category_id: string | null
          last_date: string | null
          next_expected_date: string | null
          is_subscription: boolean
          is_bill: boolean
          is_income: boolean
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          name: string
          merchant_name?: string | null
          amount: number
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
          category_id?: string | null
          last_date?: string | null
          next_expected_date?: string | null
          is_subscription?: boolean
          is_bill?: boolean
          is_income?: boolean
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          amount?: number
          frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
          category_id?: string | null
          next_expected_date?: string | null
          is_active?: boolean
          notes?: string | null
          updated_at?: string
        }
      }
      bills: {
        Row: {
          id: string
          user_id: string
          recurring_transaction_id: string | null
          name: string
          amount: number
          due_date: string
          due_day_of_month: number | null
          frequency: 'monthly' | 'quarterly' | 'yearly' | 'one-time'
          category_id: string | null
          account_id: string | null
          is_autopay: boolean
          reminder_days_before: number
          status: 'pending' | 'paid' | 'overdue'
          last_paid_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          recurring_transaction_id?: string | null
          name: string
          amount: number
          due_date: string
          due_day_of_month?: number | null
          frequency?: 'monthly' | 'quarterly' | 'yearly' | 'one-time'
          category_id?: string | null
          account_id?: string | null
          is_autopay?: boolean
          reminder_days_before?: number
          status?: 'pending' | 'paid' | 'overdue'
          last_paid_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          amount?: number
          due_date?: string
          status?: 'pending' | 'paid' | 'overdue'
          last_paid_date?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      alerts: {
        Row: {
          id: string
          user_id: string
          type: 'low_balance' | 'large_transaction' | 'unusual_spending' | 'bill_due' | 'bill_overdue' | 'anomaly' | 'insight'
          title: string
          message: string
          severity: 'info' | 'warning' | 'critical'
          related_account_id: string | null
          related_transaction_id: string | null
          related_bill_id: string | null
          is_read: boolean
          is_dismissed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'low_balance' | 'large_transaction' | 'unusual_spending' | 'bill_due' | 'bill_overdue' | 'anomaly' | 'insight'
          title: string
          message: string
          severity?: 'info' | 'warning' | 'critical'
          related_account_id?: string | null
          related_transaction_id?: string | null
          related_bill_id?: string | null
          is_read?: boolean
          is_dismissed?: boolean
          created_at?: string
        }
        Update: {
          is_read?: boolean
          is_dismissed?: boolean
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          low_balance_threshold: number
          large_transaction_threshold: number
          alert_email_enabled: boolean
          alert_desktop_enabled: boolean
          theme: 'dark' | 'light' | 'system'
          default_currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          low_balance_threshold?: number
          large_transaction_threshold?: number
          alert_email_enabled?: boolean
          alert_desktop_enabled?: boolean
          theme?: 'dark' | 'light' | 'system'
          default_currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          low_balance_threshold?: number
          large_transaction_threshold?: number
          alert_email_enabled?: boolean
          alert_desktop_enabled?: boolean
          theme?: 'dark' | 'light' | 'system'
          default_currency?: string
          updated_at?: string
        }
      }
    }
  }
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row']
export type Business = Database['public']['Tables']['businesses']['Row']
export type Account = Database['public']['Tables']['accounts']['Row']
export type PlaidItem = Database['public']['Tables']['plaid_items']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Check = Database['public']['Tables']['checks']['Row']
export type RecurringTransaction = Database['public']['Tables']['recurring_transactions']['Row']
export type Bill = Database['public']['Tables']['bills']['Row']
export type Alert = Database['public']['Tables']['alerts']['Row']
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']

// Document Import types
export interface DocumentImport {
  id: string
  user_id: string
  file_name: string
  file_type: string
  file_size: number | null
  storage_path: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review'
  source_type: string | null
  detected_account_id: string | null
  detected_institution: string | null
  transactions_found: number
  transactions_imported: number
  transactions_pending_review: number
  error_message: string | null
  ai_summary: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

export interface PendingImportItem {
  id: string
  user_id: string
  document_import_id: string | null
  item_type: 'transaction' | 'check' | 'bill' | 'transfer'
  date: string
  amount: number
  description: string
  merchant_name: string | null
  suggested_account_id: string | null
  suggested_category_id: string | null
  suggested_business_id: string | null
  is_business_expense: boolean
  check_number: string | null
  payee: string | null
  memo: string | null
  ai_confidence: number
  ai_notes: string | null
  needs_review_reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'modified' | 'duplicate'
  reviewed_at: string | null
  imported_transaction_id: string | null
  imported_check_id: string | null
  created_at: string
  updated_at: string
}


