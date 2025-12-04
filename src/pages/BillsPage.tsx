import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus, 
  Receipt, 
  Calendar, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Pencil,
  Trash2,
  Bell,
  CreditCard,
  Sparkles,
  Loader2,
  Check,
  X,
  RefreshCcw,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { detectSubscriptions, type DetectedSubscription } from '@/lib/openai'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import type { Bill, RecurringTransaction } from '@/types/database'

export default function BillsPage() {
  const { user } = useAuthStore()
  const { 
    bills, 
    recurringTransactions, 
    transactions,
    accounts,
    categories,
    addBill,
    updateBill,
    addRecurringTransaction,
    isLoadingBills,
  } = useFinancialStore()
  const { toast } = useToast()
  
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDetectDialog, setShowDetectDialog] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectedSubscriptions, setDetectedSubscriptions] = useState<DetectedSubscription[]>([])
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<number>>(new Set())
  const [detectionSummary, setDetectionSummary] = useState('')
  const [activeTab, setActiveTab] = useState('bills')
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    due_date: '',
    due_day_of_month: '',
    frequency: 'monthly' as Bill['frequency'],
    is_autopay: false,
    reminder_days_before: '3',
    account_id: '',
    category_id: '',
  })

  const handleAddBill = async () => {
    if (!user) return
    
    const bill = await addBill({
      user_id: user.id,
      name: formData.name,
      amount: parseFloat(formData.amount) || 0,
      due_date: formData.due_date,
      due_day_of_month: parseInt(formData.due_day_of_month) || null,
      frequency: formData.frequency,
      is_autopay: formData.is_autopay,
      reminder_days_before: parseInt(formData.reminder_days_before) || 3,
      account_id: formData.account_id || null,
      category_id: formData.category_id || null,
      status: 'pending',
    })

    if (bill) {
      toast({
        title: 'Bill added',
        description: `${formData.name} has been added to your bills.`,
        variant: 'success',
      })
      setShowAddDialog(false)
      resetForm()
    }
  }

  const handleMarkPaid = async (bill: Bill) => {
    await updateBill(bill.id, {
      status: 'paid',
      last_paid_date: new Date().toISOString(),
    })
    toast({
      title: 'Bill marked as paid',
      description: `${bill.name} has been marked as paid.`,
      variant: 'success',
    })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      amount: '',
      due_date: '',
      due_day_of_month: '',
      frequency: 'monthly',
      is_autopay: false,
      reminder_days_before: '3',
      account_id: '',
      category_id: '',
    })
  }

  const handleDetectSubscriptions = async () => {
    if (!user || transactions.length === 0) {
      toast({
        title: 'No transactions',
        description: 'Import some transactions first to detect subscriptions.',
        variant: 'destructive',
      })
      return
    }

    setIsDetecting(true)
    setShowDetectDialog(true)
    setDetectedSubscriptions([])
    setSelectedSubscriptions(new Set())
    
    try {
      const result = await detectSubscriptions(
        transactions.map(t => ({
          id: t.id,
          merchant_name: t.merchant_name,
          name: t.name,
          amount: t.amount,
          date: t.date,
        }))
      )
      
      setDetectedSubscriptions(result.subscriptions)
      setDetectionSummary(result.summary)
      
      // Pre-select all detected subscriptions
      setSelectedSubscriptions(new Set(result.subscriptions.map((_, i) => i)))
      
      if (result.subscriptions.length === 0) {
        toast({
          title: 'No subscriptions found',
          description: 'We couldn\'t detect any recurring subscriptions in your transactions.',
        })
      }
    } catch (error) {
      console.error('Error detecting subscriptions:', error)
      toast({
        title: 'Detection failed',
        description: error instanceof Error ? error.message : 'Could not analyze transactions.',
        variant: 'destructive',
      })
    } finally {
      setIsDetecting(false)
    }
  }

  const toggleSubscriptionSelection = (index: number) => {
    const newSelected = new Set(selectedSubscriptions)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedSubscriptions(newSelected)
  }

  const handleAddSelectedSubscriptions = async () => {
    if (!user) return
    
    const toAdd = detectedSubscriptions.filter((_, i) => selectedSubscriptions.has(i))
    let addedCount = 0
    
    for (const sub of toAdd) {
      // Check if already exists
      const exists = recurringTransactions.some(
        r => r.name.toLowerCase() === sub.merchant_name.toLowerCase() ||
             r.merchant_name?.toLowerCase() === sub.merchant_name.toLowerCase()
      )
      
      if (!exists) {
        const result = await addRecurringTransaction({
          user_id: user.id,
          account_id: accounts[0]?.id || '', // Use first account as default
          name: sub.merchant_name,
          merchant_name: sub.merchant_name,
          amount: sub.amount,
          frequency: sub.frequency,
          last_date: sub.last_date,
          is_subscription: true,
          is_bill: sub.is_essential,
          is_income: false,
          is_active: true,
          notes: sub.notes || `Detected by AI (${Math.round(sub.confidence * 100)}% confidence)`,
        })
        
        if (result) addedCount++
      }
    }
    
    toast({
      title: 'Subscriptions added',
      description: `Added ${addedCount} subscription${addedCount !== 1 ? 's' : ''} to your tracking.`,
      variant: 'success',
    })
    
    setShowDetectDialog(false)
    setDetectedSubscriptions([])
    setSelectedSubscriptions(new Set())
  }

  // Calculate statistics
  const totalMonthlyBills = bills
    .filter(b => b.frequency === 'monthly')
    .reduce((sum, b) => sum + b.amount, 0)

  const upcomingBills = bills.filter(b => {
    const dueDate = new Date(b.due_date)
    const now = new Date()
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    return dueDate >= now && dueDate <= twoWeeksFromNow && b.status !== 'paid'
  })

  const overdueBills = bills.filter(b => {
    const dueDate = new Date(b.due_date)
    return dueDate < new Date() && b.status !== 'paid'
  })

  const subscriptions = recurringTransactions.filter(r => r.is_subscription)
  const totalSubscriptions = subscriptions.reduce((sum, s) => sum + s.amount, 0)

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
          <h1 className="font-display text-3xl font-bold">Bills & Subscriptions</h1>
          <p className="text-muted-foreground">Track your recurring payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDetectSubscriptions} disabled={isDetecting}>
            {isDetecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {isDetecting ? 'Detecting...' : 'Detect Subscriptions'}
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Bill
          </Button>
        </div>
      </div>

      {/* Overdue Alert */}
      {overdueBills.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive">
                    {overdueBills.length} Overdue Bill{overdueBills.length !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Total overdue: {formatCurrency(overdueBills.reduce((sum, b) => sum + b.amount, 0))}
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Review Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Monthly Bills</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalMonthlyBills)}</div>
              <div className="text-sm text-muted-foreground">
                {bills.filter(b => b.frequency === 'monthly').length} bills
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalSubscriptions)}</div>
              <div className="text-sm text-muted-foreground">
                {subscriptions.length} active
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={upcomingBills.length > 0 ? 'border-warning/50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription>Due Soon</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {upcomingBills.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Next 2 weeks
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={overdueBills.length > 0 ? 'border-destructive/50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription>Overdue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {overdueBills.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Needs attention
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs for Bills and Subscriptions */}
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="bills">
              <Receipt className="w-4 h-4 mr-2" />
              Bills
            </TabsTrigger>
            <TabsTrigger value="subscriptions">
              <CreditCard className="w-4 h-4 mr-2" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Bills</CardTitle>
                <CardDescription>
                  {bills.length} bill{bills.length !== 1 ? 's' : ''} tracked
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingBills ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : bills.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No bills tracked yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Add your recurring bills to get reminders and track payments.
                    </p>
                    <Button onClick={() => setShowAddDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Bill
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bills.map((bill) => {
                      const dueDate = new Date(bill.due_date)
                      const isOverdue = dueDate < new Date() && bill.status !== 'paid'
                      const isDueSoon = !isOverdue && dueDate < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      
                      return (
                        <div 
                          key={bill.id}
                          className={`flex items-center justify-between p-4 rounded-lg border ${
                            isOverdue ? 'border-destructive/50 bg-destructive/5' :
                            isDueSoon ? 'border-warning/50 bg-warning/5' :
                            'border-border bg-background/50'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              bill.status === 'paid' ? 'bg-success/10 text-success' :
                              isOverdue ? 'bg-destructive/10 text-destructive' :
                              'bg-secondary text-muted-foreground'
                            }`}>
                              {bill.status === 'paid' ? (
                                <CheckCircle2 className="w-6 h-6" />
                              ) : isOverdue ? (
                                <AlertTriangle className="w-6 h-6" />
                              ) : (
                                <Receipt className="w-6 h-6" />
                              )}
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{bill.name}</span>
                                {bill.is_autopay && (
                                  <Badge variant="outline" className="text-xs">Autopay</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Due {formatDate(bill.due_date)}</span>
                                <span>•</span>
                                <span className="capitalize">{bill.frequency}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-lg font-semibold">
                                {formatCurrency(bill.amount)}
                              </div>
                              <Badge variant={
                                bill.status === 'paid' ? 'success' :
                                isOverdue ? 'destructive' : 'warning'
                              }>
                                {bill.status === 'paid' ? 'Paid' :
                                 isOverdue ? 'Overdue' : 'Pending'}
                              </Badge>
                            </div>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {bill.status !== 'paid' && (
                                  <DropdownMenuItem onClick={() => handleMarkPaid(bill)}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Mark as Paid
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem>
                                  <Bell className="w-4 h-4 mr-2" />
                                  Set Reminder
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
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
          </TabsContent>

          <TabsContent value="subscriptions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Subscriptions</CardTitle>
                <CardDescription>
                  Detected recurring charges from your transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {subscriptions.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No subscriptions tracked yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Use AI to automatically detect subscriptions from your transactions.
                    </p>
                    <Button onClick={handleDetectSubscriptions} disabled={isDetecting}>
                      {isDetecting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {isDetecting ? 'Detecting...' : 'Detect Subscriptions'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subscriptions.map((sub) => (
                      <div 
                        key={sub.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-background/50 group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-muted-foreground" />
                          </div>
                          
                          <div>
                            <div className="font-semibold">{sub.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {sub.merchant_name || 'Unknown merchant'} • {sub.frequency}
                            </div>
                            {sub.notes && (
                              <div className="text-xs text-muted-foreground mt-1">{sub.notes}</div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-semibold">
                              {formatCurrency(sub.amount)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              /{sub.frequency === 'yearly' ? 'yr' : sub.frequency === 'quarterly' ? 'qtr' : 'mo'}
                            </div>
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
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={async () => {
                                  const { deleteRecurringTransaction } = useFinancialStore.getState()
                                  await deleteRecurringTransaction(sub.id)
                                  toast({
                                    title: 'Subscription removed',
                                    description: `${sub.name} has been removed from tracking.`,
                                  })
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Bill Calendar</CardTitle>
                <CardDescription>
                  Visual overview of upcoming payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Calendar view coming soon...
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Add Bill Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Bill</DialogTitle>
            <DialogDescription>
              Track a recurring bill to get payment reminders.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Bill Name</Label>
              <Input
                id="name"
                placeholder="e.g., Electric Bill, Rent"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value: Bill['frequency']) => 
                    setFormData(prev => ({ ...prev, frequency: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Next Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="due_day">Day of Month (Optional)</Label>
                <Input
                  id="due_day"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="e.g., 15"
                  value={formData.due_day_of_month}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_day_of_month: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="autopay">Autopay Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  This bill is set up for automatic payment
                </p>
              </div>
              <Switch
                id="autopay"
                checked={formData.is_autopay}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, is_autopay: checked }))
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reminder">Remind Me</Label>
              <Select
                value={formData.reminder_days_before}
                onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, reminder_days_before: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day before</SelectItem>
                  <SelectItem value="3">3 days before</SelectItem>
                  <SelectItem value="7">1 week before</SelectItem>
                  <SelectItem value="14">2 weeks before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddBill} 
              disabled={!formData.name || !formData.amount || !formData.due_date}
            >
              Add Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detect Subscriptions Dialog */}
      <Dialog open={showDetectDialog} onOpenChange={setShowDetectDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Subscription Detection
            </DialogTitle>
            <DialogDescription>
              {isDetecting 
                ? 'Analyzing your transactions for recurring subscriptions...'
                : detectionSummary || 'Review detected subscriptions and select which ones to track.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {isDetecting ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Scanning {transactions.length} transactions...</p>
              </div>
            ) : detectedSubscriptions.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No subscriptions detected</h3>
                <p className="text-muted-foreground">
                  We couldn't find recurring subscription patterns in your transactions.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2 text-sm text-muted-foreground">
                  <span>{selectedSubscriptions.size} of {detectedSubscriptions.length} selected</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedSubscriptions.size === detectedSubscriptions.length) {
                        setSelectedSubscriptions(new Set())
                      } else {
                        setSelectedSubscriptions(new Set(detectedSubscriptions.map((_, i) => i)))
                      }
                    }}
                  >
                    {selectedSubscriptions.size === detectedSubscriptions.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                
                {detectedSubscriptions.map((sub, index) => {
                  const isSelected = selectedSubscriptions.has(index)
                  const alreadyTracked = recurringTransactions.some(
                    r => r.name.toLowerCase() === sub.merchant_name.toLowerCase() ||
                         r.merchant_name?.toLowerCase() === sub.merchant_name.toLowerCase()
                  )
                  
                  return (
                    <div
                      key={index}
                      onClick={() => !alreadyTracked && toggleSubscriptionSelection(index)}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                        alreadyTracked
                          ? 'border-border bg-muted/50 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'border-primary bg-primary/5 cursor-pointer'
                          : 'border-border bg-background/50 cursor-pointer hover:bg-accent/50'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        alreadyTracked
                          ? 'border-muted-foreground bg-muted'
                          : isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground'
                      }`}>
                        {alreadyTracked ? (
                          <Check className="w-4 h-4" />
                        ) : isSelected ? (
                          <Check className="w-4 h-4" />
                        ) : null}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{sub.merchant_name}</span>
                          {alreadyTracked && (
                            <Badge variant="secondary" className="text-xs">Already tracked</Badge>
                          )}
                          {sub.is_essential && !alreadyTracked && (
                            <Badge variant="outline" className="text-xs">Essential</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{sub.frequency}</span>
                          {sub.category && (
                            <>
                              <span>•</span>
                              <span>{sub.category}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{sub.transaction_count} occurrences</span>
                          <span>•</span>
                          <span>{Math.round(sub.confidence * 100)}% confidence</span>
                        </div>
                        {sub.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{sub.notes}</p>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-semibold">
                          {formatCurrency(sub.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          /{sub.frequency === 'yearly' ? 'yr' : sub.frequency === 'quarterly' ? 'qtr' : 'mo'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowDetectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSelectedSubscriptions}
              disabled={selectedSubscriptions.size === 0 || isDetecting}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add {selectedSubscriptions.size} Subscription{selectedSubscriptions.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}




