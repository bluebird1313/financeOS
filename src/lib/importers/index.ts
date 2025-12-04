// Main Import Service
// Coordinates file parsing, AI categorization, and database operations

import { parseCSV, detectColumnMappings } from './csvParser'
import { parseExcel, previewExcel, getExcelSheetNames } from './excelParser'
import { parseOFX, isOFXFormat } from './ofxParser'
import type { 
  ParseResult, 
  ParsedTransaction, 
  ColumnMapping, 
  ImportProfile,
  DetectedFormat 
} from './types'

export * from './types'
export { parseCSV, detectColumnMappings } from './csvParser'
export { parseExcel, previewExcel, getExcelSheetNames } from './excelParser'
export { parseOFX, isOFXFormat } from './ofxParser'

/**
 * Detect file type from extension or content
 */
export function detectFileType(
  fileName: string, 
  content?: string | ArrayBuffer
): 'csv' | 'xlsx' | 'xls' | 'qbo' | 'qfx' | 'ofx' | 'unknown' {
  const ext = fileName.toLowerCase().split('.').pop()
  
  switch (ext) {
    case 'csv':
      return 'csv'
    case 'xlsx':
      return 'xlsx'
    case 'xls':
      return 'xls'
    case 'qbo':
      return 'qbo'
    case 'qfx':
      return 'qfx'
    case 'ofx':
      return 'ofx'
    default:
      // Try to detect from content
      if (content && typeof content === 'string') {
        if (isOFXFormat(content)) {
          return 'ofx'
        }
        // Check if it looks like CSV
        if (content.includes(',') && content.includes('\n')) {
          return 'csv'
        }
      }
      return 'unknown'
  }
}

/**
 * Parse any supported file type
 */
export async function parseFile(
  file: File,
  columnMapping?: ColumnMapping,
  options?: {
    hasHeaderRow?: boolean
    skipRows?: number
    amountIsNegativeForDebits?: boolean
    sheetIndex?: number
    filename?: string
  }
): Promise<ParseResult> {
  const fileType = detectFileType(file.name)
  
  if (fileType === 'unknown') {
    return {
      success: false,
      transactions: [],
      fileType: 'csv',
      errors: [{ 
        message: `Unsupported file type. Please use CSV, Excel (.xlsx/.xls), or bank export (.qbo/.qfx/.ofx)`,
        severity: 'error'
      }],
      warnings: [],
    }
  }
  
  // Read file content
  if (fileType === 'csv' || fileType === 'qbo' || fileType === 'qfx' || fileType === 'ofx') {
    const text = await file.text()
    
    if (fileType === 'csv') {
      return parseCSV(text, columnMapping, { ...options, filename: options?.filename || file.name })
    } else {
      // OFX-based formats
      return parseOFX(text)
    }
  } else {
    // Excel formats
    const buffer = await file.arrayBuffer()
    return parseExcel(buffer, columnMapping, options)
  }
}

/**
 * Preview file to show user before full import
 */
export async function previewFile(
  file: File,
  maxRows: number = 5
): Promise<{
  fileType: string
  headers?: string[]
  sampleRows?: string[][]
  detectedFormat?: DetectedFormat
  transactionCount?: number
  sheetNames?: string[]
  error?: string
}> {
  const fileType = detectFileType(file.name)
  
  if (fileType === 'unknown') {
    return { fileType: 'unknown', error: 'Unsupported file type' }
  }
  
  try {
    if (fileType === 'csv') {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '')) || []
      const sampleRows = lines.slice(1, maxRows + 1).map(line => 
        line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
      )
      const detectedFormat = detectColumnMappings(headers, sampleRows)
      
      return {
        fileType,
        headers,
        sampleRows,
        detectedFormat,
        transactionCount: lines.length - 1,
      }
    }
    
    if (fileType === 'xlsx' || fileType === 'xls') {
      const buffer = await file.arrayBuffer()
      const preview = previewExcel(buffer, { maxRows })
      
      if (!preview) {
        return { fileType, error: 'Could not read Excel file' }
      }
      
      const detectedFormat = detectColumnMappings(preview.headers, preview.rows)
      
      return {
        fileType,
        headers: preview.headers,
        sampleRows: preview.rows,
        detectedFormat,
        sheetNames: preview.sheetNames,
      }
    }
    
    // OFX/QBO/QFX
    const text = await file.text()
    const result = parseOFX(text)
    
    return {
      fileType,
      transactionCount: result.transactions.length,
      detectedFormat: result.detectedFormat,
    }
    
  } catch (error) {
    return {
      fileType,
      error: error instanceof Error ? error.message : 'Failed to preview file',
    }
  }
}

/**
 * Generate a hash for duplicate detection
 */
