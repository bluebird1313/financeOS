import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Send, 
  Sparkles, 
  User, 
  Loader2,
  RefreshCw,
  Lightbulb,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { chatWithAssistant, generateFinancialInsights } from '@/lib/openai'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const suggestedQuestions = [
  "How much did I spend on dining out this month?",
  "What are my largest recurring expenses?",
  "Show me my spending compared to last month",
  "Which subscriptions am I paying for?",
  "What's my average daily spending?",
  "Do I have any unusual transactions?",
]

export default function AssistantPage() {
  const { transactions, accounts, bills } = useFinancialStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [insights, setInsights] = useState<string>('')
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Limit context to prevent timeouts with large datasets
      const context = {
        transactions: transactions.slice(0, 50).map(t => ({
          description: t.name,
          amount: t.amount,
          date: t.date,
          category: t.category_id || 'Uncategorized',
        })),
        balances: accounts.map(a => ({
          name: a.name,
          balance: a.current_balance,
        })),
        bills: bills.slice(0, 20).map(b => ({
          name: b.name,
          amount: b.amount,
          dueDate: b.due_date,
        })),
      }

      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out')), 30000)
      )
      
      const response = await Promise.race([
        chatWithAssistant(input.trim(), context, history),
        timeoutPromise
      ])

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error?.message === 'Request timed out' 
          ? 'The request took too long. Please try a simpler question or try again.'
          : 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateInsights = async () => {
    setIsLoadingInsights(true)
    try {
      const txData = transactions.slice(0, 50).map(t => ({
        description: t.name,
        amount: t.amount,
        date: t.date,
        category: t.category_id || 'Uncategorized',
      }))

      const balanceData = accounts.map(a => ({
        name: a.name,
        balance: a.current_balance,
        type: a.type,
      }))

      const result = await generateFinancialInsights(txData, balanceData)
      setInsights(result)
    } catch {
      setInsights('Unable to generate insights at this time.')
    } finally {
      setIsLoadingInsights(false)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    setInput(question)
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            AI Financial Assistant
          </h1>
          <p className="text-muted-foreground">Ask me anything about your finances</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Section */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle>Chat</CardTitle>
              <CardDescription>
                Ask questions about your spending, accounts, and financial trends
              </CardDescription>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              {/* Messages */}
              <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-8">
                    <Sparkles className="w-12 h-12 text-primary mb-4" />
                    <h3 className="font-semibold mb-2">How can I help you today?</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-6">
                      I can analyze your transactions, track spending patterns, and provide personalized financial insights.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                      {suggestedQuestions.slice(0, 4).map((question, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          className="h-auto py-3 px-4 text-left text-sm whitespace-normal"
                          onClick={() => handleSuggestedQuestion(question)}
                        >
                          {question}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        
                        {message.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div className="bg-muted rounded-2xl px-4 py-3">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
              
              {/* Input */}
              <div className="pt-4 border-t">
                <div className="flex gap-3">
                  <Textarea
                    placeholder="Ask me about your finances..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    className="min-h-[60px] resize-none"
                    rows={2}
                  />
                  <Button 
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="px-4"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Insights Panel */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Quick Insights */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-warning" />
                  AI Insights
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleGenerateInsights}
                  disabled={isLoadingInsights}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingInsights ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <CardDescription>
                Personalized observations about your finances
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingInsights ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : insights ? (
                <div className="text-sm whitespace-pre-wrap">{insights}</div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Get AI-powered insights about your financial data
                  </p>
                  <Button onClick={handleGenerateInsights} variant="outline" size="sm">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Insights
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suggested Questions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Try Asking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {suggestedQuestions.map((question, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    className="w-full justify-start h-auto py-2 px-3 text-left text-sm"
                    onClick={() => handleSuggestedQuestion(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}


