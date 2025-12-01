// CSV Parser with Smart Column Detection

import type { ParseResult, ParsedTransaction, DetectedFormat, ColumnMapping, ParseError } from './types'

// Common date formats to try
const DATE_FORMATS = [
  { regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/, format: 'MM/DD/YYYY' },
  { regex: /^\d{1,2}\/\d{1,2}\/\d{2}$/, format: 'MM/DD/YY' },
  { regex: /^\d{4}-\d{2}-\d{2}$/, format: 'YYYY-MM-DD' },
  { regex: /^\d{2}-\d{2}-\d{4}$/, format: 'DD-MM-YYYY' },
  { regex: /^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/, format: 'DD-MMM-YY' },
  { regex: /^[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}$/, format: 'MMM DD, YYYY' },
]

// Keywords for column detection (case-insensitive)
const COLUMN_PATTERNS = {
  date: ['date', 'trans date', 'transaction date', 'posted', 'posting date', 'post date', 'effective date', 'value date', 'dt'],
  amount: ['amount', 'amt', 'sum', 'total', 'value', 'transaction amount'],
  description: ['description', 'desc', 'narrative', 'details', 'transaction', 'memo', 'particulars', 'payee', 'name', 'merchant'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'dr', 'money out', 'out', 'payment', 'charge', 'spent'],
  credit: ['credit', 'deposit', 'deposits', 'cr', 'money in', 'in', 'received'],
  balance: ['balance', 'running balance', 'available', 'ledger balance', 'current balance'],
  checkNumber: ['check', 'check #', 'check number', 'cheque', 'check no', 'ck #', 'chk'],
  memo: ['memo', 'note', 'notes', 'reference', 'ref', 'additional info'],
  referenceId: ['reference', 'ref', 'transaction id', 'trans id', 'id', 'confirmation'],
}

/**
 * Parse CSV text into rows
 */
export function parseCSVText(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        currentCell += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false
      } else {
        currentCell += char
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true
      } else if (char === ',') {
        // Field separator
        currentRow.push(currentCell.trim())
        currentCell = ''
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        // Row separator
        currentRow.push(currentCell.trim())
        if (currentRow.some(cell => cell !== '')) {
          rows.push(currentRow)
        }
        currentRow = []
        currentCell = ''
        if (char === '\r') i++ // Skip \n in \r\n
      } else if (char !== '\r') {
        currentCell += char
      }
    }
  }

  // Don't forget the last cell/row
  currentRow.push(currentCell.trim())
  if (currentRow.some(cell => cell !== '')) {
    rows.push(currentRow)
  }

  return rows
}

/**
 * Detect if a string looks like a date
 */
function isLikelyDate(value: string): boolean {
  if (!value) return false
  return DATE_FORMATS.some(df => df.regex.test(value.trim()))
}

/**
 * Detect if a string looks like a number/amount
 */
function isLikelyAmount(value: string): boolean {
  if (!value) return false
  // Remove currency symbols, commas, spaces
  const cleaned = value.replace(/[$€£¥,\s]/g, '').trim()
  // Check if it's a valid number (including negative)
  return /^-?\d+\.?\d*$/.test(cleaned) || /^\(-?\d+\.?\d*\)$/.test(cleaned)
}

/**
 * Parse amount string to number
 */
export function parseAmount(value: string): number | null {
  if (!value || value.trim() === '') return null
  
  // Remove currency symbols, commas, spaces
  let cleaned = value.replace(/[$€£¥,\s]/g, '').trim()
  
  // Handle parentheses notation for negative (common in accounting)
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }
  
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Parse date string to ISO format
 */
export function parseDate(value: string, format?: string): string | null {
  if (!value || value.trim() === '') return null
  
  const trimmed = value.trim()
  
  // Try to detect format and parse
  for (const df of DATE_FORMATS) {
    if (df.regex.test(trimmed)) {
      try {
        let date: Date | null = null
        
        if (df.format === 'YYYY-MM-DD') {
          date = new Date(trimmed)
        } else if (df.format === 'MM/DD/YYYY') {
          const parts = trimmed.split('/')
          date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]))
        } else if (df.format === 'MM/DD/YY') {
          const parts = trimmed.split('/')
          let year = parseInt(parts[2])
          year = year < 50 ? 2000 + year : 1900 + year
          date = new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]))
        } else if (df.format === 'DD-MM-YYYY') {
          const parts = trimmed.split('-')
          date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        } else if (df.format === 'DD-MMM-YY' || df.format === 'MMM DD, YYYY') {
          date = new Date(trimmed)
        }
        
        if (date && !isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]
        }
      } catch {
        continue
      }
    }
  }
  
  // Last resort: try native Date parsing
  try {
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch {
    // Ignore
  }
  
  return null
}

