import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Save,
  Building2,
  FolderKanban,
  Tag,
  FileText,
  Receipt,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

// Common tax categories for business expenses
const TAX_CATEGORIES = [
  { value: 'advertising', label: 'Advertising & Marketing' },
  { value: 'bank_fees', label: 'Bank Fees' },
  { value: 'car_truck', label: 'Car & Truck Expenses' },
  { value: 'commissions', label: 'Commissions & Fees' },
  { value: 'contract_labor', label: 'Contract Labor' },
  { value: 'depreciation', label: 'Depreciation' },
  { value: 'dues_subscriptions', label: 'Dues & Subscriptions' },
  { value: 'education', label: 'Education & Training' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'home_office', label: 'Home Office' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'interest', label: 'Interest Expense' },
  { value: 'legal_professional', label: 'Legal & Professional Services' },
  { value: 'meals', label: 'Meals & Entertainment' },
  { value: 'office_supplies', label: 'Office Supplies' },
  { value: 'rent', label: 'Rent or Lease' },
  { value: 'repairs', label: 'Repairs & Maintenance' },
  { value: 'software', label: 'Software & Tech' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'taxes_licenses', label: 'Taxes & Licenses' },
  { value: 'telephone', label: 'Telephone & Internet' },
  { value: 'travel', label: 'Travel' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'wages', label: 'Wages & Payroll' },
  { value: 'other', label: 'Other Expense' },
]

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuthStore()
  const {
    transactions,
    accounts,
    categories,
    businesses,
    projects,
    updateTransaction,
    fetchProjects,
    fetchBusinesses,
    fetchCategories,
  } = useFinancialStore()

  // Find the transaction
  const transaction = transactions.find((t) => t.id === id)

  // Form state
  const [notes, setNotes] = useState(transaction?.notes || '')
  const [categoryId, setCategoryId] = useState(transaction?.category_id || '')
  const [projectId, setProjectId] = useState(transaction?.project_id || '')
  const [businessId, setBusinessId] = useState(transaction?.business_id || '')
  const [taxCategory, setTaxCategory] = useState(transaction?.tax_category || '')
  const [isBusinessExpense, setIsBusinessExpense] = useState(transaction?.is_business_expense || false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch related data
  useEffect(() => {
    if (user) {
      fetchProjects(user.id)
      fetchBusinesses(user.id)
      fetchCategories(user.id)
    }
  }, [user, fetchProjects, fetchBusinesses, fetchCategories])

  // Update form when transaction changes
  useEffect(() => {
    if (transaction) {
      setNotes(transaction.notes || '')
      setCategoryId(transaction.category_id || '')
      setProjectId(transaction.project_id || '')
      setBusinessId(transaction.business_id || '')
      setTaxCategory(transaction.tax_category || '')
      setIsBusinessExpense(transaction.is_business_expense || false)
    }
  }, [transaction])

  // Track changes
  useEffect(() => {
    if (transaction) {
      const changed =
        notes !== (transaction.notes || '') ||
        categoryId !== (transaction.category_id || '') ||
        projectId !== (transaction.project_id || '') ||
        businessId !== (transaction.business_id || '') ||
        taxCategory !== (transaction.tax_category || '') ||
        isBusinessExpense !== (transaction.is_business_expense || false)
      setHasChanges(changed)
    }
  }, [notes, categoryId, projectId, businessId, taxCategory, isBusinessExpense, transaction])

  const handleSave = async () => {
    if (!transaction) return

    setIsSaving(true)
    try {
      await updateTransaction(transaction.id, {
        notes: notes || null,
        category_id: categoryId || null,
        project_id: projectId || null,
        business_id: businessId || null,
        tax_category: taxCategory || null,
        is_business_expense: isBusinessExpense,
      })

      toast({
        title: 'Transaction updated',
        description: 'Your changes have been saved.',
      })
      setHasChanges(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save changes.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!transaction) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Transaction not found</h2>
          <p className="text-muted-foreground mb-4">
            This transaction may have been deleted or doesn't exist.
          </p>
          <Button onClick={() => navigate('/transactions')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Transactions
          </Button>
        </div>
      </div>
    )
  }

  const account = accounts.find((a) => a.id === transaction.account_id)
  const category = categories.find((c) => c.id === transaction.category_id)
  const business = businesses.find((b) => b.id === transaction.business_id)
  const project = projects.find((p) => p.id === transaction.project_id)

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
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/transactions')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Transaction Details</h1>
            <p className="text-muted-foreground">
              Edit and categorize this transaction
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Transaction Summary Card */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          <div
            className={`h-2 ${
              transaction.amount > 0
                ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                : 'bg-gradient-to-r from-slate-500 to-slate-400'
            }`}
          />
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    transaction.amount > 0
                      ? 'bg-success/10 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {transaction.amount > 0 ? (
                    <ArrowDownRight className="w-7 h-7" />
                  ) : (
                    <ArrowUpRight className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {transaction.merchant_name || transaction.name}
                  </h2>
                  {transaction.merchant_name && transaction.merchant_name !== transaction.name && (
                    <p className="text-sm text-muted-foreground">{transaction.name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {transaction.pending && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                    {transaction.check_number && (
                      <Badge variant="secondary" className="text-xs">
                        Check #{transaction.check_number}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-3xl font-bold ${
                    transaction.amount > 0 ? 'text-success' : ''
                  }`}
                >
                  {transaction.amount > 0 ? '+' : ''}
                  {formatCurrency(transaction.amount)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {transaction.amount > 0 ? 'Income' : 'Expense'}
                </p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Transaction Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(transaction.date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Account</p>
                  <p className="font-medium">{account?.name || 'Unknown'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Tag className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium">{category?.name || 'Uncategorized'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  {transaction.pending ? (
                    <Clock className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium">{transaction.pending ? 'Pending' : 'Cleared'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notes */}
        <motion.div variants={itemVariants} className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Notes
              </CardTitle>
              <CardDescription>
                Add personal notes or memos about this transaction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes about this transaction..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Category */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tag className="w-5 h-5" />
                Category
              </CardTitle>
              <CardDescription>Assign a spending category</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={categoryId || '_none'} onValueChange={(v) => setCategoryId(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No Category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </motion.div>

        {/* Project */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderKanban className="w-5 h-5" />
                Project
              </CardTitle>
              <CardDescription>Assign to a project for tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={projectId || '_none'} onValueChange={(v) => setProjectId(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No Project</SelectItem>
                  {projects
                    .filter((p) => p.is_active)
                    .map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: proj.color }}
                          />
                          {proj.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </motion.div>

        {/* Business */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5" />
                Business / Entity
              </CardTitle>
              <CardDescription>Assign to a business entity</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={businessId || '_none'} onValueChange={(v) => setBusinessId(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No Business</SelectItem>
                  {businesses.map((biz) => (
                    <SelectItem key={biz.id} value={biz.id}>
                      {biz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tax Category */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="w-5 h-5" />
                Tax Category
              </CardTitle>
              <CardDescription>For tax reporting purposes</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={taxCategory || '_none'} onValueChange={(v) => setTaxCategory(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tax category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No Tax Category</SelectItem>
                  {TAX_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </motion.div>

        {/* Business Expense Toggle */}
        <motion.div variants={itemVariants} className="md:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <Label htmlFor="business-expense" className="text-base font-semibold">
                      Business Expense
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Mark this transaction as a deductible business expense
                    </p>
                  </div>
                </div>
                <Switch
                  id="business-expense"
                  checked={isBusinessExpense}
                  onCheckedChange={setIsBusinessExpense}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Save Indicator */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <Card className="shadow-lg border-primary/20">
            <CardContent className="py-3 px-4 flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-medium">You have unsaved changes</span>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Now'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}