export function generateTransactionHash(
  date: string | null,
  amount: number | null,
  description: string
): string {
  const normalized = [
    date || '',
    String(amount || 0),
    description.toLowerCase().trim(),
  ].join('|')
  
  // Simple hash for client-side (server will use proper SHA256)
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * Clean up merchant name using common patterns
 */
export function cleanMerchantName(rawName: string): string {
  let cleaned = rawName
  
  // Remove common suffixes
  cleaned = cleaned.replace(/\s*(#\d+|x{4,}\d+|\*{4,}\d+).*$/i, '')
  
  // Remove location info in format "CITY ST" or "CITY, ST"
  cleaned = cleaned.replace(/\s+[A-Z]{2}\s*\d{5}(-\d{4})?$/i, '')
  cleaned = cleaned.replace(/\s+[A-Z][a-z]+,?\s+[A-Z]{2}$/i, '')
  
  // Remove trailing numbers (transaction IDs, etc.)
  cleaned = cleaned.replace(/\s+\d{6,}$/, '')
  
  // Remove common prefixes
  cleaned = cleaned.replace(/^(SQ\*|TST\*|SP\s|POS\s|CHECKCARD\s|DEBIT\s)/i, '')
  
  // Common merchant name cleanups
  const merchantMappings: Record<string, string> = {
    'AMZN MKTP': 'Amazon',
    'AMAZON.COM': 'Amazon',
    'AMZN': 'Amazon',
    'WM SUPERCENTER': 'Walmart',
    'WAL-MART': 'Walmart',
    'WALGREENS': 'Walgreens',
    'MCDONALD\'S': 'McDonald\'s',
    'STARBUCKS': 'Starbucks',
    'TARGET': 'Target',
    'COSTCO': 'Costco',
    'UBER EATS': 'Uber Eats',
    'UBER': 'Uber',
    'LYFT': 'Lyft',
    'DOORDASH': 'DoorDash',
    'GRUBHUB': 'Grubhub',
    'NETFLIX': 'Netflix',
    'SPOTIFY': 'Spotify',
    'APPLE.COM': 'Apple',
    'GOOGLE': 'Google',
  }
  
  const upperCleaned = cleaned.toUpperCase()
  for (const [pattern, replacement] of Object.entries(merchantMappings)) {
    if (upperCleaned.includes(pattern)) {
      return replacement
    }
  }
  
  // Title case if all uppercase
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }
  
  return cleaned.trim()
}

/**
 * Suggest category based on merchant name and transaction patterns
 */
export function suggestCategory(
  description: string,
  amount: number,
  categories: Array<{ id: string; name: string }>
): { categoryId: string; confidence: number } | null {
  const lowerDesc = description.toLowerCase()
  
  // Category keywords mapping
  const categoryKeywords: Record<string, string[]> = {
    'Food & Dining': [
      'restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'mcdonald', 'starbucks',
      'subway', 'chipotle', 'panera', 'chick-fil-a', 'wendy', 'taco', 'doordash',
      'uber eats', 'grubhub', 'seamless', 'postmates', 'diner', 'grill', 'kitchen',
      'bakery', 'deli', 'sushi', 'thai', 'chinese', 'mexican', 'italian'
    ],
    'Transportation': [
      'uber', 'lyft', 'taxi', 'gas', 'shell', 'chevron', 'exxon', 'mobil', 'bp',
      'citgo', 'parking', 'toll', 'transit', 'metro', 'subway fare', 'amtrak'
    ],
    'Shopping': [
      'amazon', 'target', 'walmart', 'costco', 'best buy', 'home depot', 'lowes',
      'ikea', 'bed bath', 'kohls', 'macys', 'nordstrom', 'tj maxx', 'marshall',
      'ross', 'forever 21', 'old navy', 'gap', 'h&m', 'zara'
    ],
    'Entertainment': [
      'netflix', 'hulu', 'disney+', 'hbo', 'spotify', 'apple music', 'youtube',
      'movie', 'cinema', 'theater', 'concert', 'ticket', 'game', 'steam', 'playstation',
      'xbox', 'nintendo'
    ],
    'Bills & Utilities': [
      'electric', 'gas bill', 'water', 'internet', 'cable', 'phone', 'verizon',
      'at&t', 't-mobile', 'comcast', 'spectrum', 'utility', 'pg&e', 'edison'
    ],
    'Health & Medical': [
      'pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'medical', 'dental',
      'vision', 'optometry', 'clinic', 'urgent care', 'prescription', 'health'
    ],
    'Travel': [
      'airline', 'flight', 'hotel', 'airbnb', 'vrbo', 'expedia', 'booking.com',
      'delta', 'united', 'american airlines', 'southwest', 'marriott', 'hilton',
      'hyatt', 'hertz', 'enterprise', 'avis', 'rental car'
    ],
    'Income': [
      'payroll', 'direct dep', 'salary', 'wages', 'dividend', 'interest income',
      'deposit', 'refund', 'reimbursement', 'venmo from', 'zelle from'
    ],
    'Transfer': [
      'transfer', 'zelle', 'venmo', 'paypal', 'wire', 'ach', 'withdrawal', 'atm'
    ],
  }
  
  // Find matching category
  for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword)) {
        const category = categories.find(c => 
          c.name.toLowerCase() === categoryName.toLowerCase()
        )
        if (category) {
          return {
            categoryId: category.id,
            confidence: 0.8,
          }
        }
      }
    }
  }
  
  return null
}
