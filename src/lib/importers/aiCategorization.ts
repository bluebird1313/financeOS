// AI-Powered Transaction Categorization Service
// Uses OpenAI/Claude to categorize transactions and clean merchant names

import type { ParsedTransaction, CategorySuggestion, MerchantCleanup, AICategorizationResult } from './types'
import type { Category } from '@/types/database'

// Check number detection patterns
const CHECK_PATTERNS = [
  /check\s*#?\s*(\d+)/i,                    // "Check #1234", "Check 1234", "CHECK #1234"
  /chk\s*#?\s*(\d+)/i,                      // "CHK #1234", "CHK1234"
  /ck\s*#?\s*(\d+)/i,                       // "CK #1234", "CK1234"
  /check\s*no\.?\s*(\d+)/i,                 // "Check No. 1234", "Check No 1234"
  /^(\d{3,6})\s+check$/i,                   // "1234 CHECK"
  /debit\s*-?\s*check\s*#?\s*(\d+)/i,       // "DEBIT CHECK #1234"
  /check\s*card\s*purchase.*?(\d{4})/i,     // Sometimes last 4 of check number
  /check\s*withdrawal\s*#?\s*(\d+)/i,       // "CHECK WITHDRAWAL #1234"
  /paid\s*check\s*#?\s*(\d+)/i,             // "PAID CHECK #1234"
  /^\s*(\d{4,6})\s*$/,                      // Just a 4-6 digit number (common in check_number columns)
]

// Bill/Subscription detection patterns (for auto-categorization)
const BILL_SUBSCRIPTION_PATTERNS = [
  // Subscription services
  { pattern: /netflix/i, type: 'subscription', merchant: 'Netflix' },
  { pattern: /spotify/i, type: 'subscription', merchant: 'Spotify' },
  { pattern: /hulu/i, type: 'subscription', merchant: 'Hulu' },
  { pattern: /disney\s*\+/i, type: 'subscription', merchant: 'Disney+' },
  { pattern: /hbo\s*max/i, type: 'subscription', merchant: 'HBO Max' },
  { pattern: /apple\s*(music|tv|one|arcade|icloud)/i, type: 'subscription', merchant: 'Apple' },
  { pattern: /amazon\s*prime/i, type: 'subscription', merchant: 'Amazon Prime' },
  { pattern: /youtube\s*(premium|music)/i, type: 'subscription', merchant: 'YouTube' },
  { pattern: /audible/i, type: 'subscription', merchant: 'Audible' },
  { pattern: /adobe/i, type: 'subscription', merchant: 'Adobe' },
  { pattern: /microsoft\s*365/i, type: 'subscription', merchant: 'Microsoft 365' },
  { pattern: /office\s*365/i, type: 'subscription', merchant: 'Microsoft 365' },
  { pattern: /dropbox/i, type: 'subscription', merchant: 'Dropbox' },
  { pattern: /google\s*(one|storage|workspace)/i, type: 'subscription', merchant: 'Google' },
  { pattern: /notion/i, type: 'subscription', merchant: 'Notion' },
  { pattern: /slack/i, type: 'subscription', merchant: 'Slack' },
  { pattern: /zoom/i, type: 'subscription', merchant: 'Zoom' },
  
  // Common bills
  { pattern: /electric|power\s*company|edison|duke\s*energy/i, type: 'bill', merchant: 'Electric' },
  { pattern: /gas\s*company|natural\s*gas/i, type: 'bill', merchant: 'Gas' },
  { pattern: /water\s*(bill|utility|department)/i, type: 'bill', merchant: 'Water' },
  { pattern: /internet|xfinity|comcast|spectrum|at&t|verizon\s*fios/i, type: 'bill', merchant: 'Internet' },
  { pattern: /phone\s*bill|t-mobile|verizon\s*wireless/i, type: 'bill', merchant: 'Phone' },
  { pattern: /insurance|geico|state\s*farm|progressive|allstate/i, type: 'bill', merchant: 'Insurance' },
  { pattern: /rent|apartment|landlord|property\s*management/i, type: 'bill', merchant: 'Rent' },
  { pattern: /mortgage|home\s*loan|wells\s*fargo\s*home/i, type: 'bill', merchant: 'Mortgage' },
  { pattern: /car\s*payment|auto\s*loan/i, type: 'bill', merchant: 'Car Payment' },
  { pattern: /student\s*loan|nelnet|navient|fedloan|sofi/i, type: 'bill', merchant: 'Student Loan' },
]

/**
 * Detect if a transaction description contains a check number
 * Returns the check number if found, null otherwise
 */
