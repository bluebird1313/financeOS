import OpenAI from 'openai'

const apiKey = import.meta.env.VITE_OPENAI_API_KEY || ''

// Log if API key is configured (don't log the actual key!)
console.log('🤖 OpenAI API Key configured:', apiKey ? `Yes (${apiKey.slice(0, 10)}...)` : 'NO - Missing!')

const openai = new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true, // We'll move to backend in production
})

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    })

    const content = response.choices[0]?.message?.content || '{}'
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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    })

    return response.choices[0]?.message?.content || 'Unable to generate insights at this time.'
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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 800,
    })

    return response.choices[0]?.message?.content || 'I apologize, but I was unable to process your request.'
  } catch (error: any) {
    console.error('🤖 OpenAI Chat Error:', error)
    console.error('Error details:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
    })
    
    // Return helpful error message
    if (error?.status === 401) {
      return 'API key is invalid or expired. Please check your OpenAI API key.'
    } else if (error?.status === 429) {
      return 'Rate limit exceeded or quota reached. Please check your OpenAI billing.'
    } else if (error?.code === 'insufficient_quota') {
      return 'Your OpenAI account has insufficient quota. Please add credits.'
    }
    
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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 100,
    })

    const content = response.choices[0]?.message?.content || 'null'
    return JSON.parse(content)
  } catch {
    return null
  }
}