/**
 * Match column header to field type
 */
function matchColumnToField(header: string): keyof typeof COLUMN_PATTERNS | null {
  const normalized = header.toLowerCase().trim()
  
  for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalized === pattern || normalized.includes(pattern)) {
        return field as keyof typeof COLUMN_PATTERNS
      }
    }
  }
  
  return null
}

/**
 * Detect column mappings from headers and sample data
 */
export function detectColumnMappings(headers: string[], sampleRows: string[][]): DetectedFormat {
  const mapping: DetectedFormat = {
    hasHeaderRow: true,
    amountStyle: 'single',
    confidence: 0,
  }
  
  let confidencePoints = 0
  let maxPoints = 0
  
  // First pass: match by header names
  headers.forEach((header, index) => {
    const match = matchColumnToField(header)
    if (match) {
      maxPoints += 2
      confidencePoints += 2
      
      switch (match) {
        case 'date':
          mapping.dateColumn = header
          break
        case 'amount':
          mapping.amountColumn = header
          break
        case 'description':
          mapping.descriptionColumn = header
          break
        case 'memo':
          mapping.memoColumn = header
          break
        case 'debit':
          mapping.debitColumn = header
          mapping.amountStyle = 'split'
          break
        case 'credit':
          mapping.creditColumn = header
          mapping.amountStyle = 'split'
          break
        case 'balance':
          mapping.balanceColumn = header
          break
        case 'checkNumber':
          mapping.checkNumberColumn = header
          break
      }
    }
  })
  
  // Second pass: analyze sample data to confirm/find mappings
  if (sampleRows.length > 0) {
    headers.forEach((header, colIndex) => {
      maxPoints += 1
      
      // Check sample values in this column
      const sampleValues = sampleRows.slice(0, 5).map(row => row[colIndex] || '')
      
      // If we don't have a date column yet, look for one
      if (!mapping.dateColumn && sampleValues.some(isLikelyDate)) {
        const dateCount = sampleValues.filter(isLikelyDate).length
        if (dateCount >= 3) {
          mapping.dateColumn = header
          confidencePoints += 1
          
          // Detect date format from first valid date
          const firstDate = sampleValues.find(isLikelyDate)
          if (firstDate) {
            for (const df of DATE_FORMATS) {
              if (df.regex.test(firstDate)) {
                mapping.dateFormat = df.format
                break
              }
            }
          }
        }
      }
      
      // If we don't have amount columns yet, look for them
      if (!mapping.amountColumn && !mapping.debitColumn) {
        const amountCount = sampleValues.filter(isLikelyAmount).length
        if (amountCount >= 3) {
          // Check if this might be a balance column (usually always positive, increasing/decreasing pattern)
          if (!mapping.balanceColumn && header.toLowerCase().includes('balance')) {
            mapping.balanceColumn = header
          } else if (!mapping.amountColumn) {
            mapping.amountColumn = header
            confidencePoints += 1
          }
        }
      }
      
      // Look for description (long text, varied)
      if (!mapping.descriptionColumn) {
        const avgLength = sampleValues.reduce((sum, v) => sum + v.length, 0) / sampleValues.length
        const uniqueValues = new Set(sampleValues).size
        if (avgLength > 10 && uniqueValues > 2) {
          // Probably a description column
          const field = matchColumnToField(header)
          if (!field || field === 'description' || field === 'memo') {
            if (!mapping.descriptionColumn) {
              mapping.descriptionColumn = header
              confidencePoints += 0.5
            }
          }
        }
      }
    })
  }
  
  // Calculate confidence
  mapping.confidence = maxPoints > 0 ? confidencePoints / maxPoints : 0
  
  // If we have debit/credit columns but no amount, that's fine (split style)
  if (mapping.debitColumn && mapping.creditColumn && !mapping.amountColumn) {
    mapping.amountStyle = 'split'
  }
  
  return mapping
}

/**
 * Parse CSV file with optional column mapping
 */
