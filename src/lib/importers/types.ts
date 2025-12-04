// Import System Types

export interface ParsedTransaction {
  date: string | null
  amount: number | null
  description: string
  memo?: string
  checkNumber?: string
  referenceId?: string // FITID or generated hash
  type?: 'debit' | 'credit' | 'check' | 'transfer'
  rawData: Record<string, unknown>
  rowNumber: number
}

export interface DetectedAccount {
  accountId?: string        // Full account ID if available
  mask?: string             // Last 4 digits
  accountType?: 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'other'
  bankId?: string           // Bank routing number if available
  institutionName?: string  // Detected institution name
}

export interface ParseResult {
  success: boolean
  transactions: ParsedTransaction[]
  headers?: string[]
  fileType: 'csv' | 'xlsx' | 'xls' | 'qbo' | 'qfx' | 'ofx'
  detectedFormat?: DetectedFormat
  detectedAccount?: DetectedAccount  // Account info detected from file
  errors: ParseError[]
  warnings: string[]
}

export interface ParseError {
  row?: number
  column?: string
  message: string
  severity: 'error' | 'warning'
}

export interface DetectedFormat {
  dateColumn?: string
  amountColumn?: string
  descriptionColumn?: string
  memoColumn?: string
  debitColumn?: string
  creditColumn?: string
  checkNumberColumn?: string
  balanceColumn?: string
  dateFormat?: string
  hasHeaderRow: boolean
  amountStyle: 'single' | 'split' // single amount column vs separate debit/credit
  confidence: number
}

export interface ColumnMapping {
  date: string | null
  amount: string | null
  description: string | null
  memo: string | null
  debit: string | null
  credit: string | null
  checkNumber: string | null
  balance: string | null // Usually skipped but detected
  referenceId: string | null
}

export interface ImportProfile {
  id: string
  userId: string
  name: string
  fileType: 'csv' | 'xlsx' | 'xls' | 'qbo' | 'qfx' | 'ofx'
  columnMappings: ColumnMapping | null
  dateFormat: string | null
  hasHeaderRow: boolean
  skipRows: number
  amountIsNegativeForDebits: boolean
  hasSeparateDebitCredit: boolean
  defaultAccountId: string | null
  defaultEntityId: string | null
  aiCategoryRules: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface ImportSession {
  id: string
  userId: string
  importProfileId: string | null
  fileName: string
  fileType: string
  fileSize: number | null
  status: 'pending' | 'mapping' | 'reviewing' | 'importing' | 'completed' | 'failed'
  totalRows: number
  transactionsCreated: number
  duplicatesSkipped: number
  errorsCount: number
  targetAccountId: string | null
  targetEntityId: string | null
  errorMessage: string | null
  importSummary: Record<string, unknown> | null
  createdAt: string
  completedAt: string | null
}

export interface StagedTransaction {
  id: string
  userId: string
  importSessionId: string
  rawData: Record<string, unknown>
  rowNumber: number
  date: string | null
  amount: number | null
  description: string | null
  memo: string | null
  checkNumber: string | null
  referenceId: string | null
  suggestedCategoryId: string | null
  suggestedMerchantName: string | null
  aiConfidence: number | null
  status: 'pending' | 'approved' | 'rejected' | 'duplicate' | 'modified'
  isDuplicate: boolean
  duplicateOfId: string | null
  userCategoryId: string | null
  userNotes: string | null
  createdAt: string
}

// AI Categorization types
export interface CategorySuggestion {
  categoryId: string
  categoryName: string
  confidence: number
  reason?: string
}

export interface MerchantCleanup {
  original: string
  cleaned: string
  confidence: number
}

export interface AICategorizationResult {
  transactions: Array<{
    rowNumber: number
    category: CategorySuggestion | null
    merchant: MerchantCleanup | null
  }>
}



