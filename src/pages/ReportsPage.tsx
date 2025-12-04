import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  FileBarChart, 
  Download, 
  Calendar,
  PieChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  FileText,
  FileSpreadsheet,
  FolderKanban,
  DollarSign,
  Target,
  AlertTriangle,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { exportTransactionsToExcel, exportTransactionsToCSV } from '@/lib/exporters/excelExporter'
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Progress } from '@/components/ui/progress'

const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#84cc16']

export default function ReportsPage() {
  const { transactions, accounts, businesses, categories, projects, bills, getNetWorth, fetchProjects } = useFinancialStore()
  const { user } = useAuthStore()
  const { toast } = useToast()
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month')
  const [selectedBusiness, setSelectedBusiness] = useState<string>('all')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [cashFlowRange, setCashFlowRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [exportOptions, setExportOptions] = useState({
    format: 'excel' as 'excel' | 'csv',
    includeAllProjects: true,
    selectedProject: 'all',
    groupBy: 'none' as 'none' | 'project' | 'account',
  })

  useEffect(() => {
    if (user) {
      fetchProjects(user.id)
    }
  }, [user, fetchProjects])

  // Filter transactions based on time range
  const filteredTransactions = useMemo(() => {
    const now = new Date()
    let startDate: Date
    
    switch (timeRange) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
    }
    
    return transactions.filter(t => {
      const txDate = new Date(t.date)
      return txDate >= startDate && 
        (selectedBusiness === 'all' || t.business_id === selectedBusiness)
    })
  }, [transactions, timeRange, selectedBusiness])

  // Calculate spending by category
  const spendingByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {}
    
    filteredTransactions
      .filter(t => t.amount < 0)
      .forEach(t => {
        const catId = t.category_id || 'uncategorized'
        const category = categories.find(c => c.id === catId)
        const name = category?.name || 'Uncategorized'
        categoryTotals[name] = (categoryTotals[name] || 0) + Math.abs(t.amount)
      })

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredTransactions, categories])

  // Monthly comparison data
  const monthlyData = useMemo(() => {
    const months: Record<string, { income: number; expenses: number; month: string }> = {}
    
    transactions.forEach(t => {
      const date = new Date(t.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      
      if (!months[monthKey]) {
        months[monthKey] = { income: 0, expenses: 0, month: monthName }
      }
      
      if (t.amount > 0) {
        months[monthKey].income += t.amount
      } else {
        months[monthKey].expenses += Math.abs(t.amount)
      }
    })

    return Object.values(months).slice(-12)
  }, [transactions])

  // Cash flow data for the Cash Flow tab
  const cashFlowData = useMemo(() => {
    const now = new Date()
    let daysBack: number
    switch (cashFlowRange) {
      case '7d': daysBack = 7; break
      case '30d': daysBack = 30; break
      case '90d': daysBack = 90; break
      case '1y': daysBack = 365; break
    }

    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    const dailyData: Record<string, { income: number; expenses: number; date: string }> = {}
    
    transactions
      .filter(t => {
        const txDate = new Date(t.date)
        return txDate >= startDate && txDate <= now
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
  }, [transactions, cashFlowRange])

  const cashFlowTotals = {
    income: cashFlowData.reduce((sum, d) => sum + d.income, 0),
    expenses: cashFlowData.reduce((sum, d) => sum + d.expenses, 0),
  }
  const netCashFlow = cashFlowTotals.income - cashFlowTotals.expenses

  // 30-day forecast
  const forecastData = useMemo(() => {
    const avgDailyIncome = cashFlowData.length > 0 ? cashFlowTotals.income / cashFlowData.length : 0
    const avgDailyExpenses = cashFlowData.length > 0 ? cashFlowTotals.expenses / cashFlowData.length : 0
    
    const forecast = []
    let balance = getNetWorth()
    
    for (let i = 1; i <= 30; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      balance += avgDailyIncome - avgDailyExpenses
      
      bills.forEach(bill => {
        const billDate = new Date(bill.due_date)
        if (billDate.toDateString() === date.toDateString() && bill.status !== 'paid') {
          balance -= bill.amount
        }
      })
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        balance,
        label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date),
      })
    }
    
    return forecast
  }, [cashFlowData, cashFlowTotals, bills, getNetWorth])

  // Category breakdown for spending
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    
    filteredTransactions
      .filter(t => t.amount < 0)
      .forEach(t => {
        const cat = categories.find(c => c.id === t.category_id)
        const name = cat?.name || 'Uncategorized'
        breakdown[name] = (breakdown[name] || 0) + Math.abs(t.amount)
      })

    return Object.entries(breakdown)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
  }, [filteredTransactions, categories])

  // Calculate totals
  const totalIncome = filteredTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = filteredTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const netIncome = totalIncome - totalExpenses

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

  const handleExportCSV = () => {
    // Generate CSV content
    const headers = ['Date', 'Description', 'Amount', 'Category', 'Account']
    const rows = filteredTransactions.map(t => [
      t.date,
      t.name,
      t.amount.toFixed(2),
      categories.find(c => c.id === t.category_id)?.name || 'Uncategorized',
      accounts.find(a => a.id === t.account_id)?.name || 'Unknown',
    ])
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${timeRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = () => {
    // Prepare filters
    const now = new Date()
    let startDate: string | undefined
    
    switch (timeRange) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        break
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0]
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
        break
    }

    const filters = {
      startDate,
      projectIds: !exportOptions.includeAllProjects && exportOptions.selectedProject !== 'all' 
        ? [exportOptions.selectedProject] 
        : undefined,
      businessIds: selectedBusiness !== 'all' ? [selectedBusiness] : undefined,
    }

    const options = {
      transactions,
      accounts,
      projects,
      businesses,
      filters,
      groupBy: exportOptions.groupBy,
      includeUnassigned: exportOptions.includeAllProjects || exportOptions.selectedProject === 'all',
    }

    let result
    if (exportOptions.format === 'excel') {
      result = exportTransactionsToExcel(options)
    } else {
      result = exportTransactionsToCSV(options)
    }

    if (result.success) {
      toast({
        title: 'Export successful',
        description: `Downloaded ${result.fileName}`,
      })
    } else {
      toast({
        title: 'Export failed',
        description: result.error || 'Unknown error',
        variant: 'destructive',
      })
    }

    setShowExportDialog(false)
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
          <h1 className="font-display text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Financial reports and analytics</p>
        </div>
        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          {businesses.length > 0 && (
            <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (Personal + Business)</SelectItem>
                <SelectItem value="personal">Personal Only</SelectItem>
                {businesses.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setShowExportDialog(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <Card className={netIncome >= 0 ? 'border-success/20' : 'border-destructive/20'}>
            <CardHeader className="pb-2">
              <CardDescription>Net Income</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
                {netIncome >= 0 ? '+' : ''}{formatCurrency(netIncome)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredTransactions.length}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Report Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="spending">
          <TabsList>
            <TabsTrigger value="spending">
              <PieChart className="w-4 h-4 mr-2" />
              Spending
            </TabsTrigger>
            <TabsTrigger value="trends">
              <BarChart3 className="w-4 h-4 mr-2" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="cashflow">
              <DollarSign className="w-4 h-4 mr-2" />
              Cash Flow
            </TabsTrigger>
            <TabsTrigger value="income">
              <TrendingUp className="w-4 h-4 mr-2" />
              Income
            </TabsTrigger>
            <TabsTrigger value="tax">
              <FileText className="w-4 h-4 mr-2" />
              Tax Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="spending" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Spending by Category</CardTitle>
                  <CardDescription>
                    Where your money went this {timeRange}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {spendingByCategory.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No spending data available
                    </div>
                  ) : (
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={spendingByCategory}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={120}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {spendingByCategory.map((entry, index) => (
                              <Cell 
                                key={entry.name} 
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{
                              backgroundColor: '#18181b',
                              border: '1px solid #27272a',
                              borderRadius: '8px',
                            }}
                          />
                          <Legend />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {spendingByCategory.slice(0, 10).map((item, index) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="flex-1 text-sm">{item.name}</span>
                        <span className="font-semibold">{formatCurrency(item.value)}</span>
                        <span className="text-sm text-muted-foreground">
                          {((item.value / totalExpenses) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Income vs Expenses</CardTitle>
                <CardDescription>
                  Compare your income and spending over the past 12 months
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis 
                        dataKey="month" 
                        stroke="#71717a"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#71717a"
                        fontSize={12}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow Tab */}
          <TabsContent value="cashflow" className="mt-4 space-y-6">
            {/* Cash Flow Controls */}
            <div className="flex justify-end">
              <Select value={cashFlowRange} onValueChange={(v) => setCashFlowRange(v as typeof cashFlowRange)}>
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

            {/* Cash Flow Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-success" />
                    Income
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    +{formatCurrency(cashFlowTotals.income)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-destructive" />
                    Expenses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    -{formatCurrency(cashFlowTotals.expenses)}
                  </div>
                </CardContent>
              </Card>

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

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Savings Rate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {cashFlowTotals.income > 0 ? Math.round((netCashFlow / cashFlowTotals.income) * 100) : 0}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cash Flow Chart */}
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
                        <linearGradient id="cfIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="cfExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#71717a"
                        fontSize={12}
                        tickFormatter={(date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date))}
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
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="income"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#cfIncomeGradient)"
                        name="Income"
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        stroke="#ef4444"
                        strokeWidth={2}
                        fill="url(#cfExpenseGradient)"
                        name="Expenses"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Forecast and Spending Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 30-Day Forecast */}
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

              {/* Spending by Category */}
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
                      {categoryBreakdown.map((item) => {
                        const percentage = totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0
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
            </div>
          </TabsContent>

          <TabsContent value="income" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Income Sources</CardTitle>
                <CardDescription>
                  Breakdown of your income streams
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Income source analysis coming soon...
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Tax Summary</CardTitle>
                <CardDescription>
                  Deductible expenses by Schedule C category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Tax summary report coming soon...
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Quick Reports */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Quick Reports</CardTitle>
            <CardDescription>
              Generate common financial reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto py-4 flex-col">
                <FileBarChart className="w-6 h-6 mb-2" />
                <span>Net Worth Statement</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col">
                <FileText className="w-6 h-6 mb-2" />
                <span>Profit & Loss (P&L)</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col">
                <Calendar className="w-6 h-6 mb-2" />
                <span>Year-End Summary</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Transactions</DialogTitle>
            <DialogDescription>
              Export your transactions to Excel with itemized debits and credits grouped by project or account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select 
                value={exportOptions.format} 
                onValueChange={(v) => setExportOptions(prev => ({ ...prev, format: v as 'excel' | 'csv' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel (.xlsx) with summaries
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      CSV (simple)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {exportOptions.format === 'excel' && (
              <div className="space-y-2">
                <Label>Group Summary By</Label>
                <Select 
                  value={exportOptions.groupBy} 
                  onValueChange={(v) => setExportOptions(prev => ({ ...prev, groupBy: v as 'none' | 'project' | 'account' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Include all summaries</SelectItem>
                    <SelectItem value="project">Project summary only</SelectItem>
                    <SelectItem value="account">Account summary only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Filter by Project</Label>
              <div className="flex items-center gap-2 mb-2">
                <Switch
                  id="all-projects"
                  checked={exportOptions.includeAllProjects}
                  onCheckedChange={(checked) => setExportOptions(prev => ({ 
                    ...prev, 
                    includeAllProjects: checked,
                    selectedProject: 'all'
                  }))}
                />
                <Label htmlFor="all-projects" className="font-normal">Include all projects</Label>
              </div>
              
              {!exportOptions.includeAllProjects && (
                <Select 
                  value={exportOptions.selectedProject} 
                  onValueChange={(v) => setExportOptions(prev => ({ ...prev, selectedProject: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.filter(p => p.is_active).map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: project.color }}
                          />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">Export includes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Transactions sheet with separate Debit/Credit columns</li>
                {exportOptions.format === 'excel' && (
                  <>
                    <li>Summary by Project (totals per project)</li>
                    <li>Summary by Account (totals per account with linked business)</li>
                  </>
                )}
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}




