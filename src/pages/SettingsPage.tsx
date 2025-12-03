import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  Database,
  Key,
  Save,
  Trash2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

export default function SettingsPage() {
  const { profile, preferences, updateProfile, updatePreferences } = useAuthStore()
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
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile
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
    </motion.div>
  )
}




