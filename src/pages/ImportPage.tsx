import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Building2,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  RotateCcw,
  Settings2,
  ChevronRight,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { formatDate } from '@/lib/utils'
import ImportWizard from '@/components/import/ImportWizard'
import type { ImportProfile } from '@/lib/importers/types'

interface ImportSession {
  id: string
  file_name: string
  file_type: string
  status: string
  total_rows: number
  transactions_created: number
  duplicates_skipped: number
  errors_count: number
  created_at: string
  completed_at: string | null
}

export default function ImportPage() {
  const { user } = useAuthStore()
  const { accounts, businesses, fetchTransactions } = useFinancialStore()
  const { toast } = useToast()

  const [showWizard, setShowWizard] = useState(false)
  const [importProfiles, setImportProfiles] = useState<ImportProfile[]>([])
  const [importHistory, setImportHistory] = useState<ImportSession[]>([])
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  // Fetch import profiles
  useEffect(() => {
    async function fetchProfiles() {
      if (!user) return
      
      const { data, error } = await supabase
        .from('import_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      
      if (!error && data) {
        setImportProfiles(data as any)
      }
      setIsLoadingProfiles(false)
    }
    
    fetchProfiles()
  }, [user])

  // Fetch import history
  useEffect(() => {
    async function fetchHistory() {
      if (!user) return
      
      const { data, error } = await supabase
        .from('import_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (!error && data) {
        setImportHistory(data as any)
      }
      setIsLoadingHistory(false)
    }
    
    fetchHistory()
  }, [user, showWizard]) // Refresh after wizard closes

  // Delete profile
  const handleDeleteProfile = async (profileId: string) => {
    const { error } = await supabase
      .from('import_profiles')
      .delete()
      .eq('id', profileId)
    
    if (!error) {
      setImportProfiles(prev => prev.filter(p => p.id !== profileId))
      toast({
        title: 'Profile deleted',
        description: 'Import profile has been removed.',
      })
    }
  }

  // Get file icon
  const getFileIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'csv':
        return <FileText className="w-5 h-5 text-emerald-500" />
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="w-5 h-5 text-green-500" />
      case 'qbo':
      case 'qfx':
      case 'ofx':
        return <Building2 className="w-5 h-5 text-blue-500" />
      default:
        return <FileText className="w-5 h-5" />
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'importing':
        return <Badge className="bg-blue-500/20 text-blue-400"><Clock className="w-3 h-3 mr-1 animate-spin" />Importing</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
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
          <h1 className="font-display text-3xl font-bold">Import Transactions</h1>
          <p className="text-muted-foreground">
            Import transactions from bank statements and CSV files
          </p>
        </div>
        <Button onClick={() => setShowWizard(true)} className="glow-sm">
          <Upload className="w-4 h-4 mr-2" />
          Import File
        </Button>
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* CSV/Excel Import */}
              <button
                onClick={() => setShowWizard(true)}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-background/50 hover:bg-background transition-colors border border-border/50 hover:border-primary/50"
              >
                <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-7 h-7 text-emerald-500" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">CSV / Excel</h3>
                  <p className="text-sm text-muted-foreground">Import from spreadsheet files</p>
                </div>
              </button>

              {/* QBO/OFX Import */}
              <button
                onClick={() => setShowWizard(true)}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-background/50 hover:bg-background transition-colors border border-border/50 hover:border-primary/50"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-blue-500" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">QBO / OFX</h3>
                  <p className="text-sm text-muted-foreground">Bank export files (auto-parsed)</p>
                </div>
              </button>

              {/* Use Saved Profile */}
              <button
                onClick={() => setShowWizard(true)}
                disabled={importProfiles.length === 0}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-background/50 hover:bg-background transition-colors border border-border/50 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Settings2 className="w-7 h-7 text-purple-500" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">Saved Profile</h3>
                  <p className="text-sm text-muted-foreground">
                    {importProfiles.length} profile{importProfiles.length !== 1 ? 's' : ''} saved
                  </p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saved Profiles */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Saved Import Profiles
              </CardTitle>
              <CardDescription>
                Saved column mappings for quick imports from the same bank
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingProfiles ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : importProfiles.length === 0 ? (
                <div className="text-center py-8">
                  <Settings2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No saved profiles</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Save a profile during import to reuse your column mappings
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {importProfiles.map(profile => {
                      const account = accounts.find(a => a.id === profile.defaultAccountId)
                      
                      return (
                        <div
                          key={profile.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            {getFileIcon(profile.fileType)}
                            <div>
                              <p className="font-medium">{profile.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {profile.fileType.toUpperCase()}
                                {account && ` → ${account.name}`}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowWizard(true)}
                            >
                              <Upload className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteProfile(profile.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Import History */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Imports
              </CardTitle>
              <CardDescription>
                History of your recent transaction imports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : importHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No import history</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your import history will appear here after your first import
                  </p>
                  <Button onClick={() => setShowWizard(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Start First Import
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {importHistory.map(session => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          {getFileIcon(session.file_type)}
                          <div>
                            <p className="font-medium truncate max-w-[200px]">
                              {session.file_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(session.created_at)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-right text-sm">
                            <p className="text-emerald-500">+{session.transactions_created}</p>
                            {session.duplicates_skipped > 0 && (
                              <p className="text-muted-foreground text-xs">
                                {session.duplicates_skipped} dups
                              </p>
                            )}
                          </div>
                          {getStatusBadge(session.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Supported Formats Info */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Supported File Formats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-6 h-6 text-emerald-500" />
                  <span className="font-semibold">CSV</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Comma-separated values. Smart column detection with AI-assisted mapping.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3 mb-2">
                  <FileSpreadsheet className="w-6 h-6 text-green-500" />
                  <span className="font-semibold">Excel</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  .xlsx and .xls files. Works with any bank statement export.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-6 h-6 text-blue-500" />
                  <span className="font-semibold">QBO / QFX</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  QuickBooks format. Auto-parsed with transaction IDs for deduplication.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-6 h-6 text-cyan-500" />
                  <span className="font-semibold">OFX</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Open Financial Exchange. Standard banking format, no mapping needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Import Wizard Dialog */}
      <ImportWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onComplete={(count) => {
          if (user) {
            fetchTransactions(user.id)
          }
        }}
      />
    </motion.div>
  )
}



