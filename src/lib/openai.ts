import { supabase, isDemoMode } from './supabase'

// Helper to call the secure OpenAI Edge Function
async function callOpenAI(messages: Array<{ role: string; content: string }>, type: 'chat' | 'categorize' | 'insights' = 'chat'): Promise<string> {
  // Check if running in demo mode
  if (isDemoMode) {
    throw new Error('AI features require Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL environment variable')
  }

  console.log('🤖 Calling OpenAI via Edge Function...')
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated. Please sign in to use AI features.')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/openai-chat`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, type }),
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    console.log('🤖 OpenAI response status:', response.status)

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
        console.error('🤖 OpenAI error response:', errorData)
      } catch {
        // Response wasn't JSON
        const text = await response.text()
        console.error('🤖 OpenAI error text:', text)
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    console.log('🤖 OpenAI response received successfully')
    
    if (!data.content) {
      console.error('🤖 OpenAI response missing content:', data)
      throw new Error('AI returned an empty response')
    }
    
    return data.content
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 60 seconds. Please try again.')
    }
    throw error
  }
}

export interface CategorizedTransaction {
  category: string
  subcategory?: string
  confidence: number
  isBusinessExpense: boolean
  taxCategory?: string
}

export async function categorizeTransaction(
  description: string,
  amount: number,
  merchantName?: string
): Promise<CategorizedTransaction> {
  const prompt = `Analyze this financial transaction and categorize it:
Description: ${description}
Amount: $${Math.abs(amount).toFixed(2)} (${amount < 0 ? 'expense' : 'income'})
${merchantName ? `Merchant: ${merchantName}` : ''}

Respond in JSON format with:
- category: main category (e.g., "Food & Dining", "Transportation", "Utilities", "Income", "Shopping", "Health", "Entertainment", "Travel", "Business", "Transfer")
- subcategory: more specific category if applicable
- confidence: 0-1 confidence score
- isBusinessExpense: boolean if this looks like a business expense
- taxCategory: if business expense, suggest Schedule C category

JSON only, no explanation:`

  try {
    const content = await callOpenAI(
      [{ role: 'user', content: prompt }],
      'categorize'
    )
    return JSON.parse(content.replace(/```json\n?|\n?```/g, ''))
  } catch (error) {
    console.error('Error categorizing transaction:', error)
    return {
      category: 'Uncategorized',
      confidence: 0,
      isBusinessExpense: false,
    }
  }
}

export async function generateFinancialInsights(
  transactions: Array<{ description: string; amount: number; date: string; category: string }>,
  accountBalances: Array<{ name: string; balance: number; type: string }>
): Promise<string> {
  const transactionSummary = transactions.slice(0, 50).map(t => 
    `${t.date}: ${t.description} - $${t.amount.toFixed(2)} (${t.category})`
  ).join('\n')

  const balanceSummary = accountBalances.map(a => 
    `${a.name} (${a.type}): $${a.balance.toFixed(2)}`
  ).join('\n')

  const prompt = `As a financial advisor, analyze these recent transactions and account balances to provide helpful insights:

Recent Transactions:
${transactionSummary}

Account Balances:
${balanceSummary}

Provide 3-5 actionable insights about:
- Spending patterns or anomalies
- Potential savings opportunities
- Cash flow observations
- Any concerns or recommendations

Keep it conversational and helpful, not preachy. Be specific with numbers.`

  try {
    return await callOpenAI(
      [{ role: 'user', content: prompt }],
      'insights'
    )
  } catch (error) {
    console.error('Error generating insights:', error)
    return 'Unable to generate insights at this time.'
  }
}

export async function chatWithAssistant(
  message: string,
  context: {
    transactions?: Array<{ description: string; amount: number; date: string; category: string }>
    balances?: Array<{ name: string; balance: number }>
    bills?: Array<{ name: string; amount: number; dueDate: string }>
  },
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  console.log('🤖 chatWithAssistant called with:', {
    messageLength: message.length,
    transactionCount: context.transactions?.length || 0,
    balanceCount: context.balances?.length || 0,
    billCount: context.bills?.length || 0,
    historyLength: conversationHistory.length,
  })

  const systemPrompt = `You are a helpful financial assistant for a personal finance app. You have access to the user's financial data and can answer questions about their spending, income, bills, and accounts.

Current Financial Context:
${context.balances?.length ? `Account Balances: ${JSON.stringify(context.balances)}` : 'No account data available.'}
${context.transactions?.length ? `Recent Transactions (last 30): ${JSON.stringify(context.transactions.slice(0, 30))}` : 'No transaction data available.'}
${context.bills?.length ? `Upcoming Bills: ${JSON.stringify(context.bills)}` : 'No bill data available.'}

Be helpful, specific, and use actual numbers from their data when answering questions. If you don't have enough data to answer, say so.`

  try {
    const result = await callOpenAI([
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ])
    console.log('🤖 chatWithAssistant completed successfully')
    return result
  } catch (error: any) {
    console.error('🤖 Chat Error:', error)
    // Re-throw for better error handling in the UI
    throw error
  }
}