export function parseCSV(
  text: string,
  columnMapping?: ColumnMapping,
  options?: {
    hasHeaderRow?: boolean
    skipRows?: number
    amountIsNegativeForDebits?: boolean
  }
): ParseResult {
  const errors: ParseError[] = []
  const warnings: string[] = []
  
  try {
    const rows = parseCSVText(text)
    
    if (rows.length === 0) {
      return {
        success: false,
        transactions: [],
        fileType: 'csv',
        errors: [{ message: 'File is empty', severity: 'error' }],
        warnings: [],
      }
    }
    
    const hasHeader = options?.hasHeaderRow ?? true
    const skipRows = options?.skipRows ?? 0
    const amountIsNegativeForDebits = options?.amountIsNegativeForDebits ?? true
    
    // Get headers
    const headers = hasHeader ? rows[skipRows] : rows[0].map((_, i) => `Column ${i + 1}`)
    const dataStartRow = hasHeader ? skipRows + 1 : skipRows
    const dataRows = rows.slice(dataStartRow)
    
    // Auto-detect mapping if not provided
    let detectedFormat: DetectedFormat | undefined
    let effectiveMapping = columnMapping
    
    if (!effectiveMapping) {
      detectedFormat = detectColumnMappings(headers, dataRows)
      
      // Convert detected format to column mapping
      effectiveMapping = {
        date: detectedFormat.dateColumn || null,
        amount: detectedFormat.amountColumn || null,
        description: detectedFormat.descriptionColumn || null,
        memo: detectedFormat.memoColumn || null,
        debit: detectedFormat.debitColumn || null,
        credit: detectedFormat.creditColumn || null,
        checkNumber: detectedFormat.checkNumberColumn || null,
        balance: detectedFormat.balanceColumn || null,
        referenceId: null,
      }
      
      if (detectedFormat.confidence < 0.5) {
        warnings.push('Low confidence in column detection. Please verify mappings.')
      }
    }
    
    // Parse transactions
    const transactions: ParsedTransaction[] = []
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const rowNumber = dataStartRow + i + 1 // 1-indexed for user display
      
      // Build raw data object
      const rawData: Record<string, unknown> = {}
      headers.forEach((header, idx) => {
        rawData[header] = row[idx]
      })
      
      // Get column values by header name
      const getValue = (header: string | null): string => {
        if (!header) return ''
        const idx = headers.indexOf(header)
        return idx >= 0 ? (row[idx] || '') : ''
      }
      
      // Parse date
      const dateValue = getValue(effectiveMapping.date)
      const date = parseDate(dateValue)
      
      if (!date && dateValue) {
        errors.push({
          row: rowNumber,
          column: effectiveMapping.date || undefined,
          message: `Could not parse date: "${dateValue}"`,
          severity: 'warning',
        })
      }
      
      // Parse amount
      let amount: number | null = null
      
      if (effectiveMapping.debit || effectiveMapping.credit) {
        // Split debit/credit columns
        const debit = parseAmount(getValue(effectiveMapping.debit))
        const credit = parseAmount(getValue(effectiveMapping.credit))
        
        if (debit !== null && debit !== 0) {
          amount = amountIsNegativeForDebits ? -Math.abs(debit) : Math.abs(debit)
        } else if (credit !== null && credit !== 0) {
          amount = Math.abs(credit)
        }
      } else {
        // Single amount column
        amount = parseAmount(getValue(effectiveMapping.amount))
      }
      
      // Parse description
      const description = getValue(effectiveMapping.description) || 
                         getValue(effectiveMapping.memo) || 
                         'Unknown'
      
      // Skip empty rows
      if (!date && amount === null && description === 'Unknown') {
        continue
      }
      
      // Determine transaction type
      let type: 'debit' | 'credit' | 'check' | 'transfer' = amount && amount < 0 ? 'debit' : 'credit'
      const checkNumber = getValue(effectiveMapping.checkNumber)
      if (checkNumber) {
        type = 'check'
      }
      
      transactions.push({
        date,
        amount,
        description: description.trim(),
        memo: getValue(effectiveMapping.memo)?.trim() || undefined,
        checkNumber: checkNumber || undefined,
        type,
        rawData,
        rowNumber,
      })
    }
    
    return {
      success: true,
      transactions,
      headers,
      fileType: 'csv',
      detectedFormat,
      errors,
      warnings,
    }
    
  } catch (error) {
    return {
      success: false,
      transactions: [],
      fileType: 'csv',
      errors: [{
        message: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      }],
      warnings: [],
    }
  }
}

