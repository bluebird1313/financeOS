-- Import System Migration
-- Adds support for financial entities and flexible transaction imports

-- =====================================================
-- FINANCIAL ENTITIES (extends businesses concept)
-- =====================================================
-- Note: We're using the existing 'businesses' table but adding a special 
-- "Personal" entity type. This allows filtering by Personal, Business1, Business2, etc.

-- Add entity_type to businesses to distinguish personal from business
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'business' 
  CHECK (entity_type IN ('personal', 'business', 'side_hustle', 'rental', 'investment'));

-- Add icon and color for visual distinction
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'briefcase';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#0ea5e9';

-- Add is_default flag (for the primary personal entity)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- =====================================================
-- IMPORT PROFILES (saved column mappings per bank)
-- =====================================================
CREATE TABLE IF NOT EXISTS import_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Chase Personal Checking", "Wells Fargo Business"
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'xls', 'qbo', 'qfx', 'ofx')),
  
  -- For CSV/Excel files, store column mappings
  column_mappings JSONB, -- {"date": "Trans Date", "amount": "Amount", "description": "Description", ...}
  
  -- File-specific settings
  date_format TEXT, -- "MM/DD/YYYY", "YYYY-MM-DD", etc.
  has_header_row BOOLEAN DEFAULT true,
  skip_rows INTEGER DEFAULT 0,
  amount_is_negative_for_debits BOOLEAN DEFAULT true,
  has_separate_debit_credit BOOLEAN DEFAULT false,
  
  -- Default account/entity for this profile
  default_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  default_entity_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  
  -- AI learning
  ai_category_rules JSONB DEFAULT '{}', -- {"AMAZON": "category_id", "SPOTIFY": "category_id"}
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, name)
);

-- =====================================================
-- IMPORT SESSIONS (track each import attempt)
-- =====================================================
CREATE TABLE IF NOT EXISTS import_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  import_profile_id UUID REFERENCES import_profiles(id) ON DELETE SET NULL,
  
  -- File info
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'mapping', 'reviewing', 'importing', 'completed', 'failed')),
  
  -- Results
  total_rows INTEGER DEFAULT 0,
  transactions_created INTEGER DEFAULT 0,
  duplicates_skipped INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  -- Target
  target_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  target_entity_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  
  -- Metadata
  error_message TEXT,
  import_summary JSONB, -- Summary of what was imported
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =====================================================
-- STAGED TRANSACTIONS (temporary holding for review)
-- =====================================================
CREATE TABLE IF NOT EXISTS staged_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  import_session_id UUID NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  
  -- Raw data from file
  raw_data JSONB NOT NULL, -- Original row data
  row_number INTEGER,
  
  -- Parsed fields
  date DATE,
  amount DECIMAL(15,2),
  description TEXT,
  memo TEXT,
  check_number TEXT,
  reference_id TEXT, -- For duplicate detection (FITID from QBO, or generated hash)
  
  -- AI suggestions
  suggested_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  suggested_merchant_name TEXT,
  ai_confidence DECIMAL(3,2), -- 0.00 to 1.00
  
  -- Review status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate', 'modified')),
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  
  -- User modifications
  user_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  user_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TRANSACTION HASHES (for duplicate detection)
-- =====================================================
CREATE TABLE IF NOT EXISTS transaction_hashes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  -- Hash components
  hash TEXT NOT NULL, -- SHA256 of date+amount+description normalized
  fitid TEXT, -- Financial Institution Transaction ID (from QBO/OFX)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint to prevent exact duplicates
  UNIQUE(user_id, account_id, hash)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_import_profiles_user_id ON import_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_user_id ON import_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_staged_transactions_session ON staged_transactions(import_session_id);
CREATE INDEX IF NOT EXISTS idx_staged_transactions_status ON staged_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transaction_hashes_lookup ON transaction_hashes(user_id, account_id, hash);
CREATE INDEX IF NOT EXISTS idx_transaction_hashes_fitid ON transaction_hashes(fitid) WHERE fitid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_entity_type ON businesses(entity_type);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE import_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staged_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_hashes ENABLE ROW LEVEL SECURITY;

-- Import profiles policies
CREATE POLICY "Users can view own import profiles" ON import_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own import profiles" ON import_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own import profiles" ON import_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own import profiles" ON import_profiles FOR DELETE USING (auth.uid() = user_id);

-- Import sessions policies
CREATE POLICY "Users can view own import sessions" ON import_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own import sessions" ON import_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own import sessions" ON import_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own import sessions" ON import_sessions FOR DELETE USING (auth.uid() = user_id);

-- Staged transactions policies
CREATE POLICY "Users can view own staged transactions" ON staged_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own staged transactions" ON staged_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own staged transactions" ON staged_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own staged transactions" ON staged_transactions FOR DELETE USING (auth.uid() = user_id);

-- Transaction hashes policies
CREATE POLICY "Users can view own transaction hashes" ON transaction_hashes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transaction hashes" ON transaction_hashes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own transaction hashes" ON transaction_hashes FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_import_profiles_updated_at BEFORE UPDATE ON import_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTION: Generate transaction hash
-- =====================================================
CREATE OR REPLACE FUNCTION generate_transaction_hash(
  p_date DATE,
  p_amount DECIMAL,
  p_description TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    sha256(
      (COALESCE(p_date::TEXT, '') || '|' || 
       COALESCE(p_amount::TEXT, '0') || '|' || 
       LOWER(TRIM(COALESCE(p_description, ''))))::bytea
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- AUTO-CREATE HASH ON TRANSACTION INSERT
-- =====================================================
CREATE OR REPLACE FUNCTION create_transaction_hash()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO transaction_hashes (user_id, transaction_id, account_id, hash, fitid)
  VALUES (
    NEW.user_id,
    NEW.id,
    NEW.account_id,
    generate_transaction_hash(NEW.date, NEW.amount, NEW.name),
    NEW.plaid_transaction_id
  )
  ON CONFLICT (user_id, account_id, hash) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_hash_trigger
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION create_transaction_hash();

