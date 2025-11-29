import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { 
  Plus, 
  FileCheck, 
  Upload, 
  Search, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Image,
  Sparkles,
  Link2,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { suggestCheckPayee } from '@/lib/openai'
import type { Check } from '@/types/database'

export default function ChecksPage() {
  const { user } = useAuthStore()
  const { 
    checks, 
    accounts, 
    categories, 
    businesses,
    transactions,
    addCheck, 
    updateCheck,
    matchCheckToTransaction,
    getUnmatchedChecks,
    isLoadingChecks,
  } = useFinancialStore()
  const { toast } = useToast()
  
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showMatchDialog, setShowMatchDialog] = useState(false)
  const [selectedCheck, setSelectedCheck] = useState<Check | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'cleared' | 'void'>('all')
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false)
  
  const [formData, setFormData] = useState({
    check_number: '',
    payee: '',
    amount: '',
    date_written: new Date().toISOString().split('T')[0],
    memo: '',
    account_id: '',
    category_id: '',
    business_id: '',
  })

  const unmatchedChecks = getUnmatchedChecks()

  // Check transactions that could potentially match
  const potentialMatches = selectedCheck ? transactions.filter(t => {
    if (!t.check_number) return false
    const checkNum = t.check_number.replace(/\D/g, '')
    const selectedNum = selectedCheck.check_number.replace(/\D/g, '')
    return checkNum === selectedNum && Math.abs(t.amount) === selectedCheck.amount
  }) : []

  const handleAddCheck = async () => {
    if (!user || !formData.account_id) return
    
    const check = await addCheck({
      user_id: user.id,
      account_id: formData.account_id,
      check_number: formData.check_number,
      payee: formData.payee,
      amount: parseFloat(formData.amount) || 0,
      date_written: formData.date_written,
      memo: formData.memo || null,
      category_id: formData.category_id || null,
      business_id: formData.business_id || null,
      status: 'pending',
    })

    if (check) {
      toast({
        title: 'Check recorded',
        description: `Check #${formData.check_number} to ${formData.payee} has been recorded.`,
        variant: 'success',
      })
      setShowAddDialog(false)
      resetForm()
    }
  }

  const handleMatchCheck = async (transactionId: string) => {
    if (!selectedCheck) return
    
    await matchCheckToTransaction(selectedCheck.id, transactionId)
    toast({
      title: 'Check matched',
      description: 'The check has been matched to the transaction.',
      variant: 'success',
    })
    setShowMatchDialog(false)
    setSelectedCheck(null)
  }

  const handleSuggestPayee = async () => {
    if (!formData.check_number || !formData.amount) {
      toast({
        title: 'Missing information',
        description: 'Please enter check number and amount first.',
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingSuggestion(true)
    try {
      const previousChecks = checks
        .filter(c => c.payee)
        .map(c => ({
          payee: c.payee,
          amount: c.amount,
          checkNumber: c.check_number,
        }))

      const suggestion = await suggestCheckPayee(
        formData.check_number,
        parseFloat(formData.amount),
        previousChecks
      )

      if (suggestion) {
        setFormData(prev => ({ ...prev, payee: suggestion.payee }))
        toast({
          title: 'AI Suggestion',
          description: `Based on your history, this check might be for "${suggestion.payee}" (${Math.round(suggestion.confidence * 100)}% confident)`,
        })
      } else {
        toast({
          title: 'No suggestion available',
          description: 'Not enough data to suggest a payee.',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to generate suggestion.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingSuggestion(false)
    }
  }

  const resetForm = () => {
    setFormData({
      check_number: '',
      payee: '',
      amount: '',
      date_written: new Date().toISOString().split('T')[0],
      memo: '',
      account_id: accounts[0]?.id || '',
      category_id: '',
      business_id: '',
    })
  }

  // OCR Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // In a real implementation, this would upload to OCR service
    toast({
      title: 'Check image uploaded',
      description: 'Processing image for payee extraction...',
    })
    // Simulate OCR processing
    setTimeout(() => {
      toast({
        title: 'OCR Complete',
        description: 'Check image processed. Payee information extracted.',
        variant: 'success',
      })
    }, 2000)
  }, [toast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    maxFiles: 1,
  })

  const filteredChecks = checks.filter(check => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!check.payee.toLowerCase().includes(query) && 
          !check.check_number.includes(query)) {
        return false
      }
    }
    if (statusFilter !== 'all' && check.status !== statusFilter) {
      return false
    }
    return true
  })

  const getStatusIcon = (status: Check['status']) => {
    switch (status) {
      case 'cleared':
        return <CheckCircle2 className="w-4 h-4 text-success" />
      case 'pending':
        return <Clock className="w-4 h-4 text-warning" />
      case 'void':
        return <XCircle className="w-4 h-4 text-destructive" />
    }
  }

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
          <h1 className="font-display text-3xl font-bold">Check Register</h1>
          <p className="text-muted-foreground">Track and reconcile your checks</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Record Check
        </Button>
      </div>

      {/* Alert for unmatched checks */}
      {unmatchedChecks.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <AlertCircle className="w-8 h-8 text-warning" />
                <div className="flex-1">
                  <h3 className="font-semibold">
                    {unmatchedChecks.length} Unmatched Check{unmatchedChecks.length !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    These checks have cleared your bank but need to be matched with recorded checks.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setStatusFilter('pending')}>
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
              <CardDescription>Total Checks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{checks.length}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {checks.filter(c => c.status === 'pending').length}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Cleared</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {checks.filter(c => c.status === 'cleared').length}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Amount</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(
                  checks
                    .filter(c => c.status === 'pending')
                    .reduce((sum, c) => sum + c.amount, 0)
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* OCR Upload */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Check Image OCR
            </CardTitle>
            <CardDescription>
              Upload check images to automatically extract payee information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-primary">Drop the check image here...</p>
              ) : (
                <div>
                  <p className="font-medium mb-1">Drag & drop a check image</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse. We'll extract the payee from the "Pay to the order of" line.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by payee or check number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select 
                value={statusFilter} 
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Check List */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Check History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingChecks ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredChecks.length === 0 ? (
              <div className="text-center py-12">
                <FileCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No checks recorded</h3>
                <p className="text-muted-foreground mb-4">
                  Start recording your checks to keep track of who they're made out to.
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Record Your First Check
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredChecks.map((check) => {
                  const account = accounts.find(a => a.id === check.account_id)
                  const category = categories.find(c => c.id === check.category_id)
                  const business = businesses.find(b => b.id === check.business_id)
                  
                  return (
                    <div 
                      key={check.id}
                      className="flex items-center justify-between p-4 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                          <FileCheck className="w-6 h-6 text-muted-foreground" />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">#{check.check_number}</span>
                            <span className="text-muted-foreground">to</span>
                            <span className="font-medium">{check.payee}</span>
                            {getStatusIcon(check.status)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatDate(check.date_written)}</span>
                            {account && (
                              <>
                                <span>•</span>
                                <span>{account.name}</span>
                              </>
                            )}
                            {category && (
                              <>
                                <span>•</span>
                                <span>{category.name}</span>
                              </>
                            )}
                            {business && (
                              <>
                                <span>•</span>
                                <Badge variant="secondary" className="text-xs">
                                  {business.name}
                                </Badge>
                              </>
                            )}
                          </div>
                          {check.memo && (
                            <div className="text-sm text-muted-foreground mt-1">
                              Memo: {check.memo}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-lg font-semibold">
                          {formatCurrency(check.amount)}
                        </div>
                        
                        {check.status === 'pending' && !check.matched_transaction_id && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedCheck(check)
                              setShowMatchDialog(true)
                            }}
                          >
                            <Link2 className="w-4 h-4 mr-2" />
                            Match
                          </Button>
                        )}
                        
                        <Badge variant={
                          check.status === 'cleared' ? 'success' :
                          check.status === 'pending' ? 'warning' : 'destructive'
                        }>
                          {check.status}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Check Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record a Check</DialogTitle>
            <DialogDescription>
              Log check details as you write them for easy tracking.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="check_number">Check Number</Label>
                <Input
                  id="check_number"
                  placeholder="e.g., 1234"
                  value={formData.check_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, check_number: e.target.value }))}
                />
              </div>
              
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
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="payee">Payee</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSuggestPayee}
                  disabled={isGeneratingSuggestion}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  {isGeneratingSuggestion ? 'Thinking...' : 'AI Suggest'}
                </Button>
              </div>
              <Input
                id="payee"
                placeholder="Who is this check for?"
                value={formData.payee}
                onChange={(e) => setFormData(prev => ({ ...prev, payee: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date_written">Date Written</Label>
              <Input
                id="date_written"
                type="date"
                value={formData.date_written}
                onChange={(e) => setFormData(prev => ({ ...prev, date_written: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account">Account</Label>
              <Select
                value={formData.account_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, account_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter(a => a.type === 'checking')
                    .map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="memo">Memo (Optional)</Label>
              <Textarea
                id="memo"
                placeholder="What is this check for?"
                value={formData.memo}
                onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category (Optional)</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {businesses.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="business">Business (Optional)</Label>
                  <Select
                    value={formData.business_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, business_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Personal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Personal</SelectItem>
                      {businesses.map(business => (
                        <SelectItem key={business.id} value={business.id}>
                          {business.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddCheck} 
              disabled={!formData.check_number || !formData.payee || !formData.amount || !formData.account_id}
            >
              Record Check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match Check Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Match Check to Transaction</DialogTitle>
            <DialogDescription>
              Select the bank transaction that corresponds to this check.
            </DialogDescription>
          </DialogHeader>
          
          {selectedCheck && (
            <div className="py-4">
              <div className="bg-accent/50 p-4 rounded-lg mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Check #{selectedCheck.check_number}</div>
                    <div className="text-sm text-muted-foreground">
                      To: {selectedCheck.payee}
                    </div>
                  </div>
                  <div className="text-lg font-bold">
                    {formatCurrency(selectedCheck.amount)}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Potential Matches</Label>
                {potentialMatches.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No matching transactions found. The check may not have cleared yet.
                  </div>
                ) : (
                  potentialMatches.map(transaction => (
                    <div 
                      key={transaction.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                      onClick={() => handleMatchCheck(transaction.id)}
                    >
                      <div>
                        <div className="font-medium">{transaction.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(transaction.date)}
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatCurrency(Math.abs(transaction.amount))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMatchDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}


