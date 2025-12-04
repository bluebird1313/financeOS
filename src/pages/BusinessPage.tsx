import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus, 
  Building2, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

export default function BusinessPage() {
  const { user } = useAuthStore()
  const { businesses, accounts, transactions, addBusiness } = useFinancialStore()
  const { toast } = useToast()
  
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(
    businesses[0]?.id || null
  )
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    tax_id: '',
  })

  const handleAddBusiness = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to add a business.',
        variant: 'destructive',
      })
      return
    }
    
    const business = await addBusiness({
      user_id: user.id,
      name: formData.name,
      type: formData.type || null,
      tax_id: formData.tax_id || null,
    })

    if (business) {
      toast({
        title: 'Business added',
        description: `${formData.name} has been added successfully.`,
        variant: 'success',
      })
      setShowAddDialog(false)
      setSelectedBusinessId(business.id)
      resetForm()
    } else {
      toast({
        title: 'Failed to add business',
        description: 'There was an error adding the business. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      tax_id: '',
    })
  }

  const selectedBusiness = businesses.find(b => b.id === selectedBusinessId)
  
  // Calculate business metrics
  const businessAccounts = accounts.filter(a => a.business_id === selectedBusinessId)
  const businessTransactions = transactions.filter(t => t.business_id === selectedBusinessId)
  
  const totalIncome = businessTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
  
  const totalExpenses = businessTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  
  const profit = totalIncome - totalExpenses
  const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0

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
          <h1 className="font-display text-3xl font-bold">Business Management</h1>
          <p className="text-muted-foreground">Track your business finances</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Business
        </Button>
      </div>

      {businesses.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No businesses yet</h3>
                <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                  Add your businesses to track income, expenses, and profitability separately from personal finances.
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Business
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Business Selector */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Label className="text-sm text-muted-foreground">Select Business:</Label>
                  <Select
                    value={selectedBusinessId || ''}
                    onValueChange={setSelectedBusinessId}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select a business" />
                    </SelectTrigger>
                    <SelectContent>
                      {businesses.map(business => (
                        <SelectItem key={business.id} value={business.id}>
                          {business.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedBusiness && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit Business
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Business
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {selectedBusiness && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-success" />
                        Revenue
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-success">
                        {formatCurrency(totalIncome)}
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
                        {formatCurrency(totalExpenses)}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Card className={profit >= 0 ? 'border-success/20' : 'border-destructive/20'}>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Net Profit
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Profit Margin</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {profitMargin.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Business Details */}
              <motion.div variants={itemVariants}>
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="accounts">Accounts</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="tax">Tax Categories</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Business Overview</CardTitle>
                        <CardDescription>
                          {selectedBusiness.name} • {selectedBusiness.type || 'No type specified'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium mb-3">Business Info</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Name:</span>
                                <span>{selectedBusiness.name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Type:</span>
                                <span>{selectedBusiness.type || 'Not specified'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tax ID:</span>
                                <span>{selectedBusiness.tax_id || 'Not provided'}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-medium mb-3">Quick Stats</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Linked Accounts:</span>
                                <span>{businessAccounts.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Transactions:</span>
                                <span>{businessTransactions.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Created:</span>
                                <span>{new Date(selectedBusiness.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="accounts" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Business Accounts</CardTitle>
                        <CardDescription>
                          Accounts assigned to {selectedBusiness.name}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {businessAccounts.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No accounts assigned to this business yet.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {businessAccounts.map(account => (
                              <div 
                                key={account.id}
                                className="flex items-center justify-between p-4 rounded-lg bg-background/50 border"
                              >
                                <div>
                                  <div className="font-medium">{account.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {account.institution_name || 'Manual Account'}
                                  </div>
                                </div>
                                <div className="font-semibold">
                                  {formatCurrency(account.current_balance)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="transactions" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Business Transactions</CardTitle>
                        <CardDescription>
                          Recent transactions for {selectedBusiness.name}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {businessTransactions.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No transactions tagged for this business yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {businessTransactions.slice(0, 10).map(transaction => (
                              <div 
                                key={transaction.id}
                                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50"
                              >
                                <div>
                                  <div className="font-medium">{transaction.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {new Date(transaction.date).toLocaleDateString()}
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
                  </TabsContent>

                  <TabsContent value="tax" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Tax Categories (Schedule C)</CardTitle>
                        <CardDescription>
                          Expense breakdown by tax category
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-8 text-muted-foreground">
                          Tax category breakdown coming soon...
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </motion.div>
            </>
          )}
        </>
      )}

      {/* Add Business Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Business</DialogTitle>
            <DialogDescription>
              Create a new business entity to track separately.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name</Label>
              <Input
                id="name"
                placeholder="e.g., My Consulting LLC"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Business Type (Optional)</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                  <SelectItem value="llc">LLC</SelectItem>
                  <SelectItem value="s_corp">S-Corp</SelectItem>
                  <SelectItem value="c_corp">C-Corp</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tax_id">Tax ID / EIN (Optional)</Label>
              <Input
                id="tax_id"
                placeholder="XX-XXXXXXX"
                value={formData.tax_id}
                onChange={(e) => setFormData(prev => ({ ...prev, tax_id: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBusiness} disabled={!formData.name}>
              Add Business
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}




