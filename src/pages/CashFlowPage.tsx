import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Target,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export default function CashFlowPage() {
  const { transactions, accounts, bills, getNetWorth } = useFinancialStore()
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all')

  // Calculate cash flow data
  const cashFlowData = useMemo(() => {
    const now = new Date()
    let daysBack: number
    switch (timeRange) {
      case '7d': daysBack = 7; break
      case '30d': daysBack = 30; break
      case '90d': daysBack = 90; break
      case '1y': daysBack = 365; break
    }

    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    
    // Group transactions by day
    const dailyData: Record<string, { income: number; expenses: number; date: string }> = {}
    
    transactions
      .filter(t => {
        const txDate = new Date(t.date)
        return txDate >= startDate && txDate <= now &&
          (selectedAccountId === 'all' || t.account_id === selectedAccountId)
      })
      .forEach(t => {
        const dateKey = t.date.split('T')[0]
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { income: 0, expenses: 0, date: dateKey }
        }
        if (t.amount > 0) {
          dailyData[dateKey].income += t.amount
        } else {
          dailyData[dateKey].expenses += Math.abs(t.amount)
        }
      })

    return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date))
  }, [transactions, timeRange, selectedAccountId])

  // Calculate totals
  const totalIncome = cashFlowData.reduce((sum, d) => sum + d.income, 0)
  const totalExpenses = cashFlowData.reduce((sum, d) => sum + d.expenses, 0)
  const netCashFlow = totalIncome - totalExpenses

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    
    transactions
      .filter(t => t.amount < 0)
      .forEach(t => {
        const category = t.category_id || 'Uncategorized'
        breakdown[category] = (breakdown[category] || 0) + Math.abs(t.amount)
      })

    return Object.entries(breakdown)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
  }, [transactions])

  // Forecast data (simplified - in production this would use AI)
  const forecastData = useMemo(() => {
    const avgDailyIncome = totalIncome / cashFlowData.length || 0
    const avgDailyExpenses = totalExpenses / cashFlowData.length || 0
    
    const forecast = []
    let balance = getNetWorth()
    
    for (let i = 1; i <= 30; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      balance += avgDailyIncome - avgDailyExpenses
      
      // Factor in upcoming bills
      bills.forEach(bill => {
        const billDate = new Date(bill.due_date)
        if (billDate.toDateString() === date.toDateString() && bill.status !== 'paid') {
          balance -= bill.amount
        }
      })
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        balance,
        label: formatDate(date, { month: 'short', day: 'numeric' }),
      })
    }
    
    return forecast
  }, [cashFlowData, totalIncome, totalExpenses, bills, getNetWorth])

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
          <h1 className="font-display text-3xl font-bold">Cash Flow</h1>
          <p className="text-muted-foreground">Monitor your money movement</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
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
          
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                Income
              </CardDescription>
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
              <CardDescription className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-destructive" />
                Expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                -{formatCurrency(totalExpenses)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={netCashFlow >= 0 ? 'border-success/20' : 'border-destructive/20'}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Net Cash Flow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-success' : 'text-destructive'}`}>
                {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Savings Rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalIncome > 0 ? Math.round((netCashFlow / totalIncome) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Cash Flow Chart */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Over Time</CardTitle>
            <CardDescription>Income vs expenses trend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#71717a"
                    fontSize={12}
                    tickFormatter={(date) => formatDate(date, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    stroke="#71717a"
                    fontSize={12}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(date) => formatDate(date)}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#incomeGradient)"
                    name="Income"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#expenseGradient)"
                    name="Expenses"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Forecast and Spending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 30-Day Forecast */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                30-Day Balance Forecast
              </CardTitle>
              <CardDescription>
                Projected balance based on your spending patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData}>
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                      dataKey="label" 
                      stroke="#71717a"
                      fontSize={11}
                    />
                    <YAxis 
                      stroke="#71717a"
                      fontSize={12}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fill="url(#balanceGradient)"
                      name="Projected Balance"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              {forecastData.some(d => d.balance < 0) && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Low Balance Warning</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your balance may go negative in the next 30 days. Consider reviewing upcoming expenses.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Spending by Category */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
              <CardDescription>
                Where your money is going
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categoryBreakdown.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No spending data available
                </div>
              ) : (
                <div className="space-y-4">
                  {categoryBreakdown.map((item, index) => {
                    const percentage = (item.amount / totalExpenses) * 100
                    return (
                      <div key={item.category} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.category}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(item.amount)} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress 
                          value={percentage} 
                          className="h-2"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}


