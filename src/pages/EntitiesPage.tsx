import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2,
  User,
  Plus,
  TrendingUp,
  TrendingDown,
  CreditCard,
  DollarSign,
  PiggyBank,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  ArrowRight,
  RefreshCcw,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ExternalLink,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Business, Account, Transaction, RecurringTransaction } from '@/types/database'

const ENTITY_TYPES = [
  { value: 'personal', label: 'Personal', icon: User, color: 'bg-blue-500' },
  { value: 'business', label: 'Business', icon: Building2, color: 'bg-emerald-500' },
  { value: 'side_hustle', label: 'Side Hustle', icon: TrendingUp, color: 'bg-purple-500' },
  { value: 'rental', label: 'Rental Property', icon: Building2, color: 'bg-orange-500' },
  { value: 'investment', label: 'Investment', icon: PiggyBank, color: 'bg-cyan-500' },
]

const ENTITY_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6366f1', label: 'Indigo' },
]

interface EntitySummary {
  entity: Business | null // null = Personal
  accounts: Account[]
  totalBalance: number
  monthlyIncome: number
  monthlyExpenses: number
  subscriptions: RecurringTransaction[]
  recentTransactions: Transaction[]
}

export default function EntitiesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    businesses,
    accounts,
    transactions,
    recurringTransactions,
    fetchBusinesses,
    addBusiness,
  } = useFinancialStore()
  const { toast } = useToast()

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<Business | null | 'all'>('all')
  const [viewingEntityTransactions, setViewingEntityTransactions] = useState<Business | null | 'personal' | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'business',
    color: '#3b82f6',
    taxId: '',
  })

  // Get transactions for the entity being viewed
  const entityTransactions = useMemo(() => {
    if (viewingEntityTransactions === null) return []
    if (viewingEntityTransactions === 'personal') {
      return transactions.filter(t => !t.business_id).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    }
    return transactions.filter(t => t.business_id === viewingEntityTransactions.id).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [transactions, viewingEntityTransactions])

  // Calculate stats for the entity being viewed
  const entityStats = useMemo(() => {
    const income = entityTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
    const expenses = entityTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    return { income, expenses, net: income - expenses }
  }, [entityTransactions])

  // Compute entity summaries
  const entitySummaries = useMemo((): EntitySummary[] => {
    const summaries: EntitySummary[] = []
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Personal entity (null business_id)
    const personalAccounts = accounts.filter(a => !a.business_id)
    const personalTransactions = transactions.filter(t => !t.business_id)
    const personalRecurring = recurringTransactions.filter(r => {
      const account = accounts.find(a => a.id === r.account_id)
      return !account?.business_id
    })

    const personalMonthlyTxns = personalTransactions.filter(t => new Date(t.date) >= startOfMonth)

    summaries.push({
      entity: null,
      accounts: personalAccounts,
      totalBalance: personalAccounts.reduce((sum, a) => {
        if (a.type === 'credit' || a.type === 'loan') return sum - a.current_balance
        return sum + a.current_balance
      }, 0),
      monthlyIncome: personalMonthlyTxns
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0),
      monthlyExpenses: personalMonthlyTxns
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      subscriptions: personalRecurring.filter(r => r.is_subscription),
      recentTransactions: personalTransactions.slice(0, 5),
    })

    // Business entities
    for (const business of businesses) {
      const bizAccounts = accounts.filter(a => a.business_id === business.id)
      const bizTransactions = transactions.filter(t => t.business_id === business.id)
      const bizRecurring = recurringTransactions.filter(r => {
        const account = accounts.find(a => a.id === r.account_id)
        return account?.business_id === business.id
      })

      const bizMonthlyTxns = bizTransactions.filter(t => new Date(t.date) >= startOfMonth)

      summaries.push({
        entity: business,
        accounts: bizAccounts,
        totalBalance: bizAccounts.reduce((sum, a) => {
          if (a.type === 'credit' || a.type === 'loan') return sum - a.current_balance
          return sum + a.current_balance
        }, 0),
        monthlyIncome: bizMonthlyTxns
          .filter(t => t.amount > 0)
          .reduce((sum, t) => sum + t.amount, 0),
        monthlyExpenses: bizMonthlyTxns
          .filter(t => t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0),
        subscriptions: bizRecurring.filter(r => r.is_subscription),
        recentTransactions: bizTransactions.slice(0, 5),
      })
    }

    return summaries
  }, [accounts, businesses, transactions, recurringTransactions])

  // Total across all entities
  const totals = useMemo(() => {
    return entitySummaries.reduce(
      (acc, s) => ({
        balance: acc.balance + s.totalBalance,
        income: acc.income + s.monthlyIncome,
        expenses: acc.expenses + s.monthlyExpenses,
        accounts: acc.accounts + s.accounts.length,
        subscriptions: acc.subscriptions + s.subscriptions.length,
      }),
      { balance: 0, income: 0, expenses: 0, accounts: 0, subscriptions: 0 }
    )
  }, [entitySummaries])

  // Handle add entity
  const handleAddEntity = async () => {
    if (!user || !formData.name) return

    const business = await addBusiness({
      user_id: user.id,
      name: formData.name,
      type: formData.type,
      tax_id: formData.taxId || null,
    })

    if (business) {
      toast({
        title: 'Entity created',
        description: `${formData.name} has been added.`,
      })
      setShowAddDialog(false)
      setFormData({ name: '', type: 'business', color: '#3b82f6', taxId: '' })
    }
  }

  // Get entity type info
  const getEntityType = (type: string | null | undefined) => {
    return ENTITY_TYPES.find(t => t.value === type) || ENTITY_TYPES[1]
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
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
          <h1 className="font-display text-3xl font-bold">Financial Entities</h1>
          <p className="text-muted-foreground">
            Manage Personal, Business, and other financial entities
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Entity
        </Button>
      </div>

      {/* Overall Summary */}
      <motion.div variants={itemVariants}>
        <Card className="glass border-primary/20">
          <CardContent className="py-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Net Worth</p>
                <p className="text-2xl font-bold text-gradient">
                  {formatCurrency(totals.balance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Monthly Income</p>
                <p className="text-2xl font-bold text-emerald-500">
                  +{formatCurrency(totals.income)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Monthly Expenses</p>
                <p className="text-2xl font-bold text-destructive">
                  -{formatCurrency(totals.expenses)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Accounts</p>
                <p className="text-2xl font-bold">{totals.accounts}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Subscriptions</p>
                <p className="text-2xl font-bold">{totals.subscriptions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Entity Filter */}
      <motion.div variants={itemVariants} className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={selectedEntity === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedEntity('all')}
        >
          All Entities
        </Button>
        <Button
          variant={selectedEntity === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedEntity(null)}
          className="flex items-center gap-2"
        >
          <User className="w-4 h-4" />
          Personal
        </Button>
        {businesses.map(biz => {
          const typeInfo = getEntityType(biz.type)
          return (
            <Button
              key={biz.id}
              variant={selectedEntity === biz ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEntity(biz)}
              className="flex items-center gap-2"
            >
              <typeInfo.icon className="w-4 h-4" />
              {biz.name}
            </Button>
          )
        })}
      </motion.div>

      {/* Entity Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {entitySummaries
          .filter(s =>
            selectedEntity === 'all' ||
            (selectedEntity === null && s.entity === null) ||
            (selectedEntity && s.entity?.id === selectedEntity.id)
          )
          .map((summary, idx) => {
            const typeInfo = getEntityType(summary.entity?.type || 'personal')
            const Icon = typeInfo.icon
            const monthlyNet = summary.monthlyIncome - summary.monthlyExpenses

            return (
              <motion.div key={summary.entity?.id || 'personal'} variants={itemVariants}>
                <Card 
                  className="h-full cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setViewingEntityTransactions(summary.entity || 'personal')}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeInfo.color}`}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">
                            {summary.entity?.name || 'Personal'}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {typeInfo.label}
                            </Badge>
                            <span>{summary.accounts.length} accounts</span>
                          </CardDescription>
                        </div>
                      </div>

                      {summary.entity && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Balance */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10">
                      <div>
                        <p className="text-sm text-muted-foreground">Net Balance</p>
                        <p className="text-3xl font-bold">
                          {formatCurrency(summary.totalBalance)}
                        </p>
                      </div>
                      <DollarSign className="w-10 h-10 text-primary/50" />
                    </div>

                    {/* Monthly Summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-emerald-500/10">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm text-muted-foreground">Income</span>
                        </div>
                        <p className="text-xl font-bold text-emerald-500">
                          +{formatCurrency(summary.monthlyIncome)}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingDown className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-muted-foreground">Expenses</span>
                        </div>
                        <p className="text-xl font-bold text-red-500">
                          -{formatCurrency(summary.monthlyExpenses)}
                        </p>
                      </div>
                    </div>

                    {/* Monthly Net Bar */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Monthly Net</span>
                        <span className={monthlyNet >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                          {monthlyNet >= 0 ? '+' : ''}
                          {formatCurrency(monthlyNet)}
                        </span>
                      </div>
                      <Progress
                        value={
                          summary.monthlyIncome + summary.monthlyExpenses > 0
                            ? (summary.monthlyIncome /
                                (summary.monthlyIncome + summary.monthlyExpenses)) *
                              100
                            : 50
                        }
                        className="h-2"
                      />
                    </div>

                    {/* Subscriptions */}
                    {summary.subscriptions.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium flex items-center gap-2">
                            <RefreshCcw className="w-4 h-4" />
                            Subscriptions
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(
                              summary.subscriptions.reduce((sum, s) => sum + Math.abs(s.amount), 0)
                            )}
                            /mo
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {summary.subscriptions.slice(0, 5).map(sub => (
                            <Badge key={sub.id} variant="secondary" className="text-xs">
                              {sub.name}
                            </Badge>
                          ))}
                          {summary.subscriptions.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{summary.subscriptions.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Accounts List */}
                    {summary.accounts.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Accounts
                        </p>
                        <div className="space-y-2">
                          {summary.accounts.slice(0, 3).map(acc => (
                            <div
                              key={acc.id}
                              className="flex items-center justify-between p-2 rounded bg-muted/30"
                            >
                              <span className="text-sm truncate">{acc.name}</span>
                              <span
                                className={`text-sm font-medium ${
                                  acc.type === 'credit' || acc.type === 'loan'
                                    ? 'text-destructive'
                                    : ''
                                }`}
                              >
                                {formatCurrency(acc.current_balance)}
                              </span>
                            </div>
                          ))}
                          {summary.accounts.length > 3 && (
                            <Button variant="ghost" size="sm" className="w-full text-xs">
                              View all {summary.accounts.length} accounts
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recent Transactions */}
                    {summary.recentTransactions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Receipt className="w-4 h-4" />
                          Recent Activity
                        </p>
                        <div className="space-y-1">
                          {summary.recentTransactions.slice(0, 3).map(txn => (
                            <div
                              key={txn.id}
                              className="flex items-center justify-between py-1 text-sm"
                            >
                              <span className="truncate text-muted-foreground">
                                {txn.merchant_name || txn.name}
                              </span>
                              <span
                                className={txn.amount > 0 ? 'text-emerald-500' : ''}
                              >
                                {txn.amount > 0 ? '+' : ''}
                                {formatCurrency(txn.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
      </div>

      {/* Add Entity Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Financial Entity</DialogTitle>
            <DialogDescription>
              Create a new entity to track finances separately (e.g., business, rental property).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Entity Name</Label>
              <Input
                id="name"
                placeholder="e.g., My LLC, Rental Property #1"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Entity Type</Label>
              <Select
                value={formData.type}
                onValueChange={value => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.filter(t => t.value !== 'personal').map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                {ENTITY_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                    className={`w-8 h-8 rounded-full transition-all ${
                      formData.color === color.value
                        ? 'ring-2 ring-offset-2 ring-offset-background'
                        : ''
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID / EIN (Optional)</Label>
              <Input
                id="taxId"
                placeholder="XX-XXXXXXX"
                value={formData.taxId}
                onChange={e => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEntity} disabled={!formData.name}>
              Create Entity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entity Transactions Dialog */}
      <Dialog 
        open={viewingEntityTransactions !== null} 
        onOpenChange={(open) => !open && setViewingEntityTransactions(null)}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {viewingEntityTransactions === 'personal' ? (
                <>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  Personal Transactions
                </>
              ) : viewingEntityTransactions ? (
                <>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    getEntityType(viewingEntityTransactions.type).color
                  }`}>
                    {(() => {
                      const TypeIcon = getEntityType(viewingEntityTransactions.type).icon
                      return <TypeIcon className="w-5 h-5 text-white" />
                    })()}
                  </div>
                  {viewingEntityTransactions.name} Transactions
                </>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {entityTransactions.length} transaction{entityTransactions.length !== 1 ? 's' : ''} found
            </DialogDescription>
          </DialogHeader>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 py-4 border-b">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Income</p>
              <p className="text-xl font-bold text-emerald-500">+{formatCurrency(entityStats.income)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="text-xl font-bold text-red-500">-{formatCurrency(entityStats.expenses)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Net</p>
              <p className={`text-xl font-bold ${entityStats.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {entityStats.net >= 0 ? '+' : ''}{formatCurrency(entityStats.net)}
              </p>
            </div>
          </div>

          {/* Transactions List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {entityTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No transactions for this entity</p>
              </div>
            ) : (
              <div className="space-y-2 py-4">
                {entityTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                    onClick={() => {
                      setViewingEntityTransactions(null)
                      navigate(`/transactions/${txn.id}`)
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        txn.amount > 0 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {txn.amount > 0 
                          ? <ArrowDownRight className="w-4 h-4" />
                          : <ArrowUpRight className="w-4 h-4" />
                        }
                      </div>
                      <div>
                        <p className="font-medium">{txn.merchant_name || txn.name}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(txn.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold ${txn.amount > 0 ? 'text-emerald-500' : ''}`}>
                        {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setViewingEntityTransactions(null)}>
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
