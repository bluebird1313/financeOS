import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  Search, 
  Filter, 
  Download, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreVertical,
  Tag,
  Building2,
  Pencil,
  SplitSquareVertical,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types/database'

export default function TransactionsPage() {
  const { transactions, accounts, categories, businesses, isLoadingTransactions, updateTransaction } = useFinancialStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [transactionType, setTransactionType] = useState<'all' | 'income' | 'expense'>('all')

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!t.name.toLowerCase().includes(query) && 
            !t.merchant_name?.toLowerCase().includes(query)) {
          return false
        }
      }
      
      // Account filter
      if (selectedAccount !== 'all' && t.account_id !== selectedAccount) {
        return false
      }
      
      // Category filter
      if (selectedCategory !== 'all' && t.category_id !== selectedCategory) {
        return false
      }
      
      // Type filter
      if (transactionType === 'income' && t.amount <= 0) return false
      if (transactionType === 'expense' && t.amount >= 0) return false
      
      return true
    })
  }, [transactions, searchQuery, selectedAccount, selectedCategory, transactionType])

  const totalIncome = filteredTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = filteredTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const getAccountName = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.name || 'Unknown'
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null
    return categories.find(c => c.id === categoryId)?.name || null
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
          <h1 className="font-display text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Income</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                +{formatCurrency(totalIncome)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                -{formatCurrency(totalExpenses)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={totalIncome - totalExpenses >= 0 ? 'border-success/20' : 'border-destructive/20'}>
            <CardHeader className="pb-2">
              <CardDescription>Net</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                totalIncome - totalExpenses >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                {totalIncome - totalExpenses >= 0 ? '+' : ''}{formatCurrency(totalIncome - totalExpenses)}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select 
                value={transactionType} 
                onValueChange={(v) => setTransactionType(v as typeof transactionType)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transactions List */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTransactions ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {transactions.length === 0 
                    ? 'No transactions yet. Connect a bank account to import transactions.'
                    : 'No transactions match your filters.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((transaction) => {
                  const categoryName = getCategoryName(transaction.category_id)
                  const business = businesses.find(b => b.id === transaction.business_id)
                  
                  return (
                    <div 
                      key={transaction.id}
                      className="flex items-center justify-between p-4 rounded-lg hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          transaction.amount > 0 
                            ? 'bg-success/10 text-success' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {transaction.amount > 0 
                            ? <ArrowDownRight className="w-5 h-5" />
                            : <ArrowUpRight className="w-5 h-5" />
                          }
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {transaction.merchant_name || transaction.name}
                            </span>
                            {transaction.pending && (
                              <Badge variant="outline" className="text-xs">Pending</Badge>
                            )}
                            {transaction.check_number && (
                              <Badge variant="secondary" className="text-xs">
                                Check #{transaction.check_number}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatDate(transaction.date)}</span>
                            <span>•</span>
                            <span>{getAccountName(transaction.account_id)}</span>
                            {categoryName && (
                              <>
                                <span>•</span>
                                <span>{categoryName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {business && (
                            <Badge variant="secondary" className="text-xs">
                              <Building2 className="w-3 h-3 mr-1" />
                              {business.name}
                            </Badge>
                          )}
                          {transaction.is_business_expense && (
                            <Badge variant="outline" className="text-xs">Business</Badge>
                          )}
                        </div>
                        
                        <div className={`text-lg font-semibold min-w-[100px] text-right ${
                          transaction.amount > 0 ? 'text-success' : ''
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Tag className="w-4 h-4 mr-2" />
                              Change Category
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Building2 className="w-4 h-4 mr-2" />
                              Assign to Business
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Pencil className="w-4 h-4 mr-2" />
                              Add Note
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <SplitSquareVertical className="w-4 h-4 mr-2" />
                              Split Transaction
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}


