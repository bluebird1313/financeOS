-- Migration 004: Add Projects table and remove Plaid integration
-- This migration adds project tracking for transactions and removes unused Plaid tables/columns

-- =====================================================
-- 1. ADD PROJECTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add project_id to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id) WHERE project_id IS NOT NULL;

-- RLS for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. REMOVE PLAID INTEGRATION
-- =====================================================

-- Rename plaid_transaction_id to external_reference_id (keep for import dedup)
ALTER TABLE transactions RENAME COLUMN plaid_transaction_id TO external_reference_id;

-- Drop plaid-specific columns from accounts
ALTER TABLE accounts DROP COLUMN IF EXISTS plaid_account_id;
ALTER TABLE accounts DROP COLUMN IF EXISTS plaid_item_id;

-- Drop plaid_items table (this will also drop the foreign key constraint)
DROP TABLE IF EXISTS plaid_items CASCADE;

-- =====================================================
-- 3. UPDATE INDEXES
-- =====================================================

-- Add index on external_reference_id for duplicate detection
CREATE INDEX IF NOT EXISTS idx_transactions_external_ref ON transactions(external_reference_id) 
  WHERE external_reference_id IS NOT NULL;

-- =====================================================
-- 4. CLEANUP FITID REFERENCES IN TRANSACTION_HASHES
-- =====================================================
-- The fitid column in transaction_hashes was used for Plaid's FITID
-- We'll keep it for OFX/QBO imports which also use FITID
COMMENT ON COLUMN transaction_hashes.fitid IS 'Financial Institution Transaction ID - used for OFX/QBO imports';