export function detectCheckNumber(description: string, checkNumberColumn?: string): string | null {
  // If there's a dedicated check number column value, use it
  if (checkNumberColumn && checkNumberColumn.trim()) {
    const numericOnly = checkNumberColumn.replace(/\D/g, '')
    if (numericOnly.length >= 3 && numericOnly.length <= 8) {
      return numericOnly
    }
  }

  // Check the description for check patterns
  for (const pattern of CHECK_PATTERNS) {
    const match = description.match(pattern)
    if (match && match[1]) {
      const num = match[1].replace(/\D/g, '')
      // Validate it looks like a check number (3-8 digits)
      if (num.length >= 3 && num.length <= 8) {
        return num
      }
    }
  }

  return null
}

/**
 * Detect if a transaction is likely a check, bill, or subscription
 * Returns the type and relevant details
 */
export function detectPaymentType(description: string): {
  type: 'check' | 'bill' | 'subscription' | 'regular'
  checkNumber?: string
  merchant?: string
} {
  // First, check for check patterns
  const checkNumber = detectCheckNumber(description)
  if (checkNumber) {
    return { type: 'check', checkNumber }
  }

  // Check for bill/subscription patterns
  for (const { pattern, type, merchant } of BILL_SUBSCRIPTION_PATTERNS) {
    if (pattern.test(description)) {
      return { type, merchant }
    }
  }

  return { type: 'regular' }
}

// Common merchant patterns for local (non-AI) categorization
const MERCHANT_PATTERNS: Record<string, { category: string; merchant: string }> = {
  // Food & Dining
  'mcdonald': { category: 'Food & Dining', merchant: 'McDonald\'s' },
  'starbucks': { category: 'Food & Dining', merchant: 'Starbucks' },
  'chipotle': { category: 'Food & Dining', merchant: 'Chipotle' },
  'subway': { category: 'Food & Dining', merchant: 'Subway' },
  'dunkin': { category: 'Food & Dining', merchant: 'Dunkin\'' },
  'wendy': { category: 'Food & Dining', merchant: 'Wendy\'s' },
  'burger king': { category: 'Food & Dining', merchant: 'Burger King' },
  'taco bell': { category: 'Food & Dining', merchant: 'Taco Bell' },
  'pizza hut': { category: 'Food & Dining', merchant: 'Pizza Hut' },
  'domino': { category: 'Food & Dining', merchant: 'Domino\'s' },
  'chick-fil-a': { category: 'Food & Dining', merchant: 'Chick-fil-A' },
  'panera': { category: 'Food & Dining', merchant: 'Panera Bread' },
  'uber eat': { category: 'Food & Dining', merchant: 'Uber Eats' },
  'doordash': { category: 'Food & Dining', merchant: 'DoorDash' },
  'grubhub': { category: 'Food & Dining', merchant: 'Grubhub' },
  
  // Shopping
  'amazon': { category: 'Shopping', merchant: 'Amazon' },
  'amzn': { category: 'Shopping', merchant: 'Amazon' },
  'walmart': { category: 'Shopping', merchant: 'Walmart' },
  'target': { category: 'Shopping', merchant: 'Target' },
  'costco': { category: 'Shopping', merchant: 'Costco' },
  'best buy': { category: 'Shopping', merchant: 'Best Buy' },
  'home depot': { category: 'Shopping', merchant: 'Home Depot' },
  'lowe\'s': { category: 'Shopping', merchant: 'Lowe\'s' },
  'ikea': { category: 'Shopping', merchant: 'IKEA' },
  'apple.com': { category: 'Shopping', merchant: 'Apple' },
  'ebay': { category: 'Shopping', merchant: 'eBay' },
  
  // Groceries
  'kroger': { category: 'Food & Dining', merchant: 'Kroger' },
  'safeway': { category: 'Food & Dining', merchant: 'Safeway' },
  'whole foods': { category: 'Food & Dining', merchant: 'Whole Foods' },
  'trader joe': { category: 'Food & Dining', merchant: 'Trader Joe\'s' },
  'aldi': { category: 'Food & Dining', merchant: 'ALDI' },
  'publix': { category: 'Food & Dining', merchant: 'Publix' },
  'wegman': { category: 'Food & Dining', merchant: 'Wegmans' },
  
  // Transportation
  'uber': { category: 'Transportation', merchant: 'Uber' },
  'lyft': { category: 'Transportation', merchant: 'Lyft' },
  'shell': { category: 'Transportation', merchant: 'Shell' },
  'chevron': { category: 'Transportation', merchant: 'Chevron' },
  'exxon': { category: 'Transportation', merchant: 'Exxon' },
  'bp ': { category: 'Transportation', merchant: 'BP' },
  'speedway': { category: 'Transportation', merchant: 'Speedway' },
  'wawa': { category: 'Transportation', merchant: 'Wawa' },
  
  // Entertainment/Subscriptions
  'netflix': { category: 'Entertainment', merchant: 'Netflix' },
  'spotify': { category: 'Entertainment', merchant: 'Spotify' },
  'hulu': { category: 'Entertainment', merchant: 'Hulu' },
  'disney+': { category: 'Entertainment', merchant: 'Disney+' },
  'disney plus': { category: 'Entertainment', merchant: 'Disney+' },
  'hbo max': { category: 'Entertainment', merchant: 'HBO Max' },
  'prime video': { category: 'Entertainment', merchant: 'Amazon Prime Video' },
  'youtube': { category: 'Entertainment', merchant: 'YouTube' },
  'apple music': { category: 'Entertainment', merchant: 'Apple Music' },
  'playstation': { category: 'Entertainment', merchant: 'PlayStation' },
  'xbox': { category: 'Entertainment', merchant: 'Xbox' },
  'steam': { category: 'Entertainment', merchant: 'Steam' },
  
  // Bills & Utilities
  'at&t': { category: 'Bills & Utilities', merchant: 'AT&T' },
  'verizon': { category: 'Bills & Utilities', merchant: 'Verizon' },
  't-mobile': { category: 'Bills & Utilities', merchant: 'T-Mobile' },
  'comcast': { category: 'Bills & Utilities', merchant: 'Comcast' },
  'xfinity': { category: 'Bills & Utilities', merchant: 'Xfinity' },
  'spectrum': { category: 'Bills & Utilities', merchant: 'Spectrum' },
  'electric': { category: 'Bills & Utilities', merchant: 'Electric Company' },
  'water': { category: 'Bills & Utilities', merchant: 'Water Utility' },
  'gas company': { category: 'Bills & Utilities', merchant: 'Gas Company' },
  
  // Health
  'cvs': { category: 'Health & Medical', merchant: 'CVS Pharmacy' },
  'walgreen': { category: 'Health & Medical', merchant: 'Walgreens' },
  'rite aid': { category: 'Health & Medical', merchant: 'Rite Aid' },
  
  // Income patterns
  'payroll': { category: 'Income', merchant: 'Payroll' },
  'direct dep': { category: 'Income', merchant: 'Direct Deposit' },
  'salary': { category: 'Income', merchant: 'Salary' },
  'ach deposit': { category: 'Income', merchant: 'ACH Deposit' },
  
  // Transfers
  'transfer': { category: 'Transfer', merchant: 'Transfer' },
  'zelle': { category: 'Transfer', merchant: 'Zelle' },
  'venmo': { category: 'Transfer', merchant: 'Venmo' },
  'paypal': { category: 'Transfer', merchant: 'PayPal' },
  'cash app': { category: 'Transfer', merchant: 'Cash App' },
}

