import { supabase } from './supabase'

// Helper to call the secure OpenAI Edge Function
async function callOpenAI(messages: Array<{ role: string; content: string }>, type: 'chat' | 'categorize' | 'insights' = 'chat'): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-chat`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, type }),
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content
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
  const systemPrompt = `You are a helpful financial assistant for a personal finance app. You have access to the user's financial data and can answer questions about their spending, income, bills, and accounts.

Current Financial Context:
${context.balances ? `Account Balances: ${JSON.stringify(context.balances)}` : ''}
${context.transactions ? `Recent Transactions (last 30): ${JSON.stringify(context.transactions.slice(0, 30))}` : ''}
${context.bills ? `Upcoming Bills: ${JSON.stringify(context.bills)}` : ''}

Be helpful, specific, and use actual numbers from their data when answering questions. If you don't have enough data to answer, say so.`

  try {
    return await callOpenAI([
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ])
  } catch (error: any) {
    console.error('🤖 Chat Error:', error)
    return `Error: ${error?.message || 'Unknown error'}. Please try again.`
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
      const result = e.target?.result
      
      if (type === 'pdf' || type === 'excel' || type === 'image') {
        // For binary files, we'll convert to base64 and let the AI handle it
        // In production, you'd use proper PDF/Excel parsing libraries
        const base64 = btoa(
          new Uint8Array(result as ArrayBuffer)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        resolve({ 
          content: `[${type.toUpperCase()} FILE - BASE64 ENCODED]\nFilename: ${file.name}\nSize: ${file.size} bytes\n\nNote: This is a binary file. The AI will attempt to extract information based on common ${type} formats.`,
          type 
        })
      } else {
        // Text files (CSV, OFX, QFX)
        resolve({ content: result as string, type })
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    
    if (type === 'pdf' || type === 'excel' || type === 'image') {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file)
    }
  })
}