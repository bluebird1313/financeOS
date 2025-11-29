-- Life Financial Operating System - Database Schema
-- Run this in your Supabase SQL editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  tax_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plaid Items table (stores Plaid connection info)
CREATE TABLE IF NOT EXISTS plaid_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  item_id TEXT NOT NULL,
  institution_id TEXT,
  institution_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'pending')),
  error_code TEXT,
  error_message TEXT,
  consent_expiration_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  plaid_account_id TEXT,
  plaid_item_id UUID REFERENCES plaid_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'loan', 'investment', 'other')),
  subtype TEXT,
  mask TEXT,
  current_balance DECIMAL(15,2) DEFAULT 0,
  available_balance DECIMAL(15,2),
  currency TEXT DEFAULT 'USD',
  institution_name TEXT,
  institution_id TEXT,
  is_manual BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plaid_transaction_id TEXT,
  amount DECIMAL(15,2) NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  merchant_name TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  pending BOOLEAN DEFAULT false,
  check_number TEXT,
  payment_channel TEXT,
  transaction_type TEXT,
  location JSONB,
  is_manual BOOLEAN DEFAULT false,
  notes TEXT,
  is_split BOOLEAN DEFAULT false,
  split_from_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  is_business_expense BOOLEAN DEFAULT false,
  tax_category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checks table
CREATE TABLE IF NOT EXISTS checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  check_number TEXT NOT NULL,
  payee TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  date_written DATE NOT NULL,
  date_cleared DATE,
  memo TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  matched_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'void')),
  image_url TEXT,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recurring Transactions table
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  merchant_name TEXT,
  amount DECIMAL(15,2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  last_date DATE,
  next_expected_date DATE,
  is_subscription BOOLEAN DEFAULT false,
  is_bill BOOLEAN DEFAULT false,
  is_income BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recurring_transaction_id UUID REFERENCES recurring_transactions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  due_date DATE NOT NULL,
  due_day_of_month INTEGER,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'yearly', 'one-time')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  is_autopay BOOLEAN DEFAULT false,
  reminder_days_before INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  last_paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('low_balance', 'large_transaction', 'unusual_spending', 'bill_due', 'bill_overdue', 'anomaly', 'insight')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  related_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  related_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  related_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  low_balance_threshold DECIMAL(15,2) DEFAULT 500,
  large_transaction_threshold DECIMAL(15,2) DEFAULT 1000,
  alert_email_enabled BOOLEAN DEFAULT true,
  alert_desktop_enabled BOOLEAN DEFAULT true,
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  default_currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_check_number ON transactions(check_number) WHERE check_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_checks_user_id ON checks(user_id);
CREATE INDEX IF NOT EXISTS idx_checks_check_number ON checks(check_number);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Businesses policies
CREATE POLICY "Users can view own businesses" ON businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own businesses" ON businesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own businesses" ON businesses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own businesses" ON businesses FOR DELETE USING (auth.uid() = user_id);

-- Plaid Items policies
CREATE POLICY "Users can view own plaid items" ON plaid_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plaid items" ON plaid_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plaid items" ON plaid_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plaid items" ON plaid_items FOR DELETE USING (auth.uid() = user_id);

-- Accounts policies
CREATE POLICY "Users can view own accounts" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON accounts FOR DELETE USING (auth.uid() = user_id);

-- Categories policies
CREATE POLICY "Users can view own and system categories" ON categories FOR SELECT 
  USING (auth.uid() = user_id OR is_system = true);
CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id AND is_system = false);
CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id AND is_system = false);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- Checks policies
CREATE POLICY "Users can view own checks" ON checks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checks" ON checks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checks" ON checks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own checks" ON checks FOR DELETE USING (auth.uid() = user_id);

-- Recurring Transactions policies
CREATE POLICY "Users can view own recurring transactions" ON recurring_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring transactions" ON recurring_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring transactions" ON recurring_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring transactions" ON recurring_transactions FOR DELETE USING (auth.uid() = user_id);

-- Bills policies
CREATE POLICY "Users can view own bills" ON bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bills" ON bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bills" ON bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bills" ON bills FOR DELETE USING (auth.uid() = user_id);

-- Alerts policies
CREATE POLICY "Users can view own alerts" ON alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON alerts FOR DELETE USING (auth.uid() = user_id);

-- User Preferences policies
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Insert default system categories
INSERT INTO categories (id, name, icon, color, is_system) VALUES
  (uuid_generate_v4(), 'Food & Dining', 'utensils', '#ef4444', true),
  (uuid_generate_v4(), 'Transportation', 'car', '#f59e0b', true),
  (uuid_generate_v4(), 'Shopping', 'shopping-bag', '#8b5cf6', true),
  (uuid_generate_v4(), 'Entertainment', 'film', '#ec4899', true),
  (uuid_generate_v4(), 'Bills & Utilities', 'receipt', '#06b6d4', true),
  (uuid_generate_v4(), 'Health & Medical', 'heart', '#10b981', true),
  (uuid_generate_v4(), 'Travel', 'plane', '#6366f1', true),
  (uuid_generate_v4(), 'Income', 'dollar-sign', '#22c55e', true),
  (uuid_generate_v4(), 'Transfer', 'arrow-left-right', '#64748b', true),
  (uuid_generate_v4(), 'Business', 'briefcase', '#0ea5e9', true),
  (uuid_generate_v4(), 'Personal Care', 'smile', '#f472b6', true),
  (uuid_generate_v4(), 'Education', 'graduation-cap', '#a855f7', true),
  (uuid_generate_v4(), 'Insurance', 'shield', '#14b8a6', true),
  (uuid_generate_v4(), 'Taxes', 'file-text', '#78716c', true),
  (uuid_generate_v4(), 'Other', 'more-horizontal', '#71717a', true)
ON CONFLICT DO NOTHING;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_plaid_items_updated_at BEFORE UPDATE ON plaid_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_checks_updated_at BEFORE UPDATE ON checks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurring_transactions_updated_at BEFORE UPDATE ON recurring_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