/**
 * Local/rule-based categorization (fast, no API call)
 */
export function localCategorize(
  description: string,
  categories: Category[]
): { category: CategorySuggestion | null; merchant: MerchantCleanup | null } {
  const normalizedDesc = description.toLowerCase()
  
  for (const [pattern, result] of Object.entries(MERCHANT_PATTERNS)) {
    if (normalizedDesc.includes(pattern)) {
      const category = categories.find(c => c.name === result.category)
      
      return {
        category: category ? {
          categoryId: category.id,
          categoryName: category.name,
          confidence: 0.85,
          reason: `Matched pattern "${pattern}"`,
        } : null,
        merchant: {
          original: description,
          cleaned: result.merchant,
          confidence: 0.9,
        },
      }
    }
  }
  
  return { category: null, merchant: null }
}

/**
 * Batch categorize transactions using local rules
 */
export function batchLocalCategorize(
  transactions: ParsedTransaction[],
  categories: Category[]
): AICategorizationResult {
  return {
    transactions: transactions.map(txn => {
      const result = localCategorize(txn.description, categories)
      return {
        rowNumber: txn.rowNumber,
        category: result.category,
        merchant: result.merchant,
      }
    }),
  }
}

/**
 * AI-powered categorization using Claude/OpenAI
 * This function prepares the prompt and handles the response
 */