// Batch categorize multiple transactions (for import)
export interface BatchCategorizeResult {
  transactions: Array<{
    index: number
    category: string
    cleanedMerchant: string
    confidence: number
    isBusinessExpense: boolean
  }>
}

export async function batchCategorizeTransactions(
  transactions: Array<{
    index: number
    description: string
    amount: number
    date?: string
  }>,
  categories: Array<{ id: string; name: string }>
): Promise<BatchCategorizeResult> {
  const categoryList = categories.map(c => c.name).join(', ')
  
  const transactionList = transactions.slice(0, 50).map(t => 
    `${t.index}. "${t.description}" $${Math.abs(t.amount).toFixed(2)}`
  ).join('\n')

  const prompt = `Categorize these transactions and clean up merchant names. Available categories: ${categoryList}

Transactions:
${transactionList}

For each transaction, provide:
- index: the transaction number
- category: best matching category from the list
- cleanedMerchant: clean, readable merchant name (e.g., "AMZN MKTP US*2K4" → "Amazon")
- confidence: 0-1 score
- isBusinessExpense: boolean

Return JSON array only:
[{"index": 1, "category": "Shopping", "cleanedMerchant": "Amazon", "confidence": 0.95, "isBusinessExpense": false}, ...]`

  try {
    const content = await callOpenAI(
      [{ role: 'user', content: prompt }],
      'categorize'
    )
    
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''))
    return { transactions: Array.isArray(parsed) ? parsed : [] }
  } catch (error) {
    console.error('Error batch categorizing:', error)
    return { transactions: [] }
  }
}

// AI-assisted column mapping for CSV imports
export interface ColumnMappingSuggestion {
  mappings: Record<string, string>
  confidence: number
  dateFormat?: string
  notes?: string
}

export async function suggestColumnMappings(
  headers: string[],
  sampleRows: string[][]
): Promise<ColumnMappingSuggestion> {
  const sampleData = sampleRows.slice(0, 3).map((row, i) => 
    `Row ${i + 1}: ${row.join(' | ')}`
  ).join('\n')

  const prompt = `Analyze this CSV data and suggest column mappings for a bank transaction import.

Headers: ${headers.join(' | ')}

Sample Data:
${sampleData}

Map each header to one of these fields (or "skip"):
- date: Transaction date
- amount: Single amount column (negative for debits)
- debit: Withdrawal/debit amount
- credit: Deposit/credit amount  
- description: Transaction description/name
- memo: Additional notes
- checkNumber: Check number
- balance: Running balance (usually skip)
- referenceId: Transaction ID
- skip: Ignore this column

Respond with JSON:
{
  "mappings": {"Header Name": "field_name", ...},
  "confidence": 0-1,
  "dateFormat": "MM/DD/YYYY" or "YYYY-MM-DD" etc,
  "notes": "any observations about the format"
}`

  try {
    const content = await callOpenAI(
      [{ role: 'user', content: prompt }],
      'categorize'
    )
    
    return JSON.parse(content.replace(/```json\n?|\n?```/g, ''))
  } catch (error) {
    console.error('Error suggesting mappings:', error)
    return {
      mappings: {},
      confidence: 0,
      notes: 'Could not auto-detect mappings'
    }
  }
}

// AI-powered subscription detection
export interface DetectedSubscription {
  merchant_name: string
  amount: number
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  last_date: string
  transaction_count: number
  confidence: number
  category?: string
  is_essential: boolean
  notes?: string
}

export interface SubscriptionDetectionResult {
  subscriptions: DetectedSubscription[]
  total_monthly_cost: number
  summary: string
}

