import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, 
  Sparkles, 
  User, 
  Loader2,
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  Lightbulb,
  MessageSquare,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
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
  "How much did I spend this month?",
  "What are my largest expenses?",
  "Show me my subscriptions",
  "Any unusual transactions?",
]

interface AIAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function AIAssistantPanel({ isOpen, onClose }: AIAssistantPanelProps) {
  const { transactions, accounts, bills } = useFinancialStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
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

      const response = await chatWithAssistant(input.trim(), context, history)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      let errorContent = 'I apologize, but I encountered an error. Please try again.'
      
      if (error?.message) {
        if (error.message.includes('Not authenticated')) {
          errorContent = '🔐 Please sign in to use AI features.'
        } else if (error.message.includes('timed out')) {
          errorContent = '⏱️ Request timed out. Try a simpler question.'
        } else {
          errorContent = `❌ ${error.message}`
        }
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed right-0 top-0 h-full bg-background border-l shadow-2xl z-50 flex flex-col ${
              isExpanded ? 'w-[600px]' : 'w-[400px]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">AI Assistant</h2>
                  <p className="text-xs text-muted-foreground">Ask about your finances</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-8">
                    <Sparkles className="w-12 h-12 text-primary mb-4" />
                    <h3 className="font-semibold mb-2">How can I help?</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mb-6">
                      I can analyze your transactions and provide financial insights.
                    </p>
                    
                    <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                      {suggestedQuestions.map((question, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          className="h-auto py-2 px-4 text-left text-sm"
                          onClick={() => handleSuggestedQuestion(question)}
                        >
                          {question}
                        </Button>
                      ))}
                    </div>

                    {/* Quick Insights */}
                    <div className="mt-6 w-full max-w-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-warning" />
                          Quick Insights
                        </span>
                        {insights && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={handleGenerateInsights}
                            disabled={isLoadingInsights}
                          >
                            <RefreshCw className={`w-3 h-3 ${isLoadingInsights ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                      </div>
                      {isLoadingInsights ? (
                        <div className="text-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                        </div>
                      ) : insights ? (
                        <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/50 whitespace-pre-wrap">
                          {insights}
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={handleGenerateInsights}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Insights
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        
                        {message.role === 'user' && (
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="bg-muted rounded-2xl px-3 py-2">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
              
              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
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
                    className="min-h-[44px] max-h-[120px] resize-none"
                    rows={1}
                  />
                  <Button 
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Floating AI Button component
export function AIFloatingButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center z-30"
      title="AI Assistant"
    >
      <MessageSquare className="w-6 h-6" />
    </motion.button>
  )
}

