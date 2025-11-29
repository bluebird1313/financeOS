import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  FileBarChart, 
  Download, 
  Calendar,
  PieChart,
  BarChart3,
  TrendingUp,
  FileText,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/utils'
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#84cc16']

export default function ReportsPage() {
  const { transactions, accounts, businesses, categories } = useFinancialStore()
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month')
  const [selectedBusiness, setSelectedBusiness] = useState<string>('all')

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
    </motion.div>
  )
}