export async function detectSubscriptions(
  transactions: Array<{
    id: string
    merchant_name: string | null
    name: string
    amount: number
    date: string
  }>
): Promise<SubscriptionDetectionResult> {
  // First, let's do pattern detection locally to find potential recurring transactions
  const merchantGroups: Record<string, Array<{ amount: number; date: string; name: string }>> = {}
  
  // Group transactions by merchant/name
  for (const t of transactions) {
    // Only look at expenses (negative amounts or let AI figure it out)
    const key = (t.merchant_name || t.name || '').toLowerCase().trim()
    if (!key || key.length < 2) continue
    
    if (!merchantGroups[key]) {
      merchantGroups[key] = []
    }
    merchantGroups[key].push({ 
      amount: Math.abs(t.amount), 
      date: t.date,
      name: t.merchant_name || t.name
    })
  }
  
  // Find merchants with multiple transactions (potential subscriptions)
  const potentialSubscriptions: Array<{
    merchant: string
    transactions: Array<{ amount: number; date: string; name: string }>
    avg_amount: number
    occurrence_count: number
  }> = []
  
  for (const [merchant, txns] of Object.entries(merchantGroups)) {
    if (txns.length >= 2) {
      const amounts = txns.map(t => t.amount)
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
      // Check if amounts are relatively consistent (within 20% variance)
      const isConsistent = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.2)
      
      if (isConsistent || txns.length >= 3) {
        potentialSubscriptions.push({
          merchant,
          transactions: txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          avg_amount: avgAmount,
          occurrence_count: txns.length
        })
      }
    }
  }
  
  if (potentialSubscriptions.length === 0) {
    return {
      subscriptions: [],
      total_monthly_cost: 0,
      summary: 'No recurring subscriptions detected in your transactions.'
    }
  }
  
  // Use AI to analyze and classify the potential subscriptions
  const subscriptionSummary = potentialSubscriptions.slice(0, 30).map(s => {
    const dates = s.transactions.map(t => t.date).slice(0, 5).join(', ')
    return `- ${s.transactions[0].name}: $${s.avg_amount.toFixed(2)} avg, ${s.occurrence_count} occurrences, dates: ${dates}`
  }).join('\n')
  
  const prompt = `Analyze these recurring transactions and identify which ones are subscriptions or recurring bills:

${subscriptionSummary}

For each item that appears to be a subscription or recurring service, determine:
1. The clean merchant name
2. Whether it's a subscription (like Netflix, Spotify) or a recurring bill (like utilities, insurance)
3. The likely billing frequency (weekly, biweekly, monthly, quarterly, yearly) based on date patterns
4. A confidence score (0-1) that this is truly a recurring charge
5. Whether it seems essential (utilities, insurance, phone) vs optional (streaming, gaming)
6. Suggested category (Entertainment, Utilities, Insurance, Software, Health, Membership, Other)

Return JSON array only:
[{
  "merchant_name": "Clean Name",
  "original_name": "original from list",
  "amount": 9.99,
  "frequency": "monthly",
  "confidence": 0.95,
  "is_essential": false,
  "category": "Entertainment",
  "notes": "Streaming service"
}, ...]

Only include items with confidence > 0.5. Skip one-time purchases, refunds, or irregular transactions.`

  try {
    const content = await callOpenAI(
      [{ role: 'user', content: prompt }],
      'categorize'
    )
    
    const aiResults = JSON.parse(content.replace(/```json\n?|\n?```/g, '')) as Array<{
      merchant_name: string
      original_name: string
      amount: number
      frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
      confidence: number
      is_essential: boolean
      category: string
      notes?: string
    }>
    
    // Match AI results back to our data and enrich with dates
    const subscriptions: DetectedSubscription[] = aiResults.map(ai => {
      const match = potentialSubscriptions.find(
        p => p.transactions[0].name.toLowerCase().includes(ai.original_name?.toLowerCase() || ai.merchant_name.toLowerCase()) ||
             ai.merchant_name.toLowerCase().includes(p.merchant.substring(0, 8))
      )
      
      return {
        merchant_name: ai.merchant_name,
        amount: ai.amount || match?.avg_amount || 0,
        frequency: ai.frequency,
        last_date: match?.transactions[0]?.date || new Date().toISOString().split('T')[0],
        transaction_count: match?.occurrence_count || 2,
        confidence: ai.confidence,
        category: ai.category,
        is_essential: ai.is_essential,
        notes: ai.notes
      }
    }).filter(s => s.confidence > 0.5)
    
    // Calculate total monthly cost
    const monthlyMultipliers: Record<string, number> = {
      weekly: 4.33,
      biweekly: 2.17,
      monthly: 1,
      quarterly: 0.33,
      yearly: 0.083
    }
    
    const totalMonthlyCost = subscriptions.reduce((sum, s) => {
      return sum + (s.amount * (monthlyMultipliers[s.frequency] || 1))
    }, 0)
    
    return {
      subscriptions,
      total_monthly_cost: totalMonthlyCost,
      summary: `Found ${subscriptions.length} potential subscriptions totaling ~$${totalMonthlyCost.toFixed(2)}/month`
    }
  } catch (error) {
    console.error('Error detecting subscriptions with AI:', error)
    
    // Fallback: return pattern-detected subscriptions without AI classification
    const fallbackSubs: DetectedSubscription[] = potentialSubscriptions
      .filter(p => p.occurrence_count >= 3)
      .slice(0, 10)
      .map(p => ({
        merchant_name: p.transactions[0].name,
        amount: p.avg_amount,
        frequency: 'monthly' as const,
        last_date: p.transactions[0].date,
        transaction_count: p.occurrence_count,
        confidence: 0.6,
        is_essential: false,
        notes: 'Detected by pattern matching'
      }))
    
    return {
      subscriptions: fallbackSubs,
      total_monthly_cost: fallbackSubs.reduce((sum, s) => sum + s.amount, 0),
      summary: `Found ${fallbackSubs.length} recurring transactions (AI classification unavailable)`
    }
  }
}

