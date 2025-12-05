import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  User, 
  Building2, 
  Home, 
  TrendingUp,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  PieChart,
  BarChart3,
  Wallet,
  Target,
  Info,
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

const ENTITY_COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1']

interface EntityData {
  id: string | null
  name: string
  type: 'personal' | 'business'
  assets: number
  liabilities: number
  netWorth: number
  monthlyIncome: number
  monthlyExpenses: number
  ytdIncome: number
  ytdExpenses: number
  accountCount: number
  transactionCount: number
}

export default function FinancialOverviewPage() {
  const { accounts, transactions, businesses, categories } = useFinancialStore()
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month')
  const [selectedEntity, setSelectedEntity] = useState<string>('all')

  // Calculate entity-level data
  const entityData = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    
    // Personal entity
    const personalAccounts = accounts.filter(a => !a.business_id)
    const personalTransactions = transactions.filter(t => !t.business_id)
    const personalMonthlyTx = personalTransactions.filter(t => new Date(t.date) >= startOfMonth)
    const personalYtdTx = personalTransactions.filter(t => new Date(t.date) >= startOfYear)
    
    const personalAssets = personalAccounts
      .filter(a => a.type !== 'credit' && a.type !== 'loan')
      .reduce((sum, a) => sum + a.current_balance, 0)
    const personalLiabilities = personalAccounts
      .filter(a => a.type === 'credit' || a.type === 'loan')
      .reduce((sum, a) => sum + a.current_balance, 0)

    const entities: EntityData[] = [
      {
        id: null,
        name: 'Personal',
        type: 'personal',
        assets: personalAssets,
        liabilities: personalLiabilities,
        netWorth: personalAssets - personalLiabilities,
        monthlyIncome: personalMonthlyTx.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
        monthlyExpenses: personalMonthlyTx.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
        ytdIncome: personalYtdTx.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
        ytdExpenses: personalYtdTx.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
        accountCount: personalAccounts.length,
        transactionCount: personalTransactions.length,
      }
    ]

    // Business entities
    businesses.forEach(business => {
      const bizAccounts = accounts.filter(a => a.business_id === business.id)
      const bizTransactions = transactions.filter(t => t.business_id === business.id)
      const bizMonthlyTx = bizTransactions.filter(t => new Date(t.date) >= startOfMonth)
      const bizYtdTx = bizTransactions.filter(t => new Date(t.date) >= startOfYear)
      
      const bizAssets = bizAccounts
        .filter(a => a.type !== 'credit' && a.type !== 'loan')
        .reduce((sum, a) => sum + a.current_balance, 0)
      const bizLiabilities = bizAccounts
        .filter(a => a.type === 'credit' || a.type === 'loan')
        .reduce((sum, a) => sum + a.current_balance, 0)

      entities.push({
        id: business.id,
        name: business.name,
        type: 'business',
        assets: bizAssets,
        liabilities: bizLiabilities,
        netWorth: bizAssets - bizLiabilities,
        monthlyIncome: bizMonthlyTx.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
        monthlyExpenses: bizMonthlyTx.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
        ytdIncome: bizYtdTx.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
        ytdExpenses: bizYtdTx.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
        accountCount: bizAccounts.length,
        transactionCount: bizTransactions.length,
      })
    })

    return entities
  }, [accounts, transactions, businesses])

  // Calculate totals
  const totals = useMemo(() => {
    return entityData.reduce(
      (acc, entity) => ({
        assets: acc.assets + entity.assets,
        liabilities: acc.liabilities + entity.liabilities,
        netWorth: acc.netWorth + entity.netWorth,
        monthlyIncome: acc.monthlyIncome + entity.monthlyIncome,
        monthlyExpenses: acc.monthlyExpenses + entity.monthlyExpenses,
        ytdIncome: acc.ytdIncome + entity.ytdIncome,
        ytdExpenses: acc.ytdExpenses + entity.ytdExpenses,
      }),
      { assets: 0, liabilities: 0, netWorth: 0, monthlyIncome: 0, monthlyExpenses: 0, ytdIncome: 0, ytdExpenses: 0 }
    )
  }, [entityData])

  // Net worth distribution for pie chart
  const netWorthDistribution = useMemo(() => {
    return entityData
      .filter(e => e.netWorth > 0)
      .map((e, i) => ({
        name: e.name,
        value: e.netWorth,
        color: ENTITY_COLORS[i % ENTITY_COLORS.length],
      }))
  }, [entityData])

  // Monthly comparison data
  const monthlyComparisonData = useMemo(() => {
    return entityData.map((e, i) => ({
      name: e.name,
      income: e.monthlyIncome,
      expenses: e.monthlyExpenses,
      net: e.monthlyIncome - e.monthlyExpenses,
      color: ENTITY_COLORS[i % ENTITY_COLORS.length],
    }))
  }, [entityData])

  // Calculate spending by category for selected entity
  const spendingByCategory = useMemo(() => {
    let filteredTx = transactions.filter(t => t.amount < 0)
    
    if (selectedEntity !== 'all') {
      if (selectedEntity === 'personal') {
        filteredTx = filteredTx.filter(t => !t.business_id)
      } else {
        filteredTx = filteredTx.filter(t => t.business_id === selectedEntity)
      }
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    filteredTx = filteredTx.filter(t => new Date(t.date) >= startOfMonth)

    const categoryTotals: Record<string, number> = {}
    filteredTx.forEach(t => {
      const cat = categories.find(c => c.id === t.category_id)
      const name = cat?.name || 'Uncategorized'
      categoryTotals[name] = (categoryTotals[name] || 0) + Math.abs(t.amount)
    })

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [transactions, categories, selectedEntity])

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
          <h1 className="font-display text-3xl font-bold">Financial Overview</h1>
          <p className="text-muted-foreground">Complete picture of your personal and business finances</p>
        </div>
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
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="glass border-primary/20 glow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Total Net Worth
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gradient">
                {formatCurrency(totals.netWorth)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Across {entityData.length} {entityData.length === 1 ? 'entity' : 'entities'}
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
              <div className="text-2xl font-bold">{formatCurrency(totals.assets)}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {accounts.filter(a => a.type !== 'credit' && a.type !== 'loan').length} accounts
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-destructive" />
                Total Liabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(totals.liabilities)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {accounts.filter(a => a.type === 'credit' || a.type === 'loan').length} accounts
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={totals.monthlyIncome - totals.monthlyExpenses >= 0 ? 'border-success/20' : 'border-destructive/20'}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Month-to-Date Net
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                totals.monthlyIncome - totals.monthlyExpenses >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                {totals.monthlyIncome - totals.monthlyExpenses >= 0 ? '+' : ''}
                {formatCurrency(totals.monthlyIncome - totals.monthlyExpenses)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                All entities combined
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Entity Detail Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Financial Position by Entity</CardTitle>
            <CardDescription>Detailed breakdown of assets, liabilities, and cash flow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Entity</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Assets</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Liabilities</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Net Worth</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">MTD Income</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">MTD Expenses</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">MTD Net</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">YTD Net</th>
                  </tr>
                </thead>
                <tbody>
                  {entityData.map((entity, index) => {
                    const mtdNet = entity.monthlyIncome - entity.monthlyExpenses
                    const ytdNet = entity.ytdIncome - entity.ytdExpenses
                    return (
                      <tr key={entity.id || 'personal'} className="border-b border-border/50 hover:bg-accent/30">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${ENTITY_COLORS[index]}20` }}
                            >
                              {entity.type === 'personal' ? (
                                <User className="w-4 h-4" style={{ color: ENTITY_COLORS[index] }} />
                              ) : (
                                <Building2 className="w-4 h-4" style={{ color: ENTITY_COLORS[index] }} />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{entity.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {entity.accountCount} accounts • {entity.transactionCount} transactions
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-4 px-4 font-medium">
                          {formatCurrency(entity.assets)}
                        </td>
                        <td className="text-right py-4 px-4 text-destructive">
                          {entity.liabilities > 0 ? formatCurrency(entity.liabilities) : '—'}
                        </td>
                        <td className="text-right py-4 px-4">
                          <span className={`font-semibold ${entity.netWorth >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatCurrency(entity.netWorth)}
                          </span>
                        </td>
                        <td className="text-right py-4 px-4 text-success">
                          +{formatCurrency(entity.monthlyIncome)}
                        </td>
                        <td className="text-right py-4 px-4 text-destructive">
                          -{formatCurrency(entity.monthlyExpenses)}
                        </td>
                        <td className="text-right py-4 px-4">
                          <span className={`font-semibold ${mtdNet >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {mtdNet >= 0 ? '+' : ''}{formatCurrency(mtdNet)}
                          </span>
                        </td>
                        <td className="text-right py-4 px-4">
                          <span className={ytdNet >= 0 ? 'text-success' : 'text-destructive'}>
                            {ytdNet >= 0 ? '+' : ''}{formatCurrency(ytdNet)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td className="py-4 px-4 font-bold">TOTAL</td>
                    <td className="text-right py-4 px-4 font-bold">{formatCurrency(totals.assets)}</td>
                    <td className="text-right py-4 px-4 font-bold text-destructive">
                      {totals.liabilities > 0 ? formatCurrency(totals.liabilities) : '—'}
                    </td>
                    <td className="text-right py-4 px-4">
                      <span className={`font-bold ${totals.netWorth >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(totals.netWorth)}
                      </span>
                    </td>
                    <td className="text-right py-4 px-4 font-bold text-success">
                      +{formatCurrency(totals.monthlyIncome)}
                    </td>
                    <td className="text-right py-4 px-4 font-bold text-destructive">
                      -{formatCurrency(totals.monthlyExpenses)}
                    </td>
                    <td className="text-right py-4 px-4">
                      <span className={`font-bold ${
                        totals.monthlyIncome - totals.monthlyExpenses >= 0 ? 'text-success' : 'text-destructive'
                      }`}>
                        {totals.monthlyIncome - totals.monthlyExpenses >= 0 ? '+' : ''}
                        {formatCurrency(totals.monthlyIncome - totals.monthlyExpenses)}
                      </span>
                    </td>
                    <td className="text-right py-4 px-4">
                      <span className={`font-bold ${
                        totals.ytdIncome - totals.ytdExpenses >= 0 ? 'text-success' : 'text-destructive'
                      }`}>
                        {totals.ytdIncome - totals.ytdExpenses >= 0 ? '+' : ''}
                        {formatCurrency(totals.ytdIncome - totals.ytdExpenses)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Worth Distribution */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Net Worth Distribution
              </CardTitle>
              <CardDescription>How your wealth is distributed across entities</CardDescription>
            </CardHeader>
            <CardContent>
              {netWorthDistribution.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No positive net worth to display
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={netWorthDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {netWorthDistribution.map((entry, index) => (
                          <Cell key={entry.name} fill={entry.color} />
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
        </motion.div>

        {/* Monthly Income/Expense by Entity */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Monthly Cash Flow by Entity
              </CardTitle>
              <CardDescription>This month's income and expenses per entity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                      type="number"
                      stroke="#71717a"
                      fontSize={12}
                      tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`}
                    />
                    <YAxis 
                      dataKey="name"
                      type="category"
                      stroke="#71717a"
                      fontSize={12}
                      width={100}
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
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Spending Analysis by Entity */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Spending by Category</CardTitle>
                <CardDescription>Where money is going this month</CardDescription>
              </div>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="personal">Personal Only</SelectItem>
                  {businesses.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {spendingByCategory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No spending data for this period
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {spendingByCategory.map((item, index) => {
                    const total = spendingByCategory.reduce((sum, i) => sum + i.value, 0)
                    const percentage = total > 0 ? (item.value / total) * 100 : 0
                    return (
                      <div key={item.name} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(item.value)} ({percentage.toFixed(1)}%)
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
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={spendingByCategory}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                      >
                        {spendingByCategory.map((entry, index) => (
                          <Cell key={entry.name} fill={ENTITY_COLORS[index % ENTITY_COLORS.length]} />
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
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Key Insights */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-primary/5 to-cyan-500/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Wealth Distribution */}
              <div className="p-4 rounded-lg bg-background/50">
                <h4 className="font-medium mb-2">Wealth Distribution</h4>
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const personal = entityData.find(e => e.id === null)
                    if (!personal || totals.netWorth <= 0) return 'Add accounts to see distribution.'
                    const personalPercent = Math.round((personal.netWorth / totals.netWorth) * 100)
                    const businessPercent = 100 - personalPercent
                    return `${personalPercent}% personal, ${businessPercent}% business wealth.`
                  })()}
                </p>
              </div>

              {/* Cash Flow Health */}
              <div className="p-4 rounded-lg bg-background/50">
                <h4 className="font-medium mb-2">Cash Flow Health</h4>
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const savingsRate = totals.monthlyIncome > 0 
                      ? Math.round(((totals.monthlyIncome - totals.monthlyExpenses) / totals.monthlyIncome) * 100)
                      : 0
                    if (savingsRate >= 20) return `Great! ${savingsRate}% savings rate this month.`
                    if (savingsRate >= 10) return `Good. ${savingsRate}% savings rate this month.`
                    if (savingsRate >= 0) return `${savingsRate}% savings rate. Aim for 20%+.`
                    return `Spending exceeds income by ${Math.abs(savingsRate)}%.`
                  })()}
                </p>
              </div>

              {/* Business Performance */}
              <div className="p-4 rounded-lg bg-background/50">
                <h4 className="font-medium mb-2">Business Performance</h4>
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const businessEntities = entityData.filter(e => e.id !== null)
                    if (businessEntities.length === 0) return 'No businesses tracked yet.'
                    const profitable = businessEntities.filter(e => e.monthlyIncome > e.monthlyExpenses)
                    return `${profitable.length} of ${businessEntities.length} businesses profitable this month.`
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

