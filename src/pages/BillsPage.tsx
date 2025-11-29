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
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
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
    accounts,
    categories,
    addBill,
    updateBill,
    isLoadingBills,
  } = useFinancialStore()
  const { toast } = useToast()
  
  const [showAddDialog, setShowAddDialog] = useState(false)
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
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Bill
        </Button>
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
                    <h3 className="font-semibold mb-2">No subscriptions detected</h3>
                    <p className="text-muted-foreground">
                      We'll automatically detect subscriptions from your transaction history.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subscriptions.map((sub) => (
                      <div 
                        key={sub.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-background/50"
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
                          </div>
                        </div>
                        
                        <div className="text-lg font-semibold">
                          {formatCurrency(sub.amount)}/mo
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
    </motion.div>
  )
}


