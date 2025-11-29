import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus, 
  Building2, 
  CreditCard, 
  Wallet, 
  PiggyBank,
  TrendingUp,
  RefreshCw,
  MoreVertical,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react'
import { usePlaidLink } from 'react-plaid-link'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import type { Account } from '@/types/database'

const accountTypeIcons = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  loan: Building2,
  investment: TrendingUp,
  other: Wallet,
}

const accountTypeColors = {
  checking: 'text-blue-400',
  savings: 'text-emerald-400',
  credit: 'text-orange-400',
  loan: 'text-red-400',
  investment: 'text-purple-400',
  other: 'text-gray-400',
}

export default function AccountsPage() {
  const { user } = useAuthStore()
  const { accounts, businesses, addAccount, updateAccount, isLoadingAccounts, fetchAccounts } = useFinancialStore()
  const { toast } = useToast()
  
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking' as Account['type'],
    current_balance: '',
    institution_name: '',
    business_id: '',
  })

  // Fetch Plaid link token
  const fetchLinkToken = useCallback(async () => {
    if (!user) return
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid-create-link-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const data = await response.json()
      if (data.link_token) {
        setLinkToken(data.link_token)
      } else if (data.error) {
        console.error('Failed to get link token:', data.error)
      }
    } catch (error) {
      console.error('Error fetching link token:', error)
    }
  }, [user])

  useEffect(() => {
    fetchLinkToken()
  }, [fetchLinkToken])

  // Store access token before opening Plaid (survives OAuth redirects)
  const storeAccessToken = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        localStorage.setItem('plaid_pending_access_token', session.access_token)
        console.log('🔐 Stored access token for Plaid')
      }
    } catch (e) {
      console.error('Failed to store access token:', e)
    }
  }, [])

  // Handle successful Plaid Link connection
  const onPlaidSuccess = useCallback(async (public_token: string, metadata: any) => {
    console.log('🏦 Plaid Link success! Exchanging token...')
    console.log('Public token:', public_token)
    
    setIsConnecting(true)
    
    try {
      // Get the Supabase URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      console.log('Supabase URL:', supabaseUrl)
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured')
      }

      // Try multiple methods to get the access token
      console.log('Getting access token...')
      let accessToken = null
      
      // Method 1: Try stored token from before Plaid opened (survives OAuth)
      accessToken = localStorage.getItem('plaid_pending_access_token')
      if (accessToken) {
        console.log('✅ Found stored access token')
      }
      
      // Method 2: Try current session
      if (!accessToken) {
        console.log('Trying getSession...')
        try {
          const { data: { session } } = await supabase.auth.getSession()
          accessToken = session?.access_token
          if (accessToken) console.log('✅ Got token from getSession')
        } catch (e) {
          console.error('getSession failed:', e)
        }
      }
      
      // Method 3: Try refreshing session
      if (!accessToken) {
        console.log('Trying to refresh session...')
        try {
          const { data: { session } } = await supabase.auth.refreshSession()
          accessToken = session?.access_token
          if (accessToken) console.log('✅ Got token from refreshSession')
        } catch (e) {
          console.error('refreshSession failed:', e)
        }
      }
      
      if (!accessToken) {
        console.error('No access token available')
        toast({
          title: 'Session Expired',
          description: 'Please refresh the page and try again.',
          variant: 'destructive',
        })
        throw new Error('Session expired - please refresh the page and log in again')
      }

      console.log('Making API call to plaid-exchange-token...')
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/plaid-exchange-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ public_token, metadata }),
        }
      )

      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API error:', errorText)
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Response data:', JSON.stringify(data))
      
      if (data.success) {
        // Clear stored token
        localStorage.removeItem('plaid_pending_access_token')
        
        toast({
          title: '🎉 Bank Connected!',
          description: `Successfully connected ${data.institution || 'your bank'}. ${data.accounts?.length || 0} account(s) added.`,
        })
        // Refresh accounts list
        if (user) fetchAccounts(user.id)
        // Get a fresh link token for the next connection
        fetchLinkToken()
      } else {
        throw new Error(data.error || 'Failed to connect bank')
      }
    } catch (error) {
      console.error('Error exchanging token:', error)
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect bank account',
        variant: 'destructive',
      })
    } finally {
      setIsConnecting(false)
    }
  }, [toast, fetchAccounts, fetchLinkToken, user])

  // Plaid Link configuration
  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: (err, metadata) => {
      console.log('🏦 Plaid Link exited')
      console.log('Exit status:', metadata?.status)
      console.log('Link session ID:', metadata?.link_session_id)
      if (err) {
        console.error('Plaid Link exit error:', err)
        toast({
          title: 'Connection Cancelled',
          description: err.display_message || err.error_message || 'Bank connection was cancelled',
          variant: 'destructive',
        })
      }
    },
    onEvent: (eventName, metadata) => {
      console.log('🏦 Plaid event:', eventName, metadata)
    },
  })

  const handleAddAccount = async () => {
    if (!user) return
    
    const account = await addAccount({
      user_id: user.id,
      name: formData.name,
      type: formData.type,
      current_balance: parseFloat(formData.current_balance) || 0,
      institution_name: formData.institution_name || null,
      business_id: formData.business_id || null,
      is_manual: true,
      currency: 'USD',
    })

    if (account) {
      toast({
        title: 'Account added',
        description: `${formData.name} has been added successfully.`,
        variant: 'success',
      })
      setShowAddDialog(false)
      resetForm()
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'checking',
      current_balance: '',
      institution_name: '',
      business_id: '',
    })
  }

  const totalByType = accounts.reduce((acc, account) => {
    const type = account.type
    acc[type] = (acc[type] || 0) + account.current_balance
    return acc
  }, {} as Record<string, number>)

  const netWorth = accounts.reduce((total, account) => {
    if (account.type === 'credit' || account.type === 'loan') {
      return total - account.current_balance
    }
    return total + account.current_balance
  }, 0)

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
          <h1 className="font-display text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">Manage your connected accounts</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync All
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="glass border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription>Net Worth</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gradient">
                {formatCurrency(netWorth)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Cash Accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency((totalByType['checking'] || 0) + (totalByType['savings'] || 0))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Credit Cards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(totalByType['credit'] || 0)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Investments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalByType['investment'] || 0)}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Plaid Integration Card */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold mb-1">
                  Connect Your Bank Accounts
                </h3>
                <p className="text-sm text-muted-foreground">
                  Securely connect your bank accounts for automatic transaction syncing via Plaid.
                </p>
              </div>
              <Button 
                className="glow-sm"
                onClick={async () => {
                  await storeAccessToken()
                  openPlaidLink()
                }}
                disabled={!plaidReady || !linkToken || isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4 mr-2" />
                    Connect Bank
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Account List */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>All Accounts</CardTitle>
            <CardDescription>
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAccounts ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No accounts yet</h3>
                <p className="text-muted-foreground mb-4">
                  Connect a bank account or add one manually to get started.
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Account
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => {
                  const Icon = accountTypeIcons[account.type]
                  const colorClass = accountTypeColors[account.type]
                  const business = businesses.find(b => b.id === account.business_id)
                  
                  return (
                    <div 
                      key={account.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-background transition-colors border border-border/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center ${colorClass}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{account.name}</span>
                            {account.is_manual && (
                              <Badge variant="outline" className="text-xs">Manual</Badge>
                            )}
                            {business && (
                              <Badge variant="secondary" className="text-xs">
                                {business.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{account.institution_name || 'Manual Account'}</span>
                            {account.mask && (
                              <>
                                <span>•</span>
                                <span>••••{account.mask}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className={`text-lg font-semibold ${
                            account.type === 'credit' || account.type === 'loan'
                              ? 'text-destructive'
                              : ''
                          }`}>
                            {formatCurrency(account.current_balance)}
                          </div>
                          {account.available_balance !== null && (
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(account.available_balance)} available
                            </div>
                          )}
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Sync Now
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingAccount(account)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateAccount(account.id, { is_hidden: !account.is_hidden })}
                            >
                              {account.is_hidden ? (
                                <>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Show
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-4 h-4 mr-2" />
                                  Hide
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
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
      </motion.div>

      {/* Add Account Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Account</DialogTitle>
            <DialogDescription>
              Add an account manually to track balances and transactions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                placeholder="e.g., Main Checking"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Account Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: Account['type']) => 
                  setFormData(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="balance">Current Balance</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.current_balance}
                onChange={(e) => setFormData(prev => ({ ...prev, current_balance: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="institution">Institution Name (Optional)</Label>
              <Input
                id="institution"
                placeholder="e.g., Chase, Wells Fargo"
                value={formData.institution_name}
                onChange={(e) => setFormData(prev => ({ ...prev, institution_name: e.target.value }))}
              />
            </div>

            {businesses.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="business">Assign to Business (Optional)</Label>
                <Select
                  value={formData.business_id}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, business_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Personal Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Personal Account</SelectItem>
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
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAccount} disabled={!formData.name}>
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}