export async function aiCategorize(
  transactions: ParsedTransaction[],
  categories: Category[],
  apiKey: string,
  model: 'claude' | 'openai' = 'claude'
): Promise<AICategorizationResult> {
  // First, try local categorization
  const localResults = batchLocalCategorize(transactions, categories)
  
  // Find transactions that weren't categorized locally
  const uncategorized = transactions.filter((txn, idx) => 
    !localResults.transactions[idx].category
  )
  
  // If all were categorized locally, return
  if (uncategorized.length === 0) {
    return localResults
  }
  
  // Prepare prompt for AI
  const categoryList = categories.map(c => `- ${c.name}`).join('\n')
  const transactionList = uncategorized.map(t => 
    `Row ${t.rowNumber}: "${t.description}" (${t.amount ? `$${t.amount}` : 'no amount'})`
  ).join('\n')
  
  const prompt = `You are a financial transaction categorizer. Categorize the following transactions into the most appropriate category.

Available categories:
${categoryList}

Transactions to categorize:
${transactionList}

For each transaction, respond with a JSON array of objects with this structure:
{
  "rowNumber": <row number>,
  "category": "<category name from list above>",
  "confidence": <0.0 to 1.0>,
  "merchantName": "<cleaned up merchant name>"
}

Only respond with the JSON array, no other text.`

  try {
    let response: string
    
    if (model === 'openai') {
      response = await callOpenAI(prompt, apiKey)
    } else {
      response = await callClaude(prompt, apiKey)
    }
    
    // Parse AI response
    const aiResults = JSON.parse(response) as Array<{
      rowNumber: number
      category: string
      confidence: number
      merchantName: string
    }>
    
    // Merge AI results with local results
    const mergedResults = localResults.transactions.map(local => {
      if (local.category) return local
      
      const aiResult = aiResults.find(r => r.rowNumber === local.rowNumber)
      if (aiResult) {
        const category = categories.find(c => c.name === aiResult.category)
        return {
          rowNumber: local.rowNumber,
          category: category ? {
            categoryId: category.id,
            categoryName: category.name,
            confidence: aiResult.confidence,
            reason: 'AI categorized',
          } : null,
          merchant: aiResult.merchantName ? {
            original: transactions.find(t => t.rowNumber === local.rowNumber)?.description || '',
            cleaned: aiResult.merchantName,
            confidence: aiResult.confidence,
          } : null,
        }
      }
      return local
    })
    
    return { transactions: mergedResults }
    
  } catch (error) {
    console.error('AI categorization failed:', error)
    // Fall back to local results
    return localResults
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a financial transaction categorizer. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  })
  
  const data = await response.json()
  return data.choices[0].message.content
}

/**
 * Call Claude API
 */
async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt },
      ],
    }),
  })
  
  const data = await response.json()
  return data.content[0].text
}

/**
 * Suggest column mappings using AI
 */
export async function aiSuggestColumnMappings(
  headers: string[],
  sampleData: string[][],
  apiKey: string
): Promise<{
  date: string | null
  amount: string | null
  description: string | null
  memo: string | null
  debit: string | null
  credit: string | null
  checkNumber: string | null
  confidence: number
}> {
  const sampleRows = sampleData.slice(0, 3).map((row, i) => 
    `Row ${i + 1}: ${headers.map((h, j) => `${h}="${row[j] || ''}"`).join(', ')}`
  ).join('\n')
  
  const prompt = `Analyze these CSV headers and sample data to determine column mappings for financial transactions.

Headers: ${headers.join(', ')}

Sample data:
${sampleRows}

Determine which column contains:
- date: Transaction date
- amount: Transaction amount (single column with +/- values)
- description: Transaction description/payee
- memo: Additional notes/memo
- debit: Debit/withdrawal amount (if separate from credit)
- credit: Credit/deposit amount (if separate from debit)
- checkNumber: Check number if present

Respond with JSON only:
{
  "date": "<header name or null>",
  "amount": "<header name or null>",
  "description": "<header name or null>",
  "memo": "<header name or null>",
  "debit": "<header name or null>",
  "credit": "<header name or null>",
  "checkNumber": "<header name or null>",
  "confidence": <0.0 to 1.0>
}`

  try {
    const response = await callOpenAI(prompt, apiKey)
    return JSON.parse(response)
  } catch (error) {
    console.error('AI column mapping failed:', error)
    return {
      date: null,
      amount: null,
      description: null,
      memo: null,
      debit: null,
      credit: null,
      checkNumber: null,
      confidence: 0,
    }
  }
}

/**
 * Learn from user corrections to improve future categorization
 */
export function buildCategoryRules(
  corrections: Array<{
    description: string
    categoryId: string
    categoryName: string
  }>
): Record<string, string> {
  const rules: Record<string, string> = {}
  
  for (const correction of corrections) {
    // Extract key words from description
    const words = correction.description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
    
    // Use the most distinctive word as a key
    for (const word of words) {
      if (!['the', 'and', 'for', 'from', 'with'].includes(word)) {
        rules[word] = correction.categoryId
        break
      }
    }
  }
  
  return rules
}

