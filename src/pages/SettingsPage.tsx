import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  User, 
  Bell, 
  CreditCard, 
  Database,
  Key,
  Save,
  Trash2,
  Building2,
  Plus,
  TrendingUp,
  PiggyBank,
  MoreVertical,
  Pencil,
  Users,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useFinancialStore } from '@/stores/financialStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

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

export default function SettingsPage() {
  const { user, profile, preferences, updateProfile, updatePreferences } = useAuthStore()
  const { businesses, accounts, addBusiness } = useFinancialStore()
  const { toast } = useToast()
  
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
    email: profile?.email || '',
  })
  
  const [prefsForm, setPrefsForm] = useState({
    low_balance_threshold: preferences?.low_balance_threshold || 500,
    large_transaction_threshold: preferences?.large_transaction_threshold || 1000,
    alert_email_enabled: preferences?.alert_email_enabled ?? true,
    alert_desktop_enabled: preferences?.alert_desktop_enabled ?? true,
    default_currency: preferences?.default_currency || 'USD',
  })

  const [apiKeys, setApiKeys] = useState({
    openai_api_key: '',
  })

  // Entity management state
  const [showAddEntityDialog, setShowAddEntityDialog] = useState(false)
  const [entityForm, setEntityForm] = useState({
    name: '',
    type: 'business',
    color: '#3b82f6',
    taxId: '',
  })

  const handleSaveProfile = async () => {
    await updateProfile({
      full_name: profileForm.full_name,
    })
    toast({
      title: 'Profile updated',
      description: 'Your profile has been saved.',
      variant: 'success',
    })
  }

  const handleSavePreferences = async () => {
    await updatePreferences({
      low_balance_threshold: prefsForm.low_balance_threshold,
      large_transaction_threshold: prefsForm.large_transaction_threshold,
      alert_email_enabled: prefsForm.alert_email_enabled,
      alert_desktop_enabled: prefsForm.alert_desktop_enabled,
      default_currency: prefsForm.default_currency,
    })
    toast({
      title: 'Preferences saved',
      description: 'Your preferences have been updated.',
      variant: 'success',
    })
  }

  const handleAddEntity = async () => {
    if (!user || !entityForm.name) return

    const business = await addBusiness({
      user_id: user.id,
      name: entityForm.name,
      type: entityForm.type,
      tax_id: entityForm.taxId || null,
    })

    if (business) {
      toast({
        title: 'Entity created',
        description: `${entityForm.name} has been added.`,
      })
      setShowAddEntityDialog(false)
      setEntityForm({ name: '', type: 'business', color: '#3b82f6', taxId: '' })
    }
  }

  const getEntityType = (type: string | null | undefined) => {
    return ENTITY_TYPES.find(t => t.value === type) || ENTITY_TYPES[1]
  }

  const getEntityAccountCount = (businessId: string) => {
    return accounts.filter(a => a.business_id === businessId).length
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
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid grid-cols-5 w-full max-w-xl">
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="entities">
            <Users className="w-4 h-4 mr-2" />
            Entities
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="w-4 h-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Key className="w-4 h-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="data">
            <Database className="w-4 h-4 mr-2" />
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      disabled
                      className="opacity-60"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Select
                    value={prefsForm.default_currency}
                    onValueChange={(value) => setPrefsForm(prev => ({ ...prev, default_currency: value }))}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="CAD">CAD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button onClick={handleSaveProfile}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Profile
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Entities Tab */}
        <TabsContent value="entities" className="mt-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Financial Entities</CardTitle>
                    <CardDescription>
                      Manage personal, business, and other financial entities
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowAddEntityDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Entity
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Personal Entity (always exists) */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">Personal</p>
                      <p className="text-sm text-muted-foreground">
                        {accounts.filter(a => !a.business_id).length} accounts
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Default</Badge>
                </div>

                {/* Business Entities */}
                {businesses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No business entities yet</p>
                    <p className="text-sm">Add a business to track finances separately</p>
                  </div>
                ) : (
                  businesses.map(business => {
                    const typeInfo = getEntityType(business.type)
                    const Icon = typeInfo.icon
                    const accountCount = getEntityAccountCount(business.id)
                    
                    return (
                      <div 
                        key={business.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${typeInfo.color} flex items-center justify-center`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold">{business.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs">{typeInfo.label}</Badge>
                              <span>{accountCount} accounts</span>
                              {business.tax_id && <span>• Tax ID: {business.tax_id}</span>}
                            </div>
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
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Alert Preferences</CardTitle>
                <CardDescription>
                  Configure when and how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive alerts via email
                      </p>
                    </div>
                    <Switch
                      checked={prefsForm.alert_email_enabled}
                      onCheckedChange={(checked) => 
                        setPrefsForm(prev => ({ ...prev, alert_email_enabled: checked }))
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Desktop Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Show desktop notifications
                      </p>
                    </div>
                    <Switch
                      checked={prefsForm.alert_desktop_enabled}
                      onCheckedChange={(checked) => 
                        setPrefsForm(prev => ({ ...prev, alert_desktop_enabled: checked }))
                      }
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium">Alert Thresholds</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="low_balance">Low Balance Alert ($)</Label>
                      <Input
                        id="low_balance"
                        type="number"
                        value={prefsForm.low_balance_threshold}
                        onChange={(e) => setPrefsForm(prev => ({ 
                          ...prev, 
                          low_balance_threshold: parseInt(e.target.value) || 0 
                        }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Alert when account drops below this amount
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="large_tx">Large Transaction Alert ($)</Label>
                      <Input
                        id="large_tx"
                        type="number"
                        value={prefsForm.large_transaction_threshold}
                        onChange={(e) => setPrefsForm(prev => ({ 
                          ...prev, 
                          large_transaction_threshold: parseInt(e.target.value) || 0 
                        }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Alert for transactions above this amount
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button onClick={handleSavePreferences}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>API Integrations</CardTitle>
                <CardDescription>
                  Configure your API keys for third-party services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <p className="text-sm text-warning">
                      API keys are stored securely and never displayed after saving. 
                      You can update them at any time.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="openai_key">OpenAI API Key</Label>
                    <Input
                      id="openai_key"
                      type="password"
                      placeholder="sk-..."
                      value={apiKeys.openai_api_key}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, openai_api_key: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for AI categorization and insights
                    </p>
                  </div>
                </div>
                
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save API Keys
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <motion.div variants={itemVariants} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>
                  Export or delete your financial data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-secondary">
                  <div>
                    <h4 className="font-medium">Export All Data</h4>
                    <p className="text-sm text-muted-foreground">
                      Download all your data as a JSON file
                    </p>
                  </div>
                  <Button variant="outline">
                    <Database className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div>
                    <h4 className="font-medium text-destructive">Delete All Data</h4>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete all your financial data. This cannot be undone.
                    </p>
                  </div>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connected Services</CardTitle>
                <CardDescription>
                  Manage your connected bank accounts and services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No connected services</p>
                  <p className="text-sm">
                    Connect a bank account to start syncing transactions
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Add Entity Dialog */}
      <Dialog open={showAddEntityDialog} onOpenChange={setShowAddEntityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Financial Entity</DialogTitle>
            <DialogDescription>
              Create a new entity to track finances separately (e.g., business, rental property).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="entity-name">Entity Name</Label>
              <Input
                id="entity-name"
                placeholder="e.g., My LLC, Rental Property #1"
                value={entityForm.name}
                onChange={e => setEntityForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity-type">Entity Type</Label>
              <Select
                value={entityForm.type}
                onValueChange={value => setEntityForm(prev => ({ ...prev, type: value }))}
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
              <Label htmlFor="entity-color">Color</Label>
              <div className="flex gap-2">
                {ENTITY_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setEntityForm(prev => ({ ...prev, color: color.value }))}
                    className={`w-8 h-8 rounded-full transition-all ${
                      entityForm.color === color.value
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
              <Label htmlFor="entity-taxId">Tax ID / EIN (Optional)</Label>
              <Input
                id="entity-taxId"
                placeholder="XX-XXXXXXX"
                value={entityForm.taxId}
                onChange={e => setEntityForm(prev => ({ ...prev, taxId: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEntityDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEntity} disabled={!entityForm.name}>
              Create Entity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}