export async function suggestCheckPayee(
  checkNumber: string,
  amount: number,
  previousChecks: Array<{ payee: string; amount: number; checkNumber: string }>
): Promise<{ payee: string; confidence: number } | null> {
  const recentChecks = previousChecks.slice(0, 20).map(c => 
    `Check #${c.checkNumber}: $${c.amount.toFixed(2)} to ${c.payee}`
  ).join('\n')

  const prompt = `Based on these previous checks, suggest who this new check might be for:

Previous Checks:
${recentChecks}

New Check:
Check #${checkNumber}, Amount: $${amount.toFixed(2)}

If you can make a reasonable guess based on patterns (similar amounts, check number sequence), respond with JSON:
{ "payee": "suggested name", "confidence": 0-1 }

If you can't make a reasonable guess, respond with: null`

  try {
    const content = await callOpenAI(
      [{ role: 'user', content: prompt }],
      'categorize'
    )
    return JSON.parse(content)
  } catch {
    return null
  }
}

// Document processing functions
export interface ProcessDocumentResult {
  success: boolean
  transactions: Array<{
    date: string
    amount: number
    description: string
    merchant_name?: string
    check_number?: string
    payee?: string
    memo?: string
    suggested_category?: string
    is_business_expense?: boolean
    confidence: number
    item_type: 'transaction' | 'check' | 'bill' | 'transfer'
    notes?: string
  }>
  summary: string
  source_type: string
  detected_institution?: string
  items_created?: number
  error?: string
}

export async function processDocumentImport(
  content: string,
  fileType: string,
  fileName: string,
  documentImportId?: string
): Promise<ProcessDocumentResult> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document-import`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        file_type: fileType,
        file_name: fileName,
        document_import_id: documentImportId,
      }),
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || `API error: ${response.status}`)
  }

  return response.json()
}

// Parse file content based on type
export async function readFileContent(file: File): Promise<{ content: string; type: string }> {
  const fileName = file.name.toLowerCase()
  let type = 'unknown'
  
  if (fileName.endsWith('.csv')) type = 'csv'
  else if (fileName.endsWith('.ofx')) type = 'ofx'
  else if (fileName.endsWith('.qfx')) type = 'qfx'
  else if (fileName.endsWith('.pdf')) type = 'pdf'
  else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) type = 'excel'
  else if (file.type.startsWith('image/')) type = 'image'
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const result = e.target?.result
        
        if (type === 'excel') {
          // For Excel files, try to read as text first (some xlsx are readable)
          // If it fails, provide file metadata for AI
          try {
            const textReader = new FileReader()
            textReader.onload = (te) => {
              const text = te.target?.result as string
              // Check if it's readable text
              if (text && !text.includes('\x00') && text.length > 0) {
                resolve({ content: text, type: 'csv' }) // Treat readable excel as CSV
              } else {
                resolve({ 
                  content: `[EXCEL FILE]\nFilename: ${file.name}\nSize: ${file.size} bytes\n\nNote: Please export this Excel file as CSV format for better processing. The AI cannot directly read binary Excel files.`,
                  type 
                })
              }
            }
            textReader.onerror = () => {
              resolve({ 
                content: `[EXCEL FILE]\nFilename: ${file.name}\nSize: ${file.size} bytes\n\nNote: Please export this Excel file as CSV format for better processing.`,
                type 
              })
            }
            textReader.readAsText(file)
          } catch {
            resolve({ 
              content: `[EXCEL FILE]\nFilename: ${file.name}\nSize: ${file.size} bytes\n\nNote: Please export this Excel file as CSV format for better processing.`,
              type 
            })
          }
        } else if (type === 'pdf' || type === 'image') {
          // For PDF and images, we can't parse them client-side
          resolve({ 
            content: `[${type.toUpperCase()} FILE]\nFilename: ${file.name}\nSize: ${file.size} bytes\n\nNote: For PDF and image files, please copy the text content or use a CSV/Excel export from your bank.`,
            type 
          })
        } else {
          // Text files (CSV, OFX, QFX)
          resolve({ content: result as string, type })
        }
      } catch (err) {
        reject(new Error(`Failed to process file: ${err}`))
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}