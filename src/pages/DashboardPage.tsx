import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import AlertsWidget from '@/components/AlertsWidget'
import EntitySummaryWidget from '@/components/EntitySummaryWidget'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { 
    accounts, 
    transactions,
    businesses,
    getNetWorth, 
    getRecentTransactions, 
    getUnmatchedChecks,
    getUpcomingBills,
  } = useFinancialStore()
  
  const [entityFilter, setEntityFilter] = useState<string>('all')

  const unmatchedChecks = getUnmatchedChecks()
  const upcomingBills = getUpcomingBills()
  
  // Filter accounts and transactions based on entity filter
  const filteredAccounts = useMemo(() => {
    if (entityFilter === 'all') return accounts
    if (entityFilter === 'personal') return accounts.filter(a => !a.business_id)
    return accounts.filter(a => a.business_id === entityFilter)
  }, [accounts, entityFilter])

  const filteredTransactions = useMemo(() => {
    if (entityFilter === 'all') return transactions
    if (entityFilter === 'personal') return transactions.filter(t => !t.business_id)
    return transactions.filter(t => t.business_id === entityFilter)
  }, [transactions, entityFilter])

  // Calculate net worth for filtered accounts
  const netWorth = useMemo(() => {
    return filteredAccounts.reduce((total, account) => {
      if (account.type === 'credit' || account.type === 'loan') {
        return total - account.current_balance
      }
      return total + account.current_balance
    }, 0)
  }, [filteredAccounts])

  const recentTransactions = useMemo(() => {
    return filteredTransactions.slice(0, 5)
  }, [filteredTransactions])
  
  // Calculate monthly cash flow
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthlyTransactions = filteredTransactions.filter(t => new Date(t.date) >= startOfMonth)
  const monthlyIncome = monthlyTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
  const monthlyExpenses = monthlyTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const monthlySavings = monthlyIncome - monthlyExpenses

  const totalAssets = filteredAccounts
    .filter(a => a.type !== 'credit' && a.type !== 'loan')
    .reduce((sum, a) => sum + a.current_balance, 0)

  const totalLiabilities = filteredAccounts
    .filter(a => a.type === 'credit' || a.type === 'loan')
    .reduce((sum, a) => sum + a.current_balance, 0)

  // Generate real cash flow data from transactions (last 14 days)
  const cashFlowData = useMemo(() => {
    const days = 14
    const data: { date: string; income: number; expenses: number; label: string }[] = []
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      
      const dayTransactions = filteredTransactions.filter(t => t.date.startsWith(dateStr))
      const income = dayTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
      const expenses = dayTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
      
      data.push({ date: dateStr, income, expenses, label: dayLabel })
    }
    
    return data
  }, [filteredTransactions])

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
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {entityFilter === 'all' 
              ? 'Your complete financial overview' 
              : entityFilter === 'personal'
                ? 'Personal finances only'
                : `${businesses.find(b => b.id === entityFilter)?.name || 'Business'} finances`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {businesses.length > 0 && (
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Finances" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Finances</SelectItem>
                <SelectItem value="personal">Personal Only</SelectItem>
                {businesses.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => navigate('/accounts')}>
            <Wallet className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="glass border-primary/20 glow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Net Worth
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gradient">
                {formatCurrency(netWorth)}
              </div>
              <div className="flex items-center gap-1 mt-1 text-sm text-success">
                <TrendingUp className="w-4 h-4" />
                <span>+12.5% from last month</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Total Assets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalAssets)}</div>
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <span>{filteredAccounts.filter(a => a.type !== 'credit' && a.type !== 'loan').length} accounts</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Total Liabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(totalLiabilities)}
              </div>
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <span>{filteredAccounts.filter(a => a.type === 'credit' || a.type === 'loan').length} accounts</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={monthlySavings >= 0 ? 'border-success/20' : 'border-destructive/20'}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Monthly Savings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${monthlySavings >= 0 ? 'text-success' : 'text-destructive'}`}>
                {monthlySavings >= 0 ? '+' : ''}{formatCurrency(monthlySavings)}
              </div>
              <div className="text-sm text-muted-foreground">
                This month
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow</CardTitle>
              <CardDescription>Income vs Expenses over the past 14 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashFlowData}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                      dataKey="label" 
                      stroke="#71717a"
                      fontSize={11}
                      interval={1}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="#71717a"
                      fontSize={12}
                      tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => label}
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorIncome)"
                      name="Income"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorExpenses)"
                      name="Expenses"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions & Alerts */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Upcoming Bills */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Upcoming Bills</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/payments')}>
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingBills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming bills
                </p>
              ) : (
                upcomingBills.slice(0, 3).map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{bill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(bill.due_date)}
                      </p>
                    </div>
                    <Badge variant={
                      new Date(bill.due_date) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                        ? 'warning'
                        : 'secondary'
                    }>
                      {formatCurrency(bill.amount)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Unmatched Checks */}
          {unmatchedChecks.length > 0 && (
            <Card className="border-warning/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-warning" />
                    Unmatched Checks
                  </CardTitle>
                  <Badge variant="warning">{unmatchedChecks.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  These checks need payee information
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => navigate('/payments')}
                >
                  Review Checks
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Entity Summary - Personal vs Business Breakdown */}
      <motion.div variants={itemVariants}>
        <EntitySummaryWidget 
          accounts={accounts}
          businesses={businesses}
          transactions={transactions}
        />
      </motion.div>

      {/* Recent Transactions */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your latest financial activity</CardDescription>
              </div>
              <Button variant="outline" onClick={() => navigate('/transactions')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No transactions yet</p>
                <Button variant="link" onClick={() => navigate('/accounts')}>
                  Connect a bank account to get started
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTransactions.map((transaction) => (
                  <div 
                    key={transaction.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        transaction.amount > 0 
                          ? 'bg-success/10 text-success' 
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {transaction.amount > 0 
                          ? <ArrowDownRight className="w-5 h-5" />
                          : <ArrowUpRight className="w-5 h-5" />
                        }
                      </div>
                      <div>
                        <p className="font-medium">{transaction.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatRelativeDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                    <div className={`font-semibold ${
                      transaction.amount > 0 ? 'text-success' : ''
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Alerts Widget */}
      <motion.div variants={itemVariants}>
        <AlertsWidget />
      </motion.div>

      {/* Account Summary */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Account Summary</CardTitle>
            <CardDescription>Balance distribution across your accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAccounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  {entityFilter === 'all' ? 'No accounts connected' : 'No accounts in this entity'}
                </p>
                <Button onClick={() => navigate('/accounts')}>
                  <Wallet className="w-4 h-4 mr-2" />
                  {entityFilter === 'all' ? 'Connect Your First Account' : 'View All Accounts'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAccounts.slice(0, 5).map((account) => {
                  const percentage = totalAssets > 0 
                    ? (Math.abs(account.current_balance) / (totalAssets + totalLiabilities)) * 100
                    : 0
                  
                  return (
                    <div key={account.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {account.type}
                          </Badge>
                        </div>
                        <span className={`font-semibold ${
                          account.type === 'credit' || account.type === 'loan'
                            ? 'text-destructive'
                            : ''
                        }`}>
                          {formatCurrency(account.current_balance)}
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
                {filteredAccounts.length > 5 && (
                  <Button 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => navigate('/accounts')}
                  >
                    View all {filteredAccounts.length} accounts
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}




